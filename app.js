import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, onSnapshot,
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
  // عناصر حالة الشفت (جديدة/مضافة)
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
  totalTrips: document.getElementById('totalTrips'), // افتراض وجودها في index.html

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
  
  // إضافة الأنماط
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    left: 20px;
    right: 20px;
    background: ${type === 'success' ? 'var(--green)' : type === 'error' ? 'var(--red)' : 'var(--orange)'};
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
    const q = query(state.shiftsRef, where("isActive", "==", true));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const shiftDoc = querySnapshot.docs[0];
      return { id: shiftDoc.id, data: shiftDoc.data() };
    }
    return { id: null, data: null };
  } catch (error) {
    console.error("❌ خطأ في جلب الشفت النشط:", error);
    showNotification("فشل جلب الشفت النشط. تأكد من اتصالك بالشبكة.", 'error');
    return { id: null, data: null };
  }
}

// دالة لجلب الإحصائيات الكلية
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
      // إذا كان هناك رحلة نشطة
      const tripQ = query(state.tripsRef, where("shiftId", "==", state.currentShift.id), where("isActive", "==", true));
      const tripSnapshot = await getDocs(tripQ);
      if (!tripSnapshot.empty) {
        state.currentTrip = { id: tripSnapshot.docs[0].id, data: tripSnapshot.docs[0].data() };
        state.tripStartTime = state.currentTrip.data.startTime.toDate();
        updateUIForActiveTrip();
      } else {
        // حالة شفت نشط لكن بدون رحلة نشطة (خطأ في البيانات أو تم إنهاء الرحلة بنجاح)
        state.currentTrip = null;
        updateUIForActiveShift();
      }
    } else {
      // شفت نشط بدون رحلة
      state.currentTrip = null;
      updateUIForActiveShift();
    }
  } else {
    // لا يوجد شفت نشط
    state.currentShift = null;
    state.currentTrip = null;
    updateUIForNoShift();
  }

  safeHideLoader();
  // بدء مؤقت الشفت
  if (state.currentShift && !state.isPaused) {
    startShiftTimer();
  }
}


// -------------------- تحديثات الواجهة --------------------

// تحديث الواجهة لحالة لا يوجد شفت
function updateUIForNoShift() {
  // /////////////////////////////////////////
  // إصلاح منطق عرض/إخفاء الحاويات
  elements.noShiftState.style.display = 'block';
  elements.activeShiftState.style.display = 'none';
  // /////////////////////////////////////////

  // إخفاء قسم إحصائيات الشفت
  elements.shiftStatsSection.style.display = 'none';
  clearInterval(state.intervalId);

  // إعادة ضبط قيم الشفت
  elements.shiftTime.textContent = '00:00:00';
  elements.shiftTripCount.textContent = '0';
  elements.shiftIncome.textContent = '0 ر.س';
  elements.shiftDistance.textContent = '0 كم';
}

// تحديث الواجهة لحالة شفت نشط
function updateUIForActiveShift() {
  if (!state.currentShift) return;
  
  // /////////////////////////////////////////
  // إصلاح منطق عرض/إخفاء الحاويات
  elements.noShiftState.style.display = 'none';
  elements.activeShiftState.style.display = 'block';
  // /////////////////////////////////////////

  // إظهار قسم إحصائيات الشفت
  elements.shiftStatsSection.style.display = 'block';

  // تحديث إحصائيات الشفت
  elements.shiftTripCount.textContent = state.currentShift.tripCount || 0;
  elements.shiftIncome.textContent = `${formatNumber(state.currentShift.totalIncome || 0)} ر.س`;
  elements.shiftDistance.textContent = `${formatNumber(state.currentShift.totalDistance || 0)} كم`;

  // إخفاء حالة الرحلة النشطة
  elements.activeTripState.style.display = 'none';

  // التحكم في أزرار الشفت النشط
  elements.endShiftBtn.style.display = 'block';
  elements.startTripBtn.style.display = 'block';
  elements.endTripBtn.style.display = 'none';
  
  // زر الإيقاف المؤقت
  elements.pauseShiftBtn.textContent = state.isPaused ? 'استئناف الشفت' : 'إيقاف مؤقت';
  elements.pauseShiftBtn.className = state.isPaused ? 'btn btn-orange' : 'btn btn-secondary';
  elements.shiftStatusText.textContent = state.isPaused ? 'شفت متوقف مؤقتًا' : 'شفت نشط';

  // تحديث المؤشر الحي
  elements.shiftLiveIndicator.classList.toggle('paused', state.isPaused);
  elements.shiftLiveIndicator.classList.toggle('live', !state.isPaused);
  
  // بدء المؤقت إذا لم يكن متوقفًا
  if (!state.isPaused) {
    startShiftTimer();
  } else {
    clearInterval(state.intervalId);
    updateShiftTimeDisplay(); // لتحديث الوقت الثابت
  }
}

// تحديث الواجهة لحالة رحلة نشطة
function updateUIForActiveTrip() {
  updateUIForActiveShift(); // نبدأ من حالة الشفت النشط
  
  // إظهار حالة الرحلة
  elements.activeTripState.style.display = 'block';
  elements.currentTripDistance.textContent = `${formatNumber(state.currentTrip.data.distance || 0)} كم`;
  
  // تعديل الأزرار
  elements.startTripBtn.style.display = 'none';
  elements.pauseShiftBtn.style.display = 'none'; // لا يمكن إيقاف الشفت أثناء الرحلة
  elements.endTripBtn.style.display = 'block';
}


// -------------------- منطق الشفت/الرحلة --------------------

// مؤقت الشفت
function startShiftTimer() {
  if (state.intervalId) {
    clearInterval(state.intervalId);
  }
  
  // التأكد من أن وقت البدء هو كائن Date
  if (!(state.shiftStartTime instanceof Date) || isNaN(state.shiftStartTime)) {
    // محاولة تحويل timestamp إلى Date إذا لم يكن كذلك
    state.shiftStartTime = new Date(state.shiftStartTime.seconds * 1000);
  }

  state.intervalId = setInterval(() => {
    if (!state.isPaused) {
      updateShiftTimeDisplay();
    }
  }, 1000);
}

// عرض وقت الشفت
function updateShiftTimeDisplay() {
  if (!state.shiftStartTime) return;
  const now = new Date();
  // حساب فرق التوقيت بالمللي ثانية
  const timeDifferenceMs = now.getTime() - state.shiftStartTime.getTime();
  const totalSeconds = Math.floor(timeDifferenceMs / 1000);
  elements.shiftTime.textContent = formatTime(totalSeconds);
}

// بدء الشفت
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
    
    // إضافة الشفت إلى Firebase
    const docRef = await addDoc(state.shiftsRef, newShift);
    
    // تحديث الحالة المحلية
    state.currentShift = newShift;
    state.currentShift.id = docRef.id;
    state.shiftStartTime = newShift.startTime;
    state.isPaused = false;
    
    // تحديث الواجهة
    updateUIForActiveShift();
    showNotification("✅ تم بدء الشفت بنجاح.", 'success');

  } catch (error) {
    console.error("❌ خطأ في بدء الشفت:", error);
    // /////////////////////////////////////////
    // إضافة إشعار واضح عند الفشل
    showNotification(`❌ فشل بدء الشفت: ${error.message || "خطأ غير معروف"}`, 'error');
    // /////////////////////////////////////////
  }
  safeHideLoader();
}

// -------------------- معالجات الأحداث --------------------

function initializeApp() {
  checkShiftStatus();

  // ربط الأحداث بالأزرار
  elements.startShiftBtn.addEventListener('click', startShift);
  // (هنا يمكن إضافة باقي معالجات الأزرار: endShift, startTrip, endTrip, pauseShift)
  
  // لضمان التحديث في الخلفية، استخدام onSnapshot أفضل ولكن نعتمد على checkShiftStatus للتحديث الأساسي.
}

// تشغيل التهيئة
document.addEventListener('DOMContentLoaded', initializeApp);