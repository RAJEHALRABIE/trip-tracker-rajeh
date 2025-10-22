import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA4kGynSyqJmUHzHbuRNPWzDFWHGGT4",
  authDomain: "trip-tracker-rajeh.firebaseapp.com",
  projectId: "trip-tracker-rajeh",
  storageBucket: "trip-tracker-rajeh.appspot.com",
  messagingSenderId: "1025723412931",
  appId: "1:1025723412931:web:53a9fa6e1a7a5f43a3dbec",
  measurementId: "G-J1RBF8H0CC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

document.addEventListener('DOMContentLoaded', initializeAnalytics);

function initializeAnalytics() {
  safeShowLoader();
  addEventListeners();
  loadCompletedShifts();
}

function addEventListeners() {
  elements?.exportCsvBtn?.addEventListener('click', exportToCSV);
  elements?.exportPdfBtn?.addEventListener('click', exportToPDF);
  
  // تحديث محتوى الأزرار إذا كانت موجودة
  if (elements.exportCsvBtn) {
    elements.exportCsvBtn.innerHTML = '<img src="assets/icons/csv.png" alt="CSV" width="20" height="20"> تصدير CSV';
  }
  if (elements.exportPdfBtn) {
    elements.exportPdfBtn.innerHTML = '<img src="assets/icons/download.png" alt="PDF" width="20" height="20"> تصدير PDF';
  }
}

async function loadCompletedShifts() {
  try {
    const shiftsRef = collection(db, 'shifts');
    const q = query(shiftsRef, where('status', '==', 'completed'), orderBy('startTime', 'desc'));
    const snapshot = await getDocs(q);
    completedShifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (completedShifts.length === 0) {
      showNoData("لا توجد شفتات مكتملة للعرض بعد.");
      return;
    }
    
    populateShiftsTable(completedShifts);
    processDataForChart(completedShifts);
    
  } catch (error) {
    console.error("❌ خطأ في جلب الشفتات المكتملة:", error);
    showNoData("فشل تحميل البيانات. تحقق من الاتصال بالإنترنت.");
  } finally {
    safeHideLoader();
  }
}

function populateShiftsTable(shifts) {
  if (!elements.tableBody) return;
  elements.tableBody.innerHTML = '';
  
  shifts.forEach(shift => {
    const startTime = toDateSafe(shift.startTime);
    const durationSec = shift.activeDurationSeconds || 0;
    const income = shift.totalIncome || 0;
    const tripTimeSec = shift.totalTripTimeSeconds || 0;
    const avgHourly = (tripTimeSec > 0) ? (income / (tripTimeSec / 3600)) : 0;
    
    const row = `
      <tr>
        <td>${startTime.toLocaleDateString('ar-SA')}</td>
        <td>${startTime.toLocaleTimeString('ar-SA')}</td>
        <td>${formatDuration(durationSec, 'short')}</td>
        <td>${income.toFixed(2)} ر.س</td>
        <td>${shift.tripCount || 0}</td>
        <td>${(shift.totalDistance || 0).toFixed(2)} كم</td>
        <td>${avgHourly.toFixed(2)} ر.س</td>
      </tr>`;
    elements.tableBody.insertAdjacentHTML('beforeend', row);
  });
}

function processDataForChart(shifts) {
  if (!elements.chartCanvasEl) return;
  if (typeof Chart === 'undefined') {
    console.warn("⚠️ Chart.js غير متوفر — تخطي الرسم.");
    return;
  }
  
  const ctx = elements.chartCanvasEl.getContext('2d');
  const data = {};
  const labels = [];
  const incomeData = [];
  
  // تجميع البيانات حسب التاريخ
  shifts.forEach(shift => {
    const d = toDateSafe(shift.startTime);
    const dateStr = d.toISOString().split('T')[0];
    const income = shift.totalIncome || 0;
    data[dateStr] = (data[dateStr] || 0) + income;
  });
  
  // إنشاء تسميات آخر 30 يوم
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const labelStr = date.toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit' });
    labels.push(labelStr);
    incomeData.push(data[dateStr] || 0);
  }
  
  // تدمير الرسم البياني القديم إن وجد
  if (incomeChart) incomeChart.destroy();
  
  // إنشاء الرسم البياني الجديد
  incomeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'الدخل اليومي (ر.س)',
        data: incomeData,
        backgroundColor: 'rgba(107, 77, 230, 0.7)',
        borderColor: 'rgba(107, 77, 230, 1)',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: 'var(--text)',
            font: {
              family: 'Cairo',
              size: 14
            }
          }
        },
        tooltip: {
          backgroundColor: 'var(--surface)',
          titleColor: 'var(--text)',
          bodyColor: 'var(--text)',
          borderColor: 'var(--primary-color)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              return `الدخل: ${context.parsed.y.toFixed(2)} ر.س`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'var(--border)'
          },
          ticks: {
            color: 'var(--text-muted)',
            font: {
              family: 'Cairo'
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: 'var(--border)'
          },
          ticks: {
            color: 'var(--text-muted)',
            font: {
              family: 'Cairo'
            },
            callback: function(value) {
              return value + ' ر.س';
            }
          }
        }
      },
      animation: {
        duration: 1000,
        easing: 'easeInOutQuart'
      }
    }
  });
}

function exportToCSV() {
  if (completedShifts.length === 0) {
    alert("❌ لا توجد بيانات لتصديرها.");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
  csvContent += "تاريخ البدء,وقت البدء,المدة الفعالة,الدخل (ر.س),عدد الرحلات,المسافة (كم),متوسط الأجر/ساعة\r\n";
  
  completedShifts.forEach(shift => {
    const startTime = toDateSafe(shift.startTime);
    const durationSec = shift.activeDurationSeconds || 0;
    const income = shift.totalIncome || 0;
    const tripTimeSec = shift.totalTripTimeSeconds || 0;
    const avgHourly = (tripTimeSec > 0) ? (income / (tripTimeSec / 3600)) : 0;
    
    const row = [
      `"${startTime.toLocaleDateString('ar-SA')}"`,
      `"${startTime.toLocaleTimeString('ar-SA')}"`,
      `"${formatDuration(durationSec, 'short')}"`,
      income.toFixed(2),
      shift.tripCount || 0,
      (shift.totalDistance || 0).toFixed(2),
      avgHourly.toFixed(2)
    ].join(",");
    
    csvContent += row + "\r\n";
  });
  
  const link = document.createElement("a");
  link.href = encodeURI(csvContent);
  link.download = `trip_tracker_shifts_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showNotification("تم تصدير البيانات بنجاح إلى CSV!", "success");
}

function exportToPDF() {
  if (completedShifts.length === 0) {
    alert("❌ لا توجد بيانات لتصديرها.");
    return;
  }
  
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) {
    alert("❌ مكتبة jsPDF غير متوفرة في هذه الصفحة.");
    return;
  }
  
  try {
    const doc = new jsPDF();
    
    // العنوان
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(107, 77, 230);
    doc.text("تقرير الشفتات - Trip Tracker", 105, 20, { align: 'center' });
    
    // التاريخ
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`تاريخ التصدير: ${new Date().toLocaleDateString('ar-SA')}`, 105, 30, { align: 'center' });
    
    // رأس الجدول
    const head = [["Date", "Start Time", "Duration", "Income (SAR)", "Trips", "Distance (KM)", "Avg/Hour (SAR)"]];
    
    // بيانات الجدول
    const body = completedShifts.map(shift => {
      const startTime = toDateSafe(shift.startTime);
      const durationSec = shift.activeDurationSeconds || 0;
      const income = shift.totalIncome || 0;
      const tripTimeSec = shift.totalTripTimeSeconds || 0;
      const avgHourly = (tripTimeSec > 0) ? (income / (tripTimeSec / 3600)) : 0;
      
      return [
        startTime.toLocaleDateString('en-US'),
        startTime.toLocaleTimeString('en-US'),
        formatDuration(durationSec, 'short'),
        income.toFixed(2),
        shift.tripCount || 0,
        (shift.totalDistance || 0).toFixed(2),
        avgHourly.toFixed(2)
      ];
    });
    
    // إنشاء الجدول
    if (doc.autoTable) {
      doc.autoTable({
        head: head,
        body: body,
        startY: 40,
        theme: 'grid',
        headStyles: {
          fillColor: [107, 77, 230],
          textColor: 255,
          fontStyle: 'bold'
        },
        styles: {
          font: 'helvetica',
          fontSize: 10,
          cellPadding: 3,
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        }
      });
    }
    
    // الحفظ
    doc.save(`trip_tracker_report_${new Date().toISOString().split('T')[0]}.pdf`);
    
    showNotification("تم تصدير البيانات بنجاح إلى PDF!", "success");
    
  } catch (error) {
    console.error("❌ خطأ في تصدير PDF:", error);
    alert("❌ فشل تصدير PDF. يرجى المحاولة مرة أخرى.");
  }
}

// مساعدات
function formatDuration(totalSeconds = 0, format = 'full') {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (format === 'short') return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds].map(v => String(v).padStart(2,'0')).join(':');
}

function toDateSafe(val) {
  try {
    if (!val) return new Date(0);
    if (typeof val.toDate === 'function') return val.toDate();
    return new Date(val);
  } catch {
    return new Date(0);
  }
}

function showNoData(msg) {
  const el = elements.noShiftsMessage;
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
  }
}

function safeShowLoader() {
  try {
    elements.loadingOverlay.style.display = 'flex';
    elements.loadingOverlay.classList.add('show');
  } catch {}
}

function safeHideLoader() {
  try {
    elements.loadingOverlay.style.display = 'none';
    elements.loadingOverlay.classList.remove('show');
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
  
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    left: 20px;
    right: 20px;
    background: ${type === 'success' ? 'var(--green)' : 'var(--red)'};
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
  }, 100);
  
  setTimeout(() => {
    notification.style.transform = 'translateY(-20px)';
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 4000);
}