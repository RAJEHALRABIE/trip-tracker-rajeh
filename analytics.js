// ** analytics.js - المصحح **
// تم استيراد التهيئة من الملف المركزي لحل مشكلة initializeApp

import { 
  db, collection, getDocs, query, where, orderBy 
} from "./firebase-config.js"; 
// نعتمد على chart.js من ملف analytics.html

// العناصر
const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  chartCanvasEl: document.getElementById('income-chart'),
  tableBody: document.getElementById('shifts-table-body'),
  noShiftsMessage: document.getElementById('no-shifts-message'),
  exportCsvBtn: document.getElementById('export-csv'),
  exportPdfBtn: document.getElementById('export-pdf'),
};

let completedShifts = [];
let incomeChart = null;
const shiftsRef = collection(db, "shifts");

// -------------------- الوظائف المساعدة --------------------

function safeShowLoader(message = 'جاري تحليل البيانات...') {
  try {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.querySelector('p').textContent = message;
        elements.loadingOverlay.style.display = 'flex';
        elements.loadingOverlay.classList.add('show');
    }
  } catch {}
}

function safeHideLoader() {
  try {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.style.display = 'none';
      elements.loadingOverlay.classList.remove('show');
    }
  } catch {}
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;
  
  // إضافة الأنماط (تأكد من وجودها في style.css)
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    left: 20px;
    right: 20px;
    background: ${type === 'success' ? 'var(--green, #22c55e)' : 'var(--red, #ef4444)'};
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 10000;
    transform: translateY(-20px);
    opacity: 0;
    transition: all 0.3s ease;
    font-weight: 600;
    text-align: center;
    backdrop-filter: blur(20px);
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
  }, 10);

  setTimeout(() => {
    notification.style.transform = 'translateY(-20px)';
    notification.style.opacity = '0';
    notification.addEventListener('transitionend', () => notification.remove());
  }, 5000);
}

function formatDuration(seconds) {
    if (seconds === 0) return '0 س';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    let parts = [];
    if (hours > 0) parts.push(`${hours} س`);
    if (minutes > 0) parts.push(`${minutes} د`);
    
    return parts.join(' و ');
}

function formatDateTime(date) {
    if (!date) return 'N/A';
    const d = date.toDate();
    const datePart = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
    const timePart = d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return { date: datePart, time: timePart };
}

// -------------------- إدارة البيانات والرسوم --------------------

async function fetchAndRenderShifts() {
    safeShowLoader();
    try {
        const q = query(shiftsRef, where("isActive", "==", false), orderBy("endTime", "desc"));
        const snapshot = await getDocs(q);
        
        completedShifts = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        if (completedShifts.length === 0) {
            elements.noShiftsMessage.style.display = 'block';
            if (elements.tableBody) elements.tableBody.innerHTML = '';
            safeHideLoader();
            return;
        }

        elements.noShiftsMessage.style.display = 'none';
        
        // 1. إظهار البيانات في الجدول
        renderShiftsTable(completedShifts);
        
        // 2. تحديث الرسم البياني
        updateChart(completedShifts);

    } catch (error) {
        console.error("❌ خطأ في جلب بيانات التحليل:", error);
        showNotification("❌ فشل تحميل بيانات التحليل.", 'error');
    }
    safeHideLoader();
}

function renderShiftsTable(shifts) {
    if (!elements.tableBody) return;
    elements.tableBody.innerHTML = '';
    
    shifts.forEach(shift => {
        const start = shift.startTime.toDate();
        const end = shift.endTime ? shift.endTime.toDate() : new Date(); // افتراض نهاية حالية للشفت النشط إذا لم يكن هناك endTime
        const durationSeconds = Math.floor((end - start) / 1000);
        
        // حساب مدة العمل الفعالة (إهمال وقت التوقف المؤقت إذا كان هناك منطق لذلك)
        // حاليا نستخدم المدة الكلية
        const effectiveDuration = durationSeconds; 
        
        const incomePerHour = effectiveDuration > 0 ? (shift.totalIncome / (effectiveDuration / 3600)).toFixed(2) : '0.00';
        const formattedStart = formatDateTime(shift.startTime);

        const row = elements.tableBody.insertRow();
        row.innerHTML = `
            <td>${formattedStart.date}</td>
            <td>${formattedStart.time}</td>
            <td>${formatDuration(effectiveDuration)}</td>
            <td>${(shift.totalIncome || 0).toFixed(2)}</td>
            <td>${shift.tripCount || 0}</td>
            <td>${(shift.totalDistance || 0).toFixed(2)}</td>
            <td style="font-weight: bold;">${incomePerHour} ر.س</td>
        `;
    });
}

function updateChart(shifts) {
    if (!elements.chartCanvasEl) return;

    // تجهيز البيانات للرسم البياني (الدخل لكل شفت)
    const chartLabels = shifts.map(shift => formatDateTime(shift.startTime).date);
    const chartData = shifts.map(shift => shift.totalIncome || 0);

    if (incomeChart) {
        incomeChart.destroy(); // حذف الرسم البياني القديم قبل إنشاء الجديد
    }

    incomeChart = new Chart(elements.chartCanvasEl, {
        type: 'bar', // يمكن تغييره إلى 'line' أو 'doughnut'
        data: {
            labels: chartLabels.reverse(), // اعكس ليكون الأحدث على اليمين
            datasets: [{
                label: 'الدخل الكلي للشفت (ر.س)',
                data: chartData.reverse(),
                backgroundColor: 'rgba(107, 77, 230, 0.7)', // var(--primary-color)
                borderColor: 'rgba(107, 77, 230, 1)',
                borderWidth: 1,
            }]
        },
        options: {
            responsive: true,
            aspectRatio: 1.5, // نسبة العرض إلى الارتفاع
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'الدخل (ر.س)'
                    },
                    ticks: {
                        // لاضافة علامة الريال
                        callback: function(value, index, values) {
                            return value + ' ر.س';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: { family: 'Cairo' }
                    }
                },
                tooltip: {
                    rtl: true,
                    titleFont: { family: 'Cairo' },
                    bodyFont: { family: 'Cairo' },
                }
            }
        }
    });
}

