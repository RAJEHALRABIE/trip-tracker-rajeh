import { 
  db, collection, getDocs, query, where, orderBy 
} from "./firebase-config.js";

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
  
  // تحديث محتوى الأزرار بأيقونة CSV و PDF
  if (elements.exportCsvBtn) {
    elements.exportCsvBtn.innerHTML = '<img src="assets/icons/csv.png" alt="CSV" width="20" height="20"> تصدير CSV';
  }
  if (elements.exportPdfBtn) {
    elements.exportPdfBtn.innerHTML = '<img src="assets/icons/pdf.png" alt="PDF" width="20" height="20"> تصدير PDF';
  }
}

// ====================================================================
//                       🛠️ أدوات المساعدة
// ====================================================================

function toDateSafe(timestamp) {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate();
  if (timestamp instanceof Date) return timestamp;
  return new Date(timestamp);
}

function formatDuration(totalSeconds, format = 'short') {
  if (totalSeconds < 0) totalSeconds = 0;
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  
  const h = hours.toString().padStart(2, '0');
  const m = minutes.toString().padStart(2, '0');

  return `${h}:${m}`; // تنسيق مختصر للساعات والدقائق
}


// ====================================================================
//                        📊 وظائف التحليل
// ====================================================================

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
    
    // إخفاء رسالة لا توجد بيانات
    elements.noShiftsMessage.style.display = 'none';
    
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
  
  // تجميع البيانات يومياً
  const dailyData = {};
  shifts.forEach(shift => {
    const dateKey = toDateSafe(shift.startTime).toLocaleDateString('en-US'); // استخدام تنسيق ثابت للمفتاح
    
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        income: 0,
        distance: 0,
        count: 0,
        date: toDateSafe(shift.startTime)
      };
    }
    
    dailyData[dateKey].income += shift.totalIncome || 0;
    dailyData[dateKey].distance += shift.totalDistance || 0;
    dailyData[dateKey].count += 1;
  });

  // فرز البيانات حسب التاريخ
  const sortedDays = Object.values(dailyData).sort((a, b) => a.date.getTime() - b.date.getTime());

  const labels = sortedDays.map(d => d.date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }));
  const incomeData = sortedDays.map(d => d.income.toFixed(2));
  
  renderChart(labels, incomeData);
}

function renderChart(labels, incomeData) {
  if (incomeChart) {
    incomeChart.destroy();
  }
  
  const ctx = elements.chartCanvasEl.getContext('2d');
  
  incomeChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'الدخل اليومي (ر.س)',
        data: incomeData,
        backgroundColor: 'rgba(107, 77, 230, 0.8)', // Primary Color
        borderColor: 'rgba(107, 77, 230, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'الدخل (ر.س)'
          }
        },
        x: {
          title: {
            display: true,
            text: 'التاريخ'
          }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(context.parsed.y);
              }
              return label;
            }
          }
        }
      }
    }
  });
}

// ====================================================================
//                           📤 وظائف التصدير
// ====================================================================

function prepareDataForExport() {
  return completedShifts.map(shift => {
    const startTime = toDateSafe(shift.startTime);
    const durationSec = shift.activeDurationSeconds || 0;
    const income = shift.totalIncome || 0;
    const tripTimeSec = shift.totalTripTimeSeconds || 0;
    const avgHourly = (tripTimeSec > 0) ? (income / (tripTimeSec / 3600)) : 0;

    return {
      'ID': shift.id,
      'تاريخ البدء': startTime.toLocaleDateString('ar-SA'),
      'وقت البدء': startTime.toLocaleTimeString('ar-SA'),
      'المدة الفعالة': formatDuration(durationSec, 'short'),
      'الدخل (ر.س)': income.toFixed(2),
      'عدد الرحلات': shift.tripCount || 0,
      'المسافة (كم)': (shift.totalDistance || 0).toFixed(2),
      'متوسط/ساعة (ر.س)': avgHourly.toFixed(2),
      'حالة الشفت': shift.status
    };
  });
}

