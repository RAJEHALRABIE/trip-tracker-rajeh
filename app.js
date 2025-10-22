import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, getDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// تكوين Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA4kGynSyqJmUHzHbuRNPWzDFWHGGT4",
  authDomain: "trip-tracker-rajeh.firebaseapp.com",
  projectId: "trip-tracker-rajeh",
  storageBucket: "trip-tracker-rajeh.appspot.com",
  messagingSenderId: "1025723412931",
  appId: "1:1025723412931:web:53a9fa6e1a7a5f43a3dbec",
  measurementId: "G-J1RBF8H0CC"
};

// التهيئة
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

// العناصر
const elements = {
  startShiftBtn: document.getElementById('startShiftBtn'),
  endShiftBtn: document.getElementById('endShiftBtn'),
  startTripBtn: document.getElementById('startTripBtn'),
  endTripBtn: document.getElementById('endTripBtn'),
  // عناصر حالة الشفت
  noShiftState: document.getElementById('noShiftState'), 
  activeShiftState: document.getElementById('activeShiftState'),
  pauseShiftBtn: document.getElementById('pauseShiftBtn'),
  activeTripState: document.getElementById('activeTripState'),

  // معلومات الشفت
  shiftTime: document.getElementById('shiftTime'),
  shiftTripCount: document.getElementById('shiftTripCount'),
  shiftIncome: document.getElementById('shiftIncome'),
  shiftDistance: document.getElementById('shiftDistance'),
  shiftLiveIndicator: document.getElementById('shift-live-indicator'),
  shiftStatusText: document.getElementById('shift-status-text'),
  shiftStatsSection: document.getElementById('shift-stats-section'),
  currentTripDistance: document.getElementById('currentTripDistance'),

  // الإحصائيات الكلية
  totalIncome: document.getElementById('totalIncome'),
  totalDistance: document.getElementById('totalDistance'),
  totalTrips: document.getElementById('totalTrips'), 

  // اللودر والإشعارات
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
    elements.loadingOverlay.querySelector('p').textContent = message;
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
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '💡'}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;
  
  // إضافة الأنماط (تعتمد على وجود الأنماط في style.css)
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


// -------------------- إدارة الحالة --------------------

// تحديث الإحصائيات الكلية في الواجهة
function updateGlobalStatsDisplay(stats) {
  stats = stats || {}; 
  elements.totalIncome.textContent = `${formatNumber(stats.totalIncome || 0)} ر.س`;
  elements.totalDistance.textContent = `${formatNumber(stats.totalDistance || 0)} كم`;
  elements.totalTrips.textContent = `${formatNumber(stats.totalTrips || 0)} رحلات`;
}

// دالة لجلب حالة الشفت من Firestore
async function getShift() {
  try {
    // يجب فحص هذا الاستعلام جيداً
    const q = query(state.shiftsRef, where("isActive", "==", true));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const shiftDoc = querySnapshot.docs[0];
      return { id: shiftDoc.id, data: shiftDoc.data() };
    }
    return { id: null, data: null };
  } catch (error) {
    console.error("❌ خطأ في جلب الشفت النشط:", error);
    showNotification("فشل جلب الشفت النشط. تأكد من اتصالك بالشبكة وإعدادات Firebase.", 'error');
    return { id: null, data: null };
  }
}

// دالة لجلب الإحصائيات الكلية (يجب استيراد getDoc)
async function getGlobalStats() {
  try {
    const statsDoc = await getDoc(state.statsRef);
    return statsDoc.exists() ? statsDoc.data() : { totalIncome: 0, totalDistance: 0, totalTrips: 0 };
  } catch (error) {
    console.error("❌ خطأ في جلب الإحصائيات الكلية:", error);
    return { totalIncome: 0, totalDistance: 0, totalTrips: 0 };
  }
}

// دالة لفحص حالة الشفت وتحديث الواجهة
async function checkShiftStatus() {
  safeShowLoader("جاري فحص حالة الشفت...");
  try {
    const shift = await getShift();
    const stats = await getGlobalStats();
    
    updateGlobalStatsDisplay(stats);

    if (shift.data) {
      state.currentShift = shift.data;
      state.currentShift.id = shift.id;
      state.shiftStartTime = state.currentShift.startTime.toDate();
      state.isPaused = state.currentShift.isPaused || false;
      
      // فحص حالة الرحلة
      if (state.currentShift.currentTripId) {
        const tripQ = query(state.tripsRef, where("shiftId", "==", state.currentShift.id), where("isActive", "==", true));
        const tripSnapshot = await getDocs(tripQ);
        if (!tripSnapshot.empty) {
          state.currentTrip = { id: tripSnapshot.docs[0].id, data: tripSnapshot.docs[0].data() };
          state.tripStartTime = state.currentTrip.data.startTime.toDate();
          updateUIForActiveTrip();
        } else {
          state.currentTrip = null;
          updateUIForActiveShift();
        }
      } else {
        state.currentTrip = null;
        updateUIForActiveShift();
      }
    } else {
      // لا يوجد شفت نشط
      state.currentShift = null;
      state.currentTrip = null;
      updateUIForNoShift();
    }
  } catch (e) {
      console.error("خطأ في checkShiftStatus:", e);
      showNotification(`❌ فشل فحص حالة الشفت: ${e.message}`, 'error');
  }
  safeHideLoader();
  
  // بدء مؤقت الشفت
  if (state.currentShift && !state.isPaused) {
    startShiftTimer();
  }
}


// -------------------- تحديثات الواجهة --------------------

function updateUIForNoShift() {
  if (!elements.noShiftState || !elements.activeShiftState) return; // حماية إضافية
  
  elements.noShiftState.style.display = 'block';
  elements.activeShiftState.style.display = 'none';

  elements.shiftStatsSection.style.display = 'none';
  clearInterval(state.intervalId);

  elements.shiftTime.textContent = '00:00:00';
  elements.shiftTripCount.textContent = '0';
  elements.shiftIncome.textContent = '0 ر.س';
  elements.shiftDistance.textContent = '0 كم';
}

function updateUIForActiveShift() {
  if (!state.currentShift || !elements.noShiftState || !elements.activeShiftState) return;
  
  elements.noShiftState.style.display = 'none';
  elements.activeShiftState.style.display = 'block';

  elements.shiftStatsSection.style.display = 'block';

  elements.shiftTripCount.textContent = state.currentShift.tripCount || 0;
  elements.shiftIncome.textContent = `${formatNumber(state.currentShift.totalIncome || 0)} ر.س`;
  elements.shiftDistance.textContent = `${formatNumber(state.currentShift.totalDistance || 0)} كم`;

  elements.activeTripState.style.display = 'none';

  // التحكم في أزرار الشفت النشط
  if (elements.endShiftBtn) elements.endShiftBtn.style.display = 'block';
  if (elements.startTripBtn) elements.startTripBtn.style.display = 'block';
  if (elements.endTripBtn) elements.endTripBtn.style.display = 'none';
  
  // زر الإيقاف المؤقت
  if (elements.pauseShiftBtn) {
    elements.pauseShiftBtn.textContent = state.isPaused ? 'استئناف الشفت' : 'إيقاف مؤقت';
    elements.pauseShiftBtn.className = state.isPaused ? 'btn btn-orange' : 'btn btn-secondary';
  }
  if (elements.shiftStatusText) {
      elements.shiftStatusText.textContent = state.isPaused ? 'شفت متوقف مؤقتًا' : 'شفت نشط';
  }

  // تحديث المؤشر الحي
  if (elements.shiftLiveIndicator) {
      elements.shiftLiveIndicator.classList.toggle('paused', state.isPaused);
      elements.shiftLiveIndicator.classList.toggle('live', !state.isPaused);
  }
  
  if (!state.isPaused) {
    startShiftTimer();
  } else {
    clearInterval(state.intervalId);
    updateShiftTimeDisplay();
  }
}

function updateUIForActiveTrip() {
  updateUIForActiveShift();
  
  if (elements.activeTripState) {
    elements.activeTripState.style.display = 'block';
  }
  if (elements.currentTripDistance && state.currentTrip) {
    elements.currentTripDistance.textContent = `${formatNumber(state.currentTrip.data.distance || 0)} كم`;
  }
  
  // تعديل الأزرار
  if (elements.startTripBtn) elements.startTripBtn.style.display = 'none';
  if (elements.pauseShiftBtn) elements.pauseShiftBtn.style.display = 'none';
  if (elements.endTripBtn) elements.endTripBtn.style.display = 'block';
}


// -------------------- منطق الشفت/الرحلة --------------------

function startShiftTimer() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
  }
  
  if (!(state.shiftStartTime instanceof Date) || isNaN(state.shiftStartTime)) {
    // محاولة تحويل timestamp إلى Date
    if (state.shiftStartTime && state.shiftStartTime.seconds) {
      state.shiftStartTime = new Date(state.shiftStartTime.seconds * 1000);
    } else {
      return; // توقف إذا لم يكن هناك وقت بدء صالح
    }
  }

  state.intervalId = setInterval(() => {
    if (!state.isPaused) {
      updateShiftTimeDisplay();
    }
  }, 1000);
}

function updateShiftTimeDisplay() {
  if (!state.shiftStartTime) return;
  const now = new Date();
  const timeDifferenceMs = now.getTime() - state.shiftStartTime.getTime();
  const totalSeconds = Math.floor(timeDifferenceMs / 1000);
  elements.shiftTime.textContent = formatTime(totalSeconds);
}

// -------------------- وظائف الأزرار (المكتملة والأساسية) --------------------

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
    
    const docRef = await addDoc(state.shiftsRef, newShift);
    
    state.currentShift = newShift;
    state.currentShift.id = docRef.id;
    state.shiftStartTime = newShift.startTime;
    state.isPaused = false;
    
    updateUIForActiveShift();
    showNotification("✅ تم بدء الشفت بنجاح.", 'success');

  } catch (error) {
    console.error("❌ خطأ في بدء الشفت:", error);
    // رسالة الخطأ هذه مهمة جداً للكشف عن مشاكل Firebase
    showNotification(`❌ فشل بدء الشفت. قد تكون مشكلة في Firebase: ${error.message || "خطأ غير معروف"}`, 'error');
  }
  safeHideLoader();
}

// وظيفة إنهاء الشفت (Stub)
async function endShift() {
    showNotification("🚧 وظيفة إنهاء الشفت قيد التطوير...", 'info');
    // هنا سيتم تنفيذ منطق إنهاء الشفت وحفظ البيانات
}

// وظيفة بدء الرحلة (Stub)
async function startTrip() {
    showNotification("🚧 وظيفة بدء الرحلة قيد التطوير...", 'info');
    // هنا سيتم تنفيذ منطق بدء الرحلة
}

// وظيفة إنهاء الرحلة (Stub)
async function endTrip() {
    showNotification("🚧 وظيفة إنهاء الرحلة قيد التطوير...", 'info');
    // هنا سيتم تنفيذ منطق إنهاء الرحلة
}

// وظيفة الإيقاف المؤقت/الاستئناف (Stub)
async function togglePauseShift() {
    // هذا الجزء يعمل لعرض حالة الإيقاف المؤقت/الاستئناف محلياً
    state.isPaused = !state.isPaused;
    showNotification(state.isPaused ? "✅ تم إيقاف الشفت مؤقتاً." : "✅ تم استئناف الشفت.", 'success');
    updateUIForActiveShift();
    // يجب إضافة منطق تحديث Firebase هنا لاحقاً
}


// -------------------- معالجات الأحداث والتهيئة --------------------

function initializeApp() {
  try {
    // 1. فحص حالة الشفت الحالية والتحميل الأولي للإحصائيات
    checkShiftStatus();

    // 2. ربط الأحداث بالأزرار (مع التحقق من وجود العنصر)
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
      // هذا الإشعار يظهر عند وجود خطأ في تحميل السكريبت أو التهيئة الأولية (مثل خطأ في الاستيراد)
      showNotification(`❌ خطأ فادح أثناء التحميل. تحقق من ملف app.js: ${e.message}`, 'error');
  }
}

// تشغيل التهيئة
document.addEventListener('DOMContentLoaded', initializeApp);