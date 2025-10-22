// استيراد قاعدة البيانات من analytics.html
import { db } from './analytics.html'; 
// استيراد دوال Firestore
import { 
  collection, getDocs, query, where, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// --- عناصر واجهة المستخدم ---
const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  chartCanvas: document.getElementById('income-chart').getContext('2d'),
  tableBody: document.getElementById('shifts-table-body'),
  noShiftsMessage: document.getElementById('no-shifts-message'),
  exportCsvBtn: document.getElementById('export-csv'),
  exportPdfBtn: document.getElementById('export-pdf'),
};

// --- حالة الصفحة ---
let completedShifts = []; // لتخزين الشفتات المكتملة للتصدير
let incomeChart = null; // لتخزين كائن الرسم البياني

// --- تهيئة الصفحة ---
document.addEventListener('DOMContentLoaded', initializeAnalytics);

function initializeAnalytics() {
  elements.loadingOverlay.style.display = 'flex';
  addEventListeners();
  loadCompletedShifts();
}

function addEventListeners() {
  elements.exportCsvBtn.addEventListener('click', exportToCSV);
  elements.exportPdfBtn.addEventListener('click', exportToPDF);
}

// --- جلب ومعالجة البيانات ---
async function loadCompletedShifts() {
  try {
    const shiftsRef = collection(db, 'shifts');
    const q = query(shiftsRef, where('status', '==', 'completed'), orderBy('startTime', 'desc'));
    
    const snapshot = await getDocs(q);
    
    completedShifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (completedShifts.length === 0) {
      elements.noShiftsMessage.style.display = 'block';
    } else {
      populateShiftsTable(completedShifts);
      processDataForChart(completedShifts);
    }

  } catch (error) {
    console.error("خطأ في جلب الشفتات المكتملة:", error);
    elements.noShiftsMessage.textContent = "فشل تحميل البيانات.";
    elements.noShiftsMessage.style.display = 'block';
  } finally {
    elements.loadingOverlay.style.display = 'none';
  }
}

// --- 1. ملء الجدول ---
function populateShiftsTable(shifts) {
  elements.tableBody.innerHTML = ''; // إفراغ الجدول
  
  shifts.forEach(shift => {
    const startTime = shift.startTime.toDate();
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
      </tr>
    `;
    elements.tableBody.innerHTML += row;
  });
}

// --- 2. إعداد الرسم البياني ---
function processDataForChart(shifts) {
  const data = {}; // { 'YYYY-MM-DD': totalIncome }
  const labels = []; // ['DD/MM', 'DD/MM', ...]
  const incomeData = []; // [100, 150, ...]
  
  // تجميع الدخل حسب اليوم
  shifts.forEach(shift => {
    const dateStr = shift.startTime.toDate().toISOString().split('T')[0];
    const income = shift.totalIncome || 0;
    data[dateStr] = (data[dateStr] || 0) + income;
  });

  // إعداد بيانات آخر 30 يوم
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const labelStr = date.toLocaleDateString('ar-SA', { day: '2-digit', month: '2-digit' }); // DD/MM
    
    labels.push(labelStr);
    incomeData.push(data[dateStr] || 0);
  }

  // رسم المخطط
  renderIncomeChart(labels, incomeData);
}

function renderIncomeChart(labels, data) {
  if (incomeChart) {
    incomeChart.destroy(); // تدمير المخطط القديم إذا كان موجوداً
  }
  
  incomeChart = new Chart(elements.chartCanvas, {
    type: 'bar', // نوع المخطط (يمكن تغييره إلى 'line')
    data: {
      labels: labels,
      datasets: [{
        label: 'الدخل اليومي (ر.س)',
        data: data,
        backgroundColor: 'rgba(107, 77, 230, 0.6)', // لون بنفسجي
        borderColor: 'rgba(107, 77, 230, 1)',
        borderWidth: 1,
        borderRadius: 5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#8b949e' },
          grid: { color: '#30363d' }
        },
        x: {
          ticks: { color: '#8b949e' },
          grid: { color: '#30363d' }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#c9d1d9' }
        }
      }
    }
  });
}

// --- 3. دوال التصدير ---

function exportToCSV() {
  if (completedShifts.length === 0) {
    alert("لا توجد بيانات لتصديرها.");
    return;
  }
  
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // لدعم العربية
  // إضافة العناوين
  csvContent += "تاريخ البدء,وقت البدء,المدة الفعالة,الدخل (ر.س),عدد الرحلات,المسافة (كم),متوسط الأجر/ساعة\r\n";
  
  completedShifts.forEach(shift => {
    const startTime = shift.startTime.toDate();
    const durationSec = shift.activeDurationSeconds || 0;
    const income = shift.totalIncome || 0;
    const tripTimeSec = shift.totalTripTimeSeconds || 0;
    const avgHourly = (tripTimeSec > 0) ? (income / (tripTimeSec / 3600)) : 0;

    const row = [
      startTime.toLocaleDateString('ar-SA'),
      startTime.toLocaleTimeString('ar-SA'),
      formatDuration(durationSec, 'short'),
      income.toFixed(2),
      shift.tripCount || 0,
      (shift.totalDistance || 0).toFixed(2),
      avgHourly.toFixed(2)
    ].join(",");
    
    csvContent += row + "\r\n";
  });

  // إنشاء رابط التحميل
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `trip_tracker_shifts_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportToPDF() {
    if (completedShifts.length === 0) {
        alert("لا توجد بيانات لتصديرها.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // للأسف، jsPDF لا تدعم العربية بشكل افتراضي.
    // سنقوم بالتصدير كبيانات إنجليزية حالياً.
    // لدعم العربية، يتطلب الأمر إضافة خطوط مخصصة وهو أمر معقد.
    
    doc.text("Shifts Report - Trip Tracker", 14, 16);
    
    const tableColumn = ["Date", "Start Time", "Duration", "Income (SAR)", "Trips", "Distance (KM)", "Avg/Hour (SAR)"];
    const tableRows = [];

    completedShifts.forEach(shift => {
        const startTime = shift.startTime.toDate();
        const durationSec = shift.activeDurationSeconds || 0;
        const income = shift.totalIncome || 0;
        const tripTimeSec = shift.totalTripTimeSeconds || 0;
        const avgHourly = (tripTimeSec > 0) ? (income / (tripTimeSec / 3600)) : 0;

        const rowData = [
            startTime.toLocaleDateString('en-US'),
            startTime.toLocaleTimeString('en-US'),
            formatDuration(durationSec, 'short'),
            income.toFixed(2),
            shift.tripCount || 0,
            (shift.totalDistance || 0).toFixed(2),
            avgHourly.toFixed(2)
        ];
        tableRows.push(rowData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 20,
        theme: 'grid',
    });

    doc.save(`trip_tracker_report_${new Date().toISOString().split('T')[0]}.pdf`);
}


// --- دوال مساعدة ---
function formatDuration(totalSeconds = 0, format = 'full') {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  
  if (format === 'short') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds]
    .map(v => v.toString().padStart(2, '0'))
    .join(':');
}