// -------------------- تصدير البيانات --------------------

function exportToCSV() {
    if (completedShifts.length === 0) {
        showNotification("⚠️ لا توجد بيانات للتصدير.", 'info');
        return;
    }
    
    // تعريف العناوين
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // \uFEFF for Arabic support
    const headers = [
        "ID", "تاريخ البدء", "وقت البدء", "تاريخ الانتهاء", "وقت الانتهاء", 
        "مدة الشفت (ثانية)", "الدخل الكلي (ر.س)", "عدد الرحلات", "المسافة (كم)", 
        "الدخل/ساعة (ر.س)"
    ];
    csvContent += headers.join(",") + "\r\n";

    // إضافة البيانات
    completedShifts.forEach(shift => {
        const start = shift.startTime.toDate();
        const end = shift.endTime ? shift.endTime.toDate() : new Date();
        const durationSeconds = Math.floor((end - start) / 1000);
        const incomePerHour = durationSeconds > 0 ? (shift.totalIncome / (durationSeconds / 3600)) : 0;
        
        const row = [
            shift.id,
            start.toLocaleDateString('ar-EG'),
            start.toLocaleTimeString('ar-EG'),
            end.toLocaleDateString('ar-EG'),
            end.toLocaleTimeString('ar-EG'),
            durationSeconds,
            shift.totalIncome || 0,
            shift.tripCount || 0,
            shift.totalDistance || 0,
            incomePerHour.toFixed(2)
        ];
        csvContent += row.join(",") + "\r\n";
    });

    // إنشاء رابط التنزيل
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "TripTracker_Shifts_Analytics.csv");
    document.body.appendChild(link); 
    link.click();
    document.body.removeChild(link);
    
    showNotification("✅ تم تصدير البيانات إلى ملف CSV.", 'success');
}

function exportToPDF() {
    // تتطلب مكتبة jspdf و jspdf-autotable
    if (typeof jspdf === 'undefined' || typeof jsPDF.autoTable === 'undefined') {
        showNotification("⚠️ مكتبات التصدير غير محملة بشكل صحيح. راجع ملف analytics.html.", 'error');
        return;
    }
    if (completedShifts.length === 0) {
        showNotification("⚠️ لا توجد بيانات للتصدير.", 'info');
        return;
    }

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'pt', 'a4'); // 'l' for landscape, 'pt' for points, 'a4' size
        doc.setFont('Amiri', 'normal'); // يفترض وجود خط عربي مضاف لـ jspdf

        const tableColumn = ["تاريخ البدء", "وقت البدء", "المدة الفعالة", "الدخل (ر.س)", "عدد الرحلات", "المسافة (كم)", "متوسط/ساعة (ر.س)"];
        const tableRows = [];

        completedShifts.forEach(shift => {
            const start = shift.startTime.toDate();
            const end = shift.endTime ? shift.endTime.toDate() : new Date();
            const durationSeconds = Math.floor((end - start) / 1000);
            const effectiveDuration = durationSeconds; 
            const incomePerHour = effectiveDuration > 0 ? (shift.totalIncome / (effectiveDuration / 3600)).toFixed(2) : '0.00';
            const formattedStart = formatDateTime(shift.startTime);

            tableRows.push([
                formattedStart.date,
                formattedStart.time,
                formatDuration(effectiveDuration),
                (shift.totalIncome || 0).toFixed(2),
                shift.tripCount || 0,
                (shift.totalDistance || 0).toFixed(2),
                incomePerHour
            ]);
        });
        
        // عنوان PDF
        doc.text("تقرير تحليل شفتات Trip Tracker", 400, 40, null, null, 'center');

        // إنشاء الجدول
        doc.autoTable(tableColumn, tableRows, {
            startY: 60,
            theme: 'grid',
            headStyles: { 
                fillColor: [107, 77, 230], // Primary color
                font: 'Amiri', // يجب ان يكون خط Amiri مضافا
                halign: 'center'
            },
            bodyStyles: { font: 'Amiri', halign: 'center' },
            styles: {
                // ضبط الاتجاه لليمين لـ RTL
                direction: 'rtl',
                halign: 'right',
                cellPadding: 6,
            }
        });
        
        doc.save('TripTracker_Shifts_Report.pdf');
        showNotification("✅ تم تصدير البيانات إلى ملف PDF.", 'success');
        
    } catch (error) {
        console.error("❌ خطأ في تصدير PDF:", error);
        showNotification(`❌ فشل تصدير PDF. تأكد من وجود مكتبات jspdf: ${error.message}`, 'error');
    }
}


// -------------------- التهيئة --------------------

function initializeAnalytics() {
    // ربط الأحداث بأزرار التصدير
    if (elements.exportCsvBtn) elements.exportCsvBtn.addEventListener('click', exportToCSV);
    if (elements.exportPdfBtn) elements.exportPdfBtn.addEventListener('click', exportToPDF);
    
    fetchAndRenderShifts();
}

document.addEventListener('DOMContentLoaded', initializeAnalytics);