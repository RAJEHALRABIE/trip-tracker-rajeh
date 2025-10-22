// ** app.js - الكود الموحد والمصحح **
// تم إزالة تهيئة Firebase واستبدالها بالاستيراد من firebase-config.js

import { 
    db, collection, addDoc, updateDoc, doc, getDocs, query, where, getDoc
} from "./firebase-config.js"; 

// المتغيرات العامة
let state = {
  currentShift: null,
  currentTrip: null,
  shiftStartTime: null,
  tripStartTime: null,
  intervalId: null,
  shiftsRef: collection(db, "shifts"),
  tripsRef: collection(db, "trips"),
  statsRef: doc(db, "stats", "global"),
  isPaused: false,
};

// العناصر (يتم جلبها مرة واحدة)
const elements = {
  startShiftBtn: document.getElementById('startShiftBtn'),
  endShiftBtn: document.getElementById('endShiftBtn'),
  startTripBtn: document.getElementById('startTripBtn'),
  endTripBtn: document.getElementById('endTripBtn'),
  noShiftState: document.getElementById('noShiftState'), 
  activeShiftState: document.getElementById('activeShiftState'),
  pauseShiftBtn: document.getElementById('pauseShiftBtn'),
  activeTripState: document.getElementById('activeTripState'),
  shiftTime: document.getElementById('shiftTime'),
  shiftTripCount: document.getElementById('shiftTripCount'),
  shiftIncome: document.getElementById('shiftIncome'),
  shiftDistance: document.getElementById('shiftDistance'),
  shiftLiveIndicator: document.getElementById('shift-live-indicator'),
  shiftStatusText: document.getElementById('shift-status-text'),
  shiftStatsSection: document.getElementById('shift-stats-section'),
  currentTripDistance: document.getElementById('currentTripDistance'),
  totalIncome: document.getElementById('totalIncome'),
  totalDistance: document.getElementById('totalDistance'),
  loadingOverlay: document.getElementById('loading-overlay'),
};

// -------------------- الوظائف المساعدة --------------------
function formatTime(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(v => v < 10 ? '0' + v : v).join(':');
}
function formatNumber(number) {
  return (number || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function safeShowLoader(message = 'جاري التحميل…') {
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
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '💡'}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;
  
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


// -------------------- إدارة الحالة وتحديث الواجهة --------------------
function updateGlobalStatsDisplay(stats) {
  stats = stats || {}; 
  if (elements.totalIncome) elements.totalIncome.textContent = `${formatNumber(stats.totalIncome || 0)} ر.س`;
  if (elements.totalDistance) elements.totalDistance.textContent = `${formatNumber(stats.totalDistance || 0)} كم`;
}
async function getShift() {
  try {
    const q = query(state.shiftsRef, where("isActive", "==", true));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const shiftDoc = querySnapshot.docs[0];
      return { id: shiftDoc.id, data: shiftDoc.data() };
    }
    return { id: null, data: null };
  } catch (error) {
    console.error("❌ خطأ في جلب الشفت النشط:", error);
    showNotification("فشل جلب الشفت النشط. تحقق من اتصالك أو إعدادات Firebase.", 'error');
    return { id: null, data: null };
  }
}
async function getGlobalStats() {
  try {
    const statsDoc = await getDoc(state.statsRef);
    return statsDoc.exists() ? statsDoc.data() : { totalIncome: 0, totalDistance: 0, totalTrips: 0 };
  } catch (error) {
    console.error("❌ خطأ في جلب الإحصائيات الكلية:", error);
    return { totalIncome: 0, totalDistance: 0, totalTrips: 0 };
  }
}
async function checkShiftStatus() {
  safeShowLoader("جاري فحص حالة الشفت...");
  try {
    const shift = await getShift();
    const stats = await getGlobalStats();
    
    updateGlobalStatsDisplay(stats);

    if (shift.data) {
      state.currentShift = shift.data;
      state.currentShift.id = shift.id;
      state.shiftStartTime = state.currentShift.startTime && state.currentShift.startTime.toDate ? state.currentShift.startTime.toDate() : new Date();
      state.isPaused = state.currentShift.isPaused || false;
      
      updateUIForActiveShift();
    } else {
      state.currentShift = null;
      state.currentTrip = null;
      updateUIForNoShift();
    }
  } catch (e) {
      console.error("خطأ في checkShiftStatus:", e);
      showNotification(`❌ فشل فحص حالة الشفت الأولي: ${e.message}`, 'error');
  }
  safeHideLoader();
}
function updateUIForNoShift() {
  if (elements.noShiftState) elements.noShiftState.style.display = 'block';
  if (elements.activeShiftState) elements.activeShiftState.style.display = 'none';

  if (elements.shiftStatsSection) elements.shiftStatsSection.style.display = 'none';
  clearInterval(state.intervalId);

  if (elements.shiftTime) elements.shiftTime.textContent = '00:00:00';
}
function updateUIForActiveShift() {
  if (!state.currentShift) return;
  
  if (elements.noShiftState) elements.noShiftState.style.display = 'none';
  if (elements.activeShiftState) elements.activeShiftState.style.display = 'block';

  if (elements.shiftStatsSection) elements.shiftStatsSection.style.display = 'block';

  if (elements.shiftTripCount) elements.shiftTripCount.textContent = state.currentShift.tripCount || 0;

  if (elements.activeTripState) elements.activeTripState.style.display = 'none';

  if (elements.endShiftBtn) elements.endShiftBtn.style.display = 'block';
  if (elements.startTripBtn) elements.startTripBtn.style.display = 'block';
  if (elements.endTripBtn) elements.endTripBtn.style.display = 'none'; 
  
  if (elements.pauseShiftBtn) {
    elements.pauseShiftBtn.textContent = state.isPaused ? 'استئناف الشفت' : 'إيقاف مؤقت';
    elements.pauseShiftBtn.className = state.isPaused ? 'btn btn-orange' : 'btn btn-secondary';
  }
}

// -------------------- وظائف الأزرار --------------------
async function startShift() {
  safeShowLoader("جاري بدء شفت جديد...");
  try {
    const newShift = {
      startTime: new Date(),
      endTime: null,
      isActive: true,
      isPaused: false,
      totalIncome: 0,
      totalDistance: 0,
      tripCount: 0,
      currentTripId: null,
    };
    
    // محاولة الاتصال بـ Firebase
    const docRef = await addDoc(state.shiftsRef, newShift);
    
    // التحديث بعد نجاح الاتصال
    state.currentShift = newShift;
    state.currentShift.id = docRef.id;
    state.shiftStartTime = newShift.startTime;
    state.isPaused = false;
    
    updateUIForActiveShift();
    showNotification("✅ تم بدء الشفت بنجاح.", 'success');

  } catch (error) {
    console.error("❌ خطأ في بدء الشفت (Firebase/Network):", error);
    showNotification(`❌ فشل بدء الشفت. تأكد من اتصالك أو إعدادات Firebase: ${error.message || "خطأ غير معروف"}`, 'error');
  }
  safeHideLoader();
}

// وظائف الأزرار الأخرى (Stubs)
async function endShift() { showNotification("🚧 إنهاء الشفت قيد التطوير...", 'info'); updateUIForNoShift(); }
async function startTrip() { 
    showNotification("🚧 بدء الرحلة قيد التطوير...", 'info');
    if(elements.endTripBtn) elements.endTripBtn.style.display = 'block';
    if(elements.startTripBtn) elements.startTripBtn.style.display = 'none';
    if(elements.activeTripState) elements.activeTripState.style.display = 'block';
}
async function endTrip() { 
    showNotification("🚧 إنهاء الرحلة قيد التطوير...", 'info'); 
    if(elements.endTripBtn) elements.endTripBtn.style.display = 'none';
    if(elements.startTripBtn) elements.startTripBtn.style.display = 'block';
    if(elements.activeTripState) elements.activeTripState.style.display = 'none';
}
async function togglePauseShift() { 
    state.isPaused = !state.isPaused;
    showNotification(state.isPaused ? "✅ تم إيقاف الشفت مؤقتاً." : "✅ تم استئناف الشفت.", 'success');
    updateUIForActiveShift();
}


// -------------------- معالجات الأحداث والتهيئة --------------------

function initializeApp() {
  try {
    checkShiftStatus();

    // ربط الأحداث بالأزرار (هذا هو الكود الذي يجب أن يعمل بعد حل خطأ التكرار)
    if (elements.startShiftBtn) {
      elements.startShiftBtn.addEventListener('click', startShift);
    }
    if (elements.endShiftBtn) {
      elements.endShiftBtn.addEventListener('click', endShift);
    }
    if (elements.startTripBtn) {
      elements.startTripBtn.addEventListener('click', startTrip);
    }
    if (elements.endTripBtn) {
      elements.endTripBtn.addEventListener('click', endTrip);
    }
    if (elements.pauseShiftBtn) {
      elements.pauseShiftBtn.addEventListener('click', togglePauseShift);
    }
    
  } catch (e) {
      console.error("❌ خطأ فادح أثناء تهيئة التطبيق:", e);
      showNotification(`❌ خطأ فادح أثناء التحميل. تحقق من ملف app.js: ${e.message}`, 'error');
  }
}

// تشغيل التهيئة
document.addEventListener('DOMContentLoaded', initializeApp);