function exportToCSV() {
  if (completedShifts.length === 0) {
    showError('لا توجد بيانات للتصدير.');
    return;
  }
  
  const data = prepareDataForExport();
  const headers = Object.keys(data[0]);
  
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(',') + '\n';

  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] === null || row[header] === undefined ? '' : row[header];
      // التعامل مع الفواصل داخل النصوص
      return `"${String(value).replace(/"/g, '""')}"`;
    });
    csvContent += values.join(',') + '\n';
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `TripTracker_Shifts_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  showNotification('تم تصدير البيانات بنجاح إلى ملف CSV.', 'success');
}

function exportToPDF() {
  if (completedShifts.length === 0) {
    showError('لا توجد بيانات للتصدير.');
    return;
  }

  if (typeof jspdf === 'undefined' || typeof jspdf.default.autoTable === 'undefined') {
    showError('مكتبات تصدير PDF غير محملة. حاول تحديث الصفحة.');
    return;
  }
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // يجب تحميل الخط الداعم للغة العربية في PDF (مثل Amiri أو Cairo)
  // هنا سنعتمد على خط افتراضي يدعم UTF-8
  doc.setFont('Amiri', 'normal'); // افتراض أن الخط تم تضمينه
  doc.setFontSize(10);
  doc.setR2L(true); // لاتجاه الكتابة من اليمين لليسار

  const data = prepareDataForExport();
  const headers = [
      'تاريخ البدء', 'وقت البدء', 'المدة الفعالة', 'الدخل (ر.س)', 
      'عدد الرحلات', 'المسافة (كم)', 'متوسط/ساعة (ر.س)'
  ];
  
  const body = data.map(row => [
    row['تاريخ البدء'],
    row['وقت البدء'],
    row['المدة الفعالة'],
    row['الدخل (ر.س)'],
    row['عدد الرحلات'],
    row['المسافة (كم)'],
    row['متوسط/ساعة (ر.س)'],
  ]);

  doc.text('تقرير شفتات Trip Tracker', 105, 10, { align: 'center' });

  doc.autoTable({
    head: [headers],
    body: body,
    startY: 15,
    styles: { 
      font: 'Amiri', // استخدام الخط العربي
      direction: 'rtl',
      halign: 'right' 
    },
    headStyles: {
      fillColor: [107, 77, 230]
    },
    columnStyles: {
        0: { halign: 'right' },
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
    }
  });

  doc.save(`TripTracker_Shifts_${new Date().toISOString().slice(0, 10)}.pdf`);
  showNotification('تم تصدير البيانات بنجاح إلى ملف PDF.', 'success');
}


// ====================================================================
//                        📢 الإشعارات والتحميل
// ====================================================================

function showNoData(message) {
  if (elements.chartCanvasEl) elements.chartCanvasEl.style.display = 'none';
  if (elements.tableBody) elements.tableBody.innerHTML = '';
  if (elements.noShiftsMessage) {
    elements.noShiftsMessage.textContent = message;
    elements.noShiftsMessage.style.display = 'block';
  }
  if (elements.exportCsvBtn) elements.exportCsvBtn.style.display = 'none';
  if (elements.exportPdfBtn) elements.exportPdfBtn.style.display = 'none';
}

function safeShowLoader(message = 'جاري التحميل...') {
  try {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.querySelector('p').textContent = message;
      elements.loadingOverlay.style.display = 'flex';
      setTimeout(() => {
        elements.loadingOverlay.classList.add('show');
      }, 10);
    }
  } catch {}
}

function safeHideLoader() {
  try {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.classList.remove('show');
      setTimeout(() => {
        elements.loadingOverlay.style.display = 'none';
      }, 300);
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
  }, 10);
  
  setTimeout(() => {
    notification.style.transform = 'translateY(-20px)';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

function showError(message) {
  showNotification(message, 'error');
}