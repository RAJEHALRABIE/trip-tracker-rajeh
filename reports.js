import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getFirestore, collection, getDocs, query, orderBy, doc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

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
  loading: document.getElementById('loading-overlay'),
  list: document.getElementById('trips-list'),
  empty: document.getElementById('empty-state'),
  editModal: document.getElementById('edit-modal'),
  editFareInput: document.getElementById('edit-fare'),
  editSaveBtn: document.getElementById('edit-save'),
  editCancelBtn: document.getElementById('edit-cancel'),
};

let allTrips = [];
let currentEdit = null;

document.addEventListener('DOMContentLoaded', initializeReports);

function initializeReports() {
  safeShowLoader("جاري تحميل التقارير...");
  loadAllTrips().finally(safeHideLoader);
  bindEditModal();
}

async function loadAllTrips() {
  try {
    allTrips = [];
    const shiftsRef = collection(db, 'shifts');
    const snapshot = await getDocs(shiftsRef);

    for (const d of snapshot.docs) {
      const shiftId = d.id;
      const tripsRef = collection(db, 'shifts', shiftId, 'trips');
      const tripsSnap = await getDocs(tripsRef);
      
      tripsSnap.forEach(tdoc => {
        const data = tdoc.data();
        allTrips.push({
          shiftId,
          tripId: tdoc.id,
          status: data.status || 'completed',
          fare: Number(data.fare || 0),
          startTime: data.startTime || null,
          endTime: data.endTime || null,
          distanceMeters: Number(data.distanceMeters || 0),
          durationSeconds: Number(data.durationSeconds || 0),
          startLocation: data.startLocation || null,
          endLocation: data.endLocation || null,
        });
      });
    }

    allTrips.sort((a,b) => {
      const ta = toDateSafe(a.endTime || a.startTime).getTime();
      const tb = toDateSafe(b.endTime || b.startTime).getTime();
      return tb - ta;
    });

    renderTrips(allTrips);
  } catch (e) {
    console.error("❌ خطأ في تحميل الرحلات:", e);
    showEmpty("فشل تحميل البيانات. حاول لاحقًا.");
  }
}

function renderTrips(trips) {
  if (!elements.list) return;
  elements.list.innerHTML = '';

  if (!trips || trips.length === 0) {
    showEmpty("لا توجد رحلات مسجلة بعد.");
    return;
  }
  hideEmpty();

  trips.forEach(t => {
    const date = toDateSafe(t.startTime);
    const end = toDateSafe(t.endTime);
    const duration = formatDuration(t.durationSeconds || 0, 'full');
    const km = (t.distanceMeters || 0) / 1000;
    const statusClass = (t.status === 'completed') ? 'completed' : 'active';

    const card = document.createElement('div');
    card.className = 'trip-card';
    
    card.innerHTML = `
      <div class="trip-card-header">
        <div>
          <div class="trip-fare">${Number(t.fare || 0).toFixed(2)} ر.س</div>
          <small>${date.toLocaleDateString('ar-SA')} • ${date.toLocaleTimeString('ar-SA')}</small>
        </div>
        <div class="trip-status ${statusClass}">${t.status === 'completed' ? 'مكتملة' : 'نشطة'}</div>
      </div>
      <div class="trip-card-body">
        <div>
          <span>المدة:</span>
          <strong>${duration}</strong>
        </div>
        <div>
          <span>المسافة:</span>
          <strong>${km.toFixed(2)} كم</strong>
        </div>
        <div>
          <span>وقت البدء:</span>
          <strong>${date.toLocaleTimeString('ar-SA')}</strong>
        </div>
        <div>
          <span>وقت الانتهاء:</span>
          <strong>${end.toLocaleTimeString('ar-SA')}</strong>
        </div>
      </div>
      <div class="trip-card-actions">
        <button class="btn btn-secondary btn-edit">
          <img src="assets/icons/edit.png" alt="تعديل" width="18" height="18">
          تعديل
        </button>
        <button class="btn btn-secondary btn-details">
          <img src="assets/icons/details.png" alt="تفاصيل" width="18" height="18">
          تفاصيل
        </button>
      </div>
    `;

    card.querySelector('.btn-edit')?.addEventListener('click', () => {
      openEditModal({ shiftId: t.shiftId, tripId: t.tripId, fare: t.fare });
    });

    card.querySelector('.btn-details')?.addEventListener('click', () => {
      showTripDetails(t);
    });

    elements.list.appendChild(card);
  });
}

function bindEditModal() {
  if (!elements.editModal) return;
  elements.editCancelBtn?.addEventListener('click', closeEditModal);
  elements.editSaveBtn?.addEventListener('click', saveTripChanges);
  
  elements.editModal?.addEventListener('click', (e) => {
    if (e.target === elements.editModal) {
      closeEditModal();
    }
  });
}

function openEditModal({ shiftId, tripId, fare }) {
  currentEdit = { shiftId, tripId, fare: Number(fare || 0) };
  if (elements.editFareInput) {
    elements.editFareInput.value = String(currentEdit.fare.toFixed(2));
    elements.editFareInput.focus();
  }
  if (elements.editModal) elements.editModal.classList.add('show');
}

function closeEditModal() {
  currentEdit = null;
  if (elements.editModal) elements.editModal.classList.remove('show');
}

async function saveTripChanges() {
  try {
    if (!currentEdit) return;
    const newFare = Number((elements.editFareInput?.value || '').trim());
    
    if (Number.isNaN(newFare) || newFare < 0) {
      alert("أدخل قيمة أجرة صحيحة.");
      return;
    }
    
    if (newFare > 10000) {
      alert("القيمة المدخلة كبيرة جداً.");
      return;
    }
    
    safeShowLoader("جاري حفظ التعديلات...");

    const tripRef = doc(db, 'shifts', currentEdit.shiftId, 'trips', currentEdit.tripId);
    await updateDoc(tripRef, { 
      fare: newFare,
      updatedAt: new Date()
    });

    await recalculateShiftTotals(currentEdit.shiftId);

    await loadAllTrips();
    closeEditModal();
    
    showNotification("تم تحديث الرحلة بنجاح!", "success");
  } catch (e) {
    console.error("❌ خطأ أثناء حفظ التعديلات:", e);
    showNotification("فشل حفظ التعديلات. حاول لاحقًا.", "error");
  } finally {
    safeHideLoader();
  }
}

async function recalculateShiftTotals(shiftId) {
  try {
    const tripsRef = collection(db, 'shifts', shiftId, 'trips');
    const snap = await getDocs(tripsRef);
    let totalIncome = 0;
    let totalDistance = 0;
    let totalTripTimeSeconds = 0;
    let tripCount = 0;

    snap.forEach(docu => {
      const t = docu.data();
      if (t.status === 'completed') {
        tripCount += 1;
        totalIncome += Number(t.fare || 0);
        totalDistance += Number(t.distanceMeters || 0);
        totalTripTimeSeconds += Number(t.durationSeconds || 0);
      }
    });

    const shiftRef = doc(db, 'shifts', shiftId);
    await updateDoc(shiftRef, {
      totalIncome,
      totalDistance: totalDistance / 1000,
      totalTripTimeSeconds,
      tripCount,
      lastUpdated: new Date()
    });
  } catch (e) {
    console.error("❌ خطأ في إعادة الحساب:", e);
    throw e;
  }
}

function showTripDetails(trip) {
  const startTime = toDateSafe(trip.startTime);
  const endTime = toDateSafe(trip.endTime);
  const duration = formatDuration(trip.durationSeconds || 0, 'full');
  const km = (trip.distanceMeters || 0) / 1000;
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay show';
  modal.innerHTML = `
    <div class="stats-card" style="max-width:500px; width:90%; max-height:80vh; overflow-y:auto;">
      <h2 class="card-title">
        <img src="assets/icons/details.png" alt="تفاصيل" width="24" height="24">
        تفاصيل الرحلة
      </h2>
      <div style="line-height: 1.8; font-size: 1rem;">
        <div><strong>💰 الأجرة:</strong> ${trip.fare.toFixed(2)} ر.س</div>
        <div><strong>📏 المسافة:</strong> ${km.toFixed(2)} كم</div>
        <div><strong>⏱️ المدة:</strong> ${duration}</div>
        <div><strong>🕐 وقت البدء:</strong> ${startTime.toLocaleString('ar-SA')}</div>
        <div><strong>🕓 وقت الانتهاء:</strong> ${endTime.toLocaleString('ar-SA')}</div>
        <div><strong>📍 الحالة:</strong> ${trip.status === 'completed' ? 'مكتملة' : 'نشطة'}</div>
        
        ${trip.startLocation ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
          <strong>📍 الموقع البدائي:</strong><br>
          خط العرض: ${trip.startLocation.lat?.toFixed(6)}<br>
          خط الطول: ${trip.startLocation.lng?.toFixed(6)}
        </div>
        ` : ''}
        
        ${trip.endLocation ? `
        <div style="margin-top: 10px;">
          <strong>🎯 الموقع النهائي:</strong><br>
          خط العرض: ${trip.endLocation.lat?.toFixed(6)}<br>
          خط الطول: ${trip.endLocation.lng?.toFixed(6)}
        </div>
        ` : ''}
      </div>
      <div style="display:flex; gap:10px; margin-top:20px; justify-content:flex-end;">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">إغلاق</button>
      </div>
    </div>
  `;
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  document.body.appendChild(modal);
}

// مساعدات
function toDateSafe(val) {
  try {
    if (!val) return new Date(0);
    if (typeof val.toDate === 'function') return val.toDate();
    return new Date(val);
  } catch {
    return new Date(0);
  }
}

function formatDuration(totalSeconds = 0, format = 'full') {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  if (format === 'full') return [hours, minutes, seconds].map(v => String(v).padStart(2,'0')).join(':');
  return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}`;
}

function showEmpty(msg = "لا توجد رحلات بعد.") {
  if (elements.empty) { 
    elements.empty.textContent = msg; 
    elements.empty.style.display = 'block'; 
  }
}

function hideEmpty() {
  if (elements.empty) elements.empty.style.display = 'none';
}

function safeShowLoader(message = "جاري التحميل...") {
  try {
    if (elements.loading) {
      const p = elements.loading.querySelector('p');
      if (p) p.textContent = message;
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