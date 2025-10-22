import { 
  db, collection, getDocs, query, orderBy, doc, updateDoc 
} from "./firebase-config.js";

const elements = {
  loading: document.getElementById('loading-overlay'),
  list: document.getElementById('trips-list'),
  empty: document.getElementById('empty-state'),
  editModal: document.getElementById('edit-modal'),
  editFareInput: document.getElementById('edit-fare'),
  editSaveBtn: document.getElementById('edit-save'),
  editCancelBtn: document.getElementById('edit-cancel'),
  filterStatus: document.getElementById('filter-status'),
};

let allTrips = [];
let currentEdit = null;

document.addEventListener('DOMContentLoaded', initializeReports);

function initializeReports() {
  safeShowLoader("جاري تحميل التقارير...");
  loadAllTrips().finally(safeHideLoader);
  bindEditModal();
  elements.filterStatus?.addEventListener('change', filterAndRenderTrips);
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
  const s = seconds.toString().padStart(2, '0');

  if (format === 'full') {
    let parts = [];
    if (hours > 0) parts.push(`${hours} ساعة`);
    if (minutes > 0 || hours === 0) parts.push(`${minutes} دقيقة`);
    parts.push(`${seconds} ثانية`);
    return parts.join(', ');
  }
  
  return `${h}:${m}:${s}`;
}


// ====================================================================
//                          📄 وظائف التقارير
// ====================================================================

async function loadAllTrips() {
  try {
    allTrips = [];
    const shiftsRef = collection(db, 'shifts');
    const snapshot = await getDocs(shiftsRef);

    // استخدام Promise.all لجعل جلب الرحلات متوازيًا
    const tripPromises = snapshot.docs.map(async (d) => {
      const shiftId = d.id;
      const tripsRef = collection(db, 'shifts', shiftId, 'trips');
      const tripsSnap = await getDocs(query(tripsRef, orderBy('startTime', 'desc')));
      
      const trips = [];
      tripsSnap.forEach(tdoc => {
        const data = tdoc.data();
        trips.push({
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
      return trips;
    });

    const results = await Promise.all(tripPromises);
    allTrips = results.flat();

    // فرز جميع الرحلات حسب وقت الانتهاء (أو البدء إذا لم تكتمل)
    allTrips.sort((a,b) => {
      const ta = toDateSafe(a.endTime || a.startTime).getTime();
      const tb = toDateSafe(b.endTime || b.startTime).getTime();
      return tb - ta;
    });

    filterAndRenderTrips();
  } catch (e) {
    console.error("❌ خطأ في تحميل الرحلات:", e);
    showEmpty("فشل تحميل البيانات. حاول لاحقًا.");
  }
}

function filterAndRenderTrips() {
  const filter = elements.filterStatus?.value || 'all';
  let filteredTrips = allTrips;

  if (filter !== 'all') {
    filteredTrips = allTrips.filter(t => t.status === filter);
  }

  renderTrips(filteredTrips);
}

function renderTrips(trips) {
  if (!elements.list) return;
  elements.list.innerHTML = '';

  if (!trips || trips.length === 0) {
    showEmpty("لا توجد رحلات مسجلة تطابق التصفية.");
    return;
  }
  hideEmpty();

  trips.forEach(t => {
    const date = toDateSafe(t.startTime);
    const end = t.endTime ? toDateSafe(t.endTime) : null;
    const duration = formatDuration(t.durationSeconds || 0, 'full');
    const km = (t.distanceMeters || 0) / 1000;
    const statusClass = (t.status === 'completed') ? 'completed' : 'active';
    const statusText = (t.status === 'completed') ? 'مكتملة' : 'نشطة';

    const card = document.createElement('div');
    card.className = 'trip-card';
    card.innerHTML = `
      <div class="trip-card-header">
        <div>
          <div class="trip-fare">${Number(t.fare || 0).toFixed(2)} ر.س</div>
          <small>${date.toLocaleDateString('ar-SA')} • ${date.toLocaleTimeString('ar-SA')}</small>
        </div>
        <div class="trip-status ${statusClass}">${statusText}</div>
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
          <span>بداية الرحلة:</span>
          <small>${t.startLocation ? `${t.startLocation.latitude.toFixed(4)}, ${t.startLocation.longitude.toFixed(4)}` : 'غير متوفر'}</small>
        </div>
        <div>
          <span>نهاية الرحلة:</span>
          <small>${t.endLocation ? `${t.endLocation.latitude.toFixed(4)}, ${t.endLocation.longitude.toFixed(4)}` : 'غير متوفر'}</small>
        </div>
      </div>
      ${t.status === 'completed' ? `<div class="trip-card-actions">
        <button class="btn btn-secondary btn-edit" data-trip-id="${t.tripId}" data-shift-id="${t.shiftId}" data-fare="${t.fare}">
          <img src="assets/icons/edit.png" alt="تعديل" width="18" height="18">
          تعديل الأجرة
        </button>
      </div>` : ''}
    `;

    elements.list.appendChild(card);
  });

  // إضافة مستمعي الأحداث لأزرار التعديل
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', handleEditClick);
  });
}

// ====================================================================
//                          ✍️ وظائف التعديل
// ====================================================================

function handleEditClick(event) {
  const btn = event.currentTarget;
  const tripId = btn.dataset.tripId;
  const shiftId = btn.dataset.shiftId;
  const currentFare = parseFloat(btn.dataset.fare);

  currentEdit = { tripId, shiftId, currentFare };

  if (elements.editFareInput) {
    elements.editFareInput.value = currentEdit.currentFare.toFixed(2);
  }
  elements.editModal.style.display = 'flex';
}

function bindEditModal() {
  elements.editSaveBtn?.addEventListener('click', saveEditedFare);
  elements.editCancelBtn?.addEventListener('click', () => {
    elements.editModal.style.display = 'none';
  });
}

async function saveEditedFare() {
  if (!currentEdit) return;

  const newFare = parseFloat(elements.editFareInput?.value);
  if (isNaN(newFare) || newFare < 0) {
    showError('يرجى إدخال قيمة صحيحة للأجرة.');
    return;
  }

  elements.editModal.style.display = 'none';
  safeShowLoader("جاري حفظ التعديل...");

  try {
    const { tripId, shiftId, currentFare } = currentEdit;
    
    // 1. تحديث الرحلة
    const tripRef = doc(db, 'shifts', shiftId, 'trips', tripId);
    await updateDoc(tripRef, {
      fare: newFare,
      lastUpdated: new Date()
    });

    // 2. تحديث الشفت (حساب الفرق وتطبيقه)
    const shiftRef = doc(db, 'shifts', shiftId);
    
    // البحث عن الشفت في قاعدة البيانات للحصول على البيانات الحالية
    const shiftSnap = await getDocs(query(collection(db, 'shifts'), orderBy('startTime', 'desc')));
    const currentShift = shiftSnap.docs.find(d => d.id === shiftId)?.data();

    if (currentShift) {
        const fareDifference = newFare - currentFare;
        const newTotalIncome = (currentShift.totalIncome || 0) + fareDifference;
        
        await updateDoc(shiftRef, {
            totalIncome: newTotalIncome,
            lastUpdated: new Date()
        });
    }

    // 3. تحديث البيانات المحلية وإعادة العرض
    const tripIndex = allTrips.findIndex(t => t.tripId === tripId && t.shiftId === shiftId);
    if (tripIndex !== -1) {
        // تحديث الأجرة في المصفوفة المحلية
        allTrips[tripIndex].fare = newFare;
    }

    filterAndRenderTrips();
    showNotification('تم تحديث الأجرة بنجاح!', 'success');

  } catch (error) {
    console.error("❌ خطأ في حفظ التعديل:", error);
    showError("فشل في حفظ التعديل. حاول مرة أخرى.");
  } finally {
    safeHideLoader();
    currentEdit = null;
  }
}

// ====================================================================
//                        📢 الإشعارات والتحميل
// ====================================================================

function showEmpty(message) {
  if (elements.list && elements.empty) {
    elements.list.style.display = 'none';
    elements.empty.textContent = message;
    elements.empty.style.display = 'block';
  }
}

function hideEmpty() {
  if (elements.list && elements.empty) {
    elements.list.style.display = 'block';
    elements.empty.style.display = 'none';
  }
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

function safeShowLoader(message = 'جاري التحميل...') {
  try {
    if (elements.loading) {
      elements.loading.querySelector('p').textContent = message;
      elements.loading.style.display = 'flex';
      setTimeout(() => {
        elements.loading.classList.add('show');
      }, 10);
    }
  } catch {}
}

function safeHideLoader() {
  try { 
    if (elements.loading) {
      elements.loading.classList.remove('show');
      setTimeout(() => {
        elements.loading.style.display = 'none'; 
      }, 300);
    }
  } catch {}
}