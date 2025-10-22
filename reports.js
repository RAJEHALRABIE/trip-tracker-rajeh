// reports.js

import { 
  db, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc
} from "./firebase-config.js"; 
import { safeShowLoader, safeHideLoader, showNotification } from "./utils.js"; 

// العناصر
const elements = {
    reportsList: document.getElementById('reportsList'),
    totalReportedIncome: document.getElementById('totalReportedIncome'),
    totalReportedTrips: document.getElementById('totalReportedTrips'),
};

// المراجع
const shiftsRef = collection(db, "shifts");

// -------------------- وظائف البيانات --------------------

function renderReports(shifts) {
    if (!elements.reportsList) return;
    
    elements.reportsList.innerHTML = ''; // مسح القائمة الحالية

    let totalIncome = 0;
    let totalTrips = 0;

    if (shifts.length === 0) {
        elements.reportsList.innerHTML = '<p class="empty-state">لا توجد شفتات منجزة لعرضها.</p>';
        if (elements.totalReportedIncome) elements.totalReportedIncome.textContent = '0 ر.س';
        if (elements.totalReportedTrips) elements.totalReportedTrips.textContent = '0';
        return;
    }

    shifts.forEach(shift => {
        // إذا كان الشفت نشطًا (isActive: true) أو لم يتم تحديد وقت الانتهاء، نتجاهله
        if (shift.isActive || !shift.endTime) return; 

        totalIncome += shift.totalIncome || 0;
        totalTrips += shift.tripCount || 0;

        const startTime = new Date(shift.startTime.toDate()).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
        const endTime = new Date(shift.endTime.toDate()).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
        
        // حساب المدة
        const durationMs = shift.endTime.toDate().getTime() - shift.startTime.toDate().getTime();
        const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(1);

        const listItem = document.createElement('div');
        listItem.className = 'report-item';
        listItem.dataset.shiftId = shift.id;
        
        listItem.innerHTML = `
            <div class="report-header">
                <h3>شفت بتاريخ: ${startTime.split(',')[0]}</h3>
                <span class="report-income">${(shift.totalIncome || 0).toFixed(2)} ر.س</span>
            </div>
            <div class="report-details">
                <p><strong>البدء:</strong> ${startTime}</p>
                <p><strong>الانتهاء:</strong> ${endTime}</p>
                <p><strong>المدة:</strong> ${durationHours} ساعات</p>
                <p><strong>عدد الرحلات:</strong> ${shift.tripCount || 0}</p>
                <p><strong>المسافة:</strong> ${(shift.totalDistance || 0).toFixed(2)} كم</p>
            </div>
            <div class="report-actions">
                <button class="btn btn-secondary btn-small delete-shift-btn">حذف</button>
            </div>
        `;
        elements.reportsList.appendChild(listItem);
    });
    
    if (elements.totalReportedIncome) elements.totalReportedIncome.textContent = `${totalIncome.toFixed(2)} ر.س`;
    if (elements.totalReportedTrips) elements.totalReportedTrips.textContent = totalTrips.toString();

    // ربط حدث الحذف
    document.querySelectorAll('.delete-shift-btn').forEach(button => {
        button.addEventListener('click', handleDeleteShift);
    });
}


async function fetchShifts() {
    safeShowLoader('جاري جلب التقارير...');
    try {
        // جلب جميع الشفتات مرتبة حسب وقت البدء تنازلياً
        const q = query(shiftsRef, orderBy("startTime", "desc"));
        const snapshot = await getDocs(q);
        
        const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        renderReports(shifts);

    } catch (error) {
        console.error("❌ خطأ في جلب التقارير:", error);
        showNotification("❌ فشل جلب تقارير الشفتات.", 'error');
    }
    safeHideLoader();
}

async function handleDeleteShift(e) {
    const shiftId = e.target.closest('.report-item').dataset.shiftId;
    if (!shiftId) return;

    if (!confirm("⚠️ هل أنت متأكد من حذف هذا الشفت وجميع الرحلات المتعلقة به؟")) return;

    safeShowLoader('جاري حذف الشفت...');
    try {
        const batch = writeBatch(db);
        
        // 1. حذف الرحلات المرتبطة بهذا الشفت
        const tripsQuery = query(collection(db, "trips"), where("shiftId", "==", shiftId));
        const tripsSnapshot = await getDocs(tripsQuery);
        tripsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 2. حذف وثيقة الشفت
        const shiftDocRef = doc(shiftsRef, shiftId);
        batch.delete(shiftDocRef);

        // 3. تحديث الإحصائيات الكلية (هذا يتطلب قراءة الشفت قبل حذفه لتحديد القيم التي يجب طرحها)
        // **ملاحظة: هذا الجزء معقد ويحتاج قراءة كاملة للوثائق. نكتفي حاليًا بالحذف وتحديث البيانات يدويًا.**
        
        await batch.commit();

        showNotification("✅ تم حذف الشفت والرحلات المرتبطة به بنجاح!", 'success');
        fetchShifts(); // إعادة تحميل التقارير
    } catch (error) {
        console.error("❌ خطأ في حذف الشفت:", error);
        showNotification(`❌ فشل حذف الشفت: ${error.message}`, 'error');
    }
    safeHideLoader();
}


// -------------------- التهيئة --------------------

document.addEventListener('DOMContentLoaded', fetchShifts);