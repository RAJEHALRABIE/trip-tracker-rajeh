// analytics.js

import { 
  db, collection, getDocs, query, orderBy
} from "./firebase-config.js";
import { safeShowLoader, safeHideLoader, showNotification } from "./utils.js";

// العناصر
const elements = {
    monthlyIncomeChart: document.getElementById('monthlyIncomeChart').getContext('2d'),
    dailyAverageIncome: document.getElementById('dailyAverageIncome'),
    tripsPerDayAverage: document.getElementById('tripsPerDayAverage'),
};

// المراجع
const shiftsRef = collection(db, "shifts");

let monthlyIncomeChartInstance = null;

// -------------------- وظائف تحليل البيانات --------------------

function processShifts(shifts) {
    const monthlyData = {};
    let totalIncome = 0;
    let totalTrips = 0;
    let totalDays = 0;
    const daysWithShifts = new Set();
    
    shifts.forEach(shift => {
        if (shift.isActive || !shift.endTime || !shift.startTime) return;

        const endTime = shift.endTime.toDate();
        const yearMonth = `${endTime.getFullYear()}-${(endTime.getMonth() + 1).toString().padStart(2, '0')}`;
        const dateString = endTime.toDateString();

        // إجمالي الدخل والرحلات
        totalIncome += shift.totalIncome || 0;
        totalTrips += shift.tripCount || 0;
        daysWithShifts.add(dateString);

        // تجميع البيانات شهريًا
        if (!monthlyData[yearMonth]) {
            monthlyData[yearMonth] = 0;
        }
        monthlyData[yearMonth] += shift.totalIncome || 0;
    });

    totalDays = daysWithShifts.size;

    // حساب المتوسطات
    const dailyAverageIncome = totalDays > 0 ? (totalIncome / totalDays).toFixed(2) : '0.00';
    const tripsPerDayAverage = totalDays > 0 ? (totalTrips / totalDays).toFixed(2) : '0.00';

    if (elements.dailyAverageIncome) elements.dailyAverageIncome.textContent = `${dailyAverageIncome} ر.س`;
    if (elements.tripsPerDayAverage) elements.tripsPerDayAverage.textContent = tripsPerDayAverage.toString();

    // تحضير البيانات للرسم البياني
    const labels = Object.keys(monthlyData).sort();
    const data = labels.map(key => monthlyData[key].toFixed(2));
    
    // تحويل التسميات إلى أسماء أشهر عربية
    const arabicLabels = labels.map(label => {
        const [year, month] = label.split('-');
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('ar', { month: 'long', year: 'numeric' });
    });

    renderChart(arabicLabels, data);
}

function renderChart(labels, data) {
    if (monthlyIncomeChartInstance) {
        monthlyIncomeChartInstance.destroy();
    }
    
    // التحقق من وجود Chart.js
    if (typeof Chart === 'undefined') {
        console.error("Chart.js غير محملة.");
        showNotification("❌ لا يمكن عرض الرسوم البيانية. تأكد من استيراد Chart.js.", 'error');
        return;
    }

    monthlyIncomeChartInstance = new Chart(elements.monthlyIncomeChart, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'الدخل الشهري (ر.س)',
                data: data,
                backgroundColor: 'rgba(107, 77, 230, 0.8)', // لون بنفسجي
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
                    title: {
                        display: true,
                        text: 'الدخل (ر.س)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'الشهر'
                    }
                }
            },
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'SAR' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

async function fetchAnalyticsData() {
    safeShowLoader('جاري تحليل البيانات...');
    try {
        // جلب جميع الشفتات مرتبة حسب وقت البدء
        const q = query(shiftsRef, orderBy("startTime", "asc"));
        const snapshot = await getDocs(q);
        
        const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        processShifts(shifts);

    } catch (error) {
        console.error("❌ خطأ في جلب بيانات التحليل:", error);
        showNotification("❌ فشل جلب بيانات التحليل.", 'error');
    }
    safeHideLoader();
}

// -------------------- التهيئة --------------------

document.addEventListener('DOMContentLoaded', fetchAnalyticsData);