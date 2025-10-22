// ** reports.js - المصحح **
// تم استيراد التهيئة من الملف المركزي لحل مشكلة initializeApp

import { 
  db, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where 
} from "./firebase-config.js"; 

// العناصر
const elements = {
  loading: document.getElementById('loading-overlay'),
  list: document.getElementById('trips-list'),
  empty: document.getElementById('empty-state'),
  editModal: document.getElementById('edit-modal'),
  editFareInput: document.getElementById('edit-fare'),
  editSaveBtn: document.getElementById('edit-save'),
  editCancelBtn: document.getElementById('edit-cancel'),
};

// المتغيرات العامة
let allTrips = [];
let currentEditTrip = null;
const tripsRef = collection(db, "trips");
const shiftsRef = collection(db, "shifts");

// -------------------- الوظائف المساعدة --------------------
function formatTime(totalSeconds) {
    if (totalSeconds < 0) return 'N/A';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => v < 10 ? '0' + v : v).join(':');
}

function formatDate(date) {
    if (!date) return 'N/A';
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
}

function safeShowLoader(message = 'جاري التحميل...') {
  try {
    if (elements.loading) {
        elements.loading.querySelector('p').textContent = message;
        elements.loading.style.display = 'flex';
        elements.loading.classList.add('show');
    }
  } catch {}
}

function safeHideLoader() {
  try { 
    if (elements.loading) {
      elements.loading.style.display = 'none'; 
      elements.loading.classList.remove('show');
    }
  } catch {}
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '💡'}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;
  
  // إضافة الأنماط (تأكد من وجودها في style.css)
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    left: 20px;
    right: 20px;
    background: ${type === 'success' ? 'var(--green, #22c55e)' : type === 'error' ? 'var(--red, #ef4444)' : 'var(--orange, #f59e0b)'};
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
  
  // إظهار الإشعار
  setTimeout(() => {
    notification.style.transform = 'translateY(0)';
    notification.style.opacity = '1';
  }, 10);

  // إخفاء الإشعار
  setTimeout(() => {
    notification.style.transform = 'translateY(-20px)';
    notification.style.opacity = '0';
    notification.addEventListener('transitionend', () => notification.remove());
  }, 5000);
}

// -------------------- إدارة الواجهة --------------------

function renderTrips() {
    if (!elements.list) return;
    elements.list.innerHTML = '';

    if (allTrips.length === 0) {
        if (elements.empty) elements.empty.style.display = 'block';
        return;
    }

    if (elements.empty) elements.empty.style.display = 'none';

    allTrips.forEach(trip => {
        const tripElement = document.createElement('div');
        tripElement.className = 'trip-item stats-card';
        tripElement.dataset.id = trip.id;

        const duration = trip.endTime ? Math.floor((trip.endTime.toDate() - trip.startTime.toDate()) / 1000) : 0;

        tripElement.innerHTML = `
            <div class="trip-header">
                <span class="trip-id-display">رحلة #${trip.id.substring(0, 4)}</span>
                <div class="trip-actions">
                    <button class="btn-icon edit-btn" data-id="${trip.id}">
                        <img src="assets/icons/edit.png" alt="تعديل" width="20" height="20">
                    </button>
                    <button class="btn-icon delete-btn" data-id="${trip.id}">
                        <img src="assets/icons/delete.png" alt="حذف" width="20" height="20">
                    </button>
                </div>
            </div>
            <div class="trip-details">
                <div class="detail-item">
                    <img src="assets/icons/calendar.png" alt="التاريخ">
                    <span class="detail-label">التاريخ:</span>
                    <span class="detail-value">${formatDate(trip.startTime.toDate())}</span>
                </div>
                <div class="detail-item">
                    <img src="assets/icons/clock.png" alt="المدة">
                    <span class="detail-label">المدة:</span>
                    <span class="detail-value">${formatTime(duration)}</span>
                </div>
                <div class="detail-item">
                    <img src="assets/icons/dollar.png" alt="الأجرة">
                    <span class="detail-label">الأجرة:</span>
                    <span class="detail-value">${(trip.fare || 0).toFixed(2)} ر.س</span>
                </div>
                <div class="detail-item">
                    <img src="assets/icons/map-pin.png" alt="المسافة">
                    <span class="detail-label">المسافة:</span>
                    <span class="detail-value">${(trip.distance || 0).toFixed(2)} كم</span>
                </div>
            </div>
        `;

        elements.list.appendChild(tripElement);
    });
    
    // ربط الأحداث بعد إضافة العناصر
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', handleEditClick);
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', handleDeleteClick);
    });
}

function openEditModal(trip) {
    currentEditTrip = trip;
    if (elements.editFareInput) elements.editFareInput.value = trip.fare.toString();
    if (elements.editModal) elements.editModal.style.display = 'flex';
}

function closeEditModal() {
    currentEditTrip = null;
    if (elements.editModal) elements.editModal.style.display = 'none';
}


// -------------------- وظائف البيانات --------------------

async function fetchTrips() {
    safeShowLoader('جاري جلب الرحلات...');
    try {
        const q = query(tripsRef, orderBy("startTime", "desc"), where("status", "==", "completed"));
        const querySnapshot = await getDocs(q);

        allTrips = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        renderTrips();
        showNotification(`✅ تم جلب ${allTrips.length} رحلة.`, 'success');

    } catch (error) {
        console.error("❌ خطأ في جلب الرحلات:", error);
        showNotification("❌ فشل جلب التقارير.", 'error');
    }
    safeHideLoader();
}

async function updateTrip(tripId, newFare) {
    safeShowLoader('جاري حفظ التعديل...');
    try {
        const oldTrip = allTrips.find(t => t.id === tripId);
        if (!oldTrip) throw new Error("الرحلة غير موجودة");

        const oldFare = oldTrip.fare || 0;
        const fareDifference = newFare - oldFare;

        const tripDocRef = doc(tripsRef, tripId);
        await updateDoc(tripDocRef, {
            fare: newFare,
            // المسافة (distance) لم يتم تعديلها هنا لتبسيط العملية، يمكن إضافتها لاحقاً
        });

        // 2. تحديث الشفت المرتبط (تحديث الدخل الكلي للشفت)
        const shiftDocRef = doc(shiftsRef, oldTrip.shiftId);
        await updateDoc(shiftDocRef, {
            totalIncome: (oldTrip.shiftIncome || 0) + fareDifference,
        });

        // 3. تحديث قائمة الرحلات المحلية (Local update)
        oldTrip.fare = newFare;

        // 4. إعادة رسم القائمة
        renderTrips();
        closeEditModal();
        showNotification("✅ تم تحديث الرحلة بنجاح.", 'success');

    } catch (error) {
        console.error("❌ خطأ في تحديث الرحلة:", error);
        showNotification(`❌ فشل التحديث: ${error.message || "خطأ غير معروف"}`, 'error');
    }
    safeHideLoader();
}

async function deleteTrip(tripId) {
    if (!confirm("هل أنت متأكد من حذف هذه الرحلة نهائياً؟")) return;

    safeShowLoader('جاري حذف الرحلة...');
    try {
        const tripToDelete = allTrips.find(t => t.id === tripId);
        if (!tripToDelete) throw new Error("الرحلة غير موجودة");

        // 1. حذف الرحلة
        const tripDocRef = doc(tripsRef, tripId);
        await deleteDoc(tripDocRef);

        // 2. تحديث الشفت المرتبط (طرح الدخل والمسافة وعدد الرحلات)
        const shiftDocRef = doc(shiftsRef, tripToDelete.shiftId);
        await updateDoc(shiftDocRef, {
            totalIncome: (tripToDelete.shiftIncome || 0) - (tripToDelete.fare || 0),
            totalDistance: (tripToDelete.totalDistance || 0) - (tripToDelete.distance || 0),
            tripCount: (tripToDelete.tripCount || 1) - 1,
        });

        // 3. تحديث قائمة الرحلات المحلية (Local update)
        allTrips = allTrips.filter(t => t.id !== tripId);

        // 4. إعادة رسم القائمة
        renderTrips();
        showNotification("🗑️ تم حذف الرحلة بنجاح.", 'success');

    } catch (error) {
        console.error("❌ خطأ في حذف الرحلة:", error);
        showNotification(`❌ فشل الحذف: ${error.message || "خطأ غير معروف"}`, 'error');
    }
    safeHideLoader();
}


// -------------------- معالجات الأحداث والتهيئة --------------------

function handleEditClick(event) {
    const tripId = event.currentTarget.dataset.id;
    const trip = allTrips.find(t => t.id === tripId);
    if (trip) {
        openEditModal(trip);
    }
}

function handleDeleteClick(event) {
    const tripId = event.currentTarget.dataset.id;
    deleteTrip(tripId);
}

function handleSaveEdit() {
    if (!currentEditTrip) return;

    const newFare = parseFloat(elements.editFareInput.value);
    
    if (isNaN(newFare) || newFare < 0) {
        showNotification("⚠️ قيمة الأجرة غير صالحة.", 'error');
        return;
    }
    
    updateTrip(currentEditTrip.id, newFare);
}

function initializeReports() {
    // ربط أحداث المودال
    if (elements.editSaveBtn) elements.editSaveBtn.addEventListener('click', handleSaveEdit);
    if (elements.editCancelBtn) elements.editCancelBtn.addEventListener('click', closeEditModal);

    fetchTrips();
}

document.addEventListener('DOMContentLoaded', initializeReports);