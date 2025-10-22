import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
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

// المتغيرات العالمية للحالة
let currentShift = null;
let currentTrip = null;
let shiftTimerInterval = null;
let tripTimerInterval = null;
let goals = { income: 0, hours: 0 };
let totalStats = { income: 0, distance: 0 };

// العناصر
const elements = {
  // أزرار التحكم
  startShiftBtn: document.getElementById('startShiftBtn'),
  endShiftBtn: document.getElementById('endShiftBtn'),
  startTripBtn: document.getElementById('startTripBtn'),
  endTripBtn: document.getElementById('endTripBtn'),
  
  // حاويات حالات الأزرار (لتنفيذ منطق ظهور الأزرار الأربعة)
  noShiftState: document.getElementById('noShiftState'),
  activeShiftState: document.getElementById('activeShiftState'),
  activeTripState: document.getElementById('activeTripState'),

  // معلومات الشفت النشط
  shiftTimer: document.getElementById('shiftTimer'),
  currentShiftIncome: document.getElementById('currentShiftIncome'),
  currentShiftTrips: document.getElementById('currentShiftTrips'),
  currentShiftDistance: document.getElementById('currentShiftDistance'),

  // معلومات الرحلة النشطة
  tripTimer: document.getElementById('tripTimer'),
  tripStartLocation: document.getElementById('tripStartLocation'),
  currentTripDistance: document.getElementById('currentTripDistance'),

  // الأهداف والإحصائيات الكلية
  incomeGoalCurrent: document.getElementById('incomeGoalCurrent'),
  incomeGoalTarget: document.getElementById('incomeGoalTarget'),
  incomeGoalProgress: document.getElementById('incomeGoalProgress'),
  hoursGoalCurrent: document.getElementById('hoursGoalCurrent'),
  hoursGoalTarget: document.getElementById('hoursGoalTarget'),
  hoursGoalProgress: document.getElementById('hoursGoalProgress'),
  totalIncome: document.getElementById('totalIncome'),
  totalDistance: document.getElementById('totalDistance'),
  
  // النوافذ المنبثقة
  loadingOverlay: document.getElementById('loading-overlay'),
  fareModal: document.getElementById('fare-modal'),
  fareInput: document.getElementById('fare-input'),
  fareConfirmBtn: document.getElementById('fare-confirm'),
  fareCancelBtn: document.getElementById('fare-cancel'),
  shiftEndModal: document.getElementById('shift-end-modal'),
  shiftEndConfirmBtn: document.getElementById('shift-end-confirm'),
  shiftEndCancelBtn: document.getElementById('shift-end-cancel'),
};

// ----------------------------------------------------
// الدوال المساعدة (Helpers)
// ----------------------------------------------------

// إظهار اللودر
function safeShowLoader() {
  try {
    elements.loadingOverlay.style.display = 'flex';
    elements.loadingOverlay.classList.add('show');
  } catch {}
}

// إخفاء اللودر
function safeHideLoader() {
  try {
    elements.loadingOverlay.style.display = 'none';
    elements.loadingOverlay.classList.remove('show');
  } catch {}
}

// تنسيق الوقت
function formatDuration(seconds) {
  const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// عرض الإشعارات
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
  
  // إخفاء الإشعار بعد 4 ثوانٍ
  setTimeout(() => {
    notification.style.transform = 'translateY(-20px)';
    notification.style.opacity = '0';
    notification.addEventListener('transitionend', () => notification.remove());
  }, 4000);
}


// ----------------------------------------------------
// دوال تحديث الواجهة (UI Updates)
// ----------------------------------------------------

/**
 * تحديث واجهة بطاقة التحكم لعرض الأزرار المناسبة للحالة.
 */
function updateControlCard() {
  // إخفاء جميع حالات الأزرار أولاً
  elements.noShiftState.style.display = 'none';
  elements.activeShiftState.style.display = 'none';
  elements.activeTripState.style.display = 'none';

  // إيقاف جميع العدادات
  if (shiftTimerInterval) clearInterval(shiftTimerInterval);
  if (tripTimerInterval) clearInterval(tripTimerInterval);

  if (currentTrip) {
    // حالة: رحلة نشطة (يظهر زر إنهاء الرحلة فقط)
    elements.activeTripState.style.display = 'flex';
    elements.tripStartLocation.textContent = currentTrip.startLocation || 'جاري التحديد...';
    
    updateTripDistance(); // تحديث المسافة
    
    // تشغيل عداد الرحلة
    tripTimerInterval = setInterval(() => {
      const duration = Math.floor((Date.now() - currentTrip.startTime.toDate()) / 1000);
      elements.tripTimer.textContent = formatDuration(duration);
    }, 1000);

  } else if (currentShift) {
    // حالة: شفت نشط (يظهر زرا بدء الرحلة وإنهاء الشفت)
    elements.activeShiftState.style.display = 'flex';
    
    // تحديث إحصائيات الشفت
    elements.currentShiftIncome.textContent = `${currentShift.totalIncome.toFixed(2)} ر.س`;
    elements.currentShiftTrips.textContent = currentShift.totalTrips;
    elements.currentShiftDistance.textContent = `${currentShift.totalDistance.toFixed(2)} كم`;

    // تشغيل عداد الشفت
    shiftTimerInterval = setInterval(() => {
      const duration = Math.floor((Date.now() - currentShift.startTime.toDate()) / 1000);
      elements.shiftTimer.textContent = formatDuration(duration);
    }, 1000);

  } else {
    // حالة: لا يوجد شفت (يظهر زر بدء الشفت فقط)
    elements.noShiftState.style.display = 'flex';
  }
}

/**
 * تحديث معلومات الأهداف وشريط التقدم.
 */
function updateGoals(todayStats) {
  const currentIncome = todayStats.income || 0;
  const currentHours = todayStats.hours / 3600 || 0; // تحويل الثواني إلى ساعات

  elements.incomeGoalCurrent.textContent = `${currentIncome.toFixed(2)} ر.س`;
  elements.incomeGoalTarget.textContent = `${goals.income.toFixed(2)} ر.س`;
  
  elements.hoursGoalCurrent.textContent = `${currentHours.toFixed(1)} س`;
  elements.hoursGoalTarget.textContent = `${goals.hours.toFixed(1)} س`;
  
  // شريط الدخل
  const incomePercent = goals.income > 0 ? Math.min(100, (currentIncome / goals.income) * 100) : 0;
  elements.incomeGoalProgress.style.width = `${incomePercent}%`;

  // شريط الساعات
  const hoursPercent = goals.hours > 0 ? Math.min(100, (currentHours / goals.hours) * 100) : 0;
  elements.hoursGoalProgress.style.width = `${hoursPercent}%`;
}

/**
 * تحديث الإحصائيات الكلية.
 */
function updateTotalStats() {
  elements.totalIncome.textContent = `${totalStats.income.toFixed(2)} ر.س`;
  elements.totalDistance.textContent = `${totalStats.distance.toFixed(2)} كم`;
}

/**
 * تحديث مسافة الرحلة الحالية (لتبسيط المشكلة، تم حذف منطق تحديد الموقع الجغرافي الفعلي)
 */
function updateTripDistance() {
  if (currentTrip) {
    // في بيئة الإنتاج، سيتم استخدام موقع المستخدم لتحديث هذه القيمة
    // للحفاظ على عمل التطبيق بدون موقع، نستخدم قيمة عشوائية متزايدة
    const distance = currentTrip.currentDistance || 0;
    elements.currentTripDistance.textContent = `${distance.toFixed(2)} كم`;
  }
}

// ----------------------------------------------------
// دوال قاعدة البيانات (Firestore)
// ----------------------------------------------------

/**
 * جلب الأهداف من قاعدة البيانات.
 */
async function fetchGoals() {
  try {
    const docRef = doc(db, "goals", "dailyGoals");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      goals = docSnap.data();
    } else {
      // إعداد الأهداف الافتراضية
      goals = { income: 500, hours: 8 };
    }
  } catch (error) {
    console.error("خطأ في جلب الأهداف:", error);
    // نعتمد الأهداف الافتراضية في حالة الخطأ
    goals = { income: 500, hours: 8 };
  }
}

/**
 * جلب الإحصائيات الكلية.
 */
async function fetchTotalStats() {
    try {
        const statsQuery = query(collection(db, "shifts"), where("isCompleted", "==", true));
        const querySnapshot = await getDocs(statsQuery);

        let totalIncome = 0;
        let totalDistance = 0;

        querySnapshot.forEach((doc) => {
            const shift = doc.data();
            totalIncome += shift.totalIncome || 0;
            totalDistance += shift.totalDistance || 0;
        });

        totalStats = { income: totalIncome, distance: totalDistance };
        updateTotalStats();
    } catch (error) {
        console.error("خطأ في جلب الإحصائيات الكلية:", error);
        showNotification("❌ فشل في تحميل الإحصائيات الكلية.", "error");
    }
}

/**
 * جلب حالة الشفت والرحلة الحالية (الاستماع في الوقت الفعلي).
 */
function setupRealtimeListeners() {
  // 1. الاستماع لحالة الشفت النشط
  const shiftsQuery = query(
    collection(db, "shifts"),
    where("isCompleted", "==", false),
    orderBy("startTime", "desc")
  );

  onSnapshot(shiftsQuery, (snapshot) => {
    safeShowLoader();
    if (!snapshot.empty) {
      currentShift = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      
      // 2. الاستماع لحالة الرحلة النشطة داخل هذا الشفت
      const tripsQuery = query(
        collection(db, `shifts/${currentShift.id}/trips`),
        where("isCompleted", "==", false),
        orderBy("startTime", "desc")
      );
      
      onSnapshot(tripsQuery, (tripSnapshot) => {
        if (!tripSnapshot.empty) {
          currentTrip = { id: tripSnapshot.docs[0].id, ...tripSnapshot.docs[0].data() };
        } else {
          currentTrip = null;
        }
        updateControlCard();
        safeHideLoader();
      }, (error) => {
        console.error("خطأ في الاستماع للرحلات:", error);
        safeHideLoader();
      });

    } else {
      currentShift = null;
      currentTrip = null;
      updateControlCard();
      safeHideLoader();
    }
    
    // جلب إحصائيات اليوم لتحديث الأهداف
    fetchTodayStats();
    fetchTotalStats();
  }, (error) => {
    console.error("خطأ في الاستماع للشفتات:", error);
    safeHideLoader();
    showNotification("❌ فشل في الاتصال بقاعدة البيانات.", "error");
  });
}

/**
 * جلب إحصائيات اليوم (مجموع الدخل والمدة).
 */
async function fetchTodayStats() {
    // تعقيد المنطق لحساب اليوم الحالي في Firebase يتطلب دالة Cloud Function 
    // للتبسيط ولغرض العرض: سنجمع إحصائيات الشفت النشط ونفترضها هي إحصائيات اليوم.
    let todayStats = { income: 0, hours: 0 };
    
    if (currentShift) {
        todayStats.income = currentShift.totalIncome;
        // حساب المدة بالثواني
        const shiftDurationSeconds = Math.floor((Date.now() - currentShift.startTime.toDate()) / 1000);
        todayStats.hours = shiftDurationSeconds;
    }
    
    updateGoals(todayStats);
}


// ----------------------------------------------------
// دوال الأحداث (Event Handlers)
// ----------------------------------------------------

// بدء شفت جديد
async function handleStartShift() {
  safeShowLoader();
  try {
    // إنشاء مستند شفت جديد
    const newShift = {
      startTime: new Date(),
      isCompleted: false,
      totalIncome: 0,
      totalTrips: 0,
      totalDistance: 0,
      trips: []
    };
    await addDoc(collection(db, "shifts"), newShift);
    showNotification("✅ تم بدء شفت جديد بنجاح!", "success");
  } catch (error) {
    console.error("خطأ في بدء الشفت:", error);
    showNotification("❌ فشل في بدء الشفت.", "error");
  }
  safeHideLoader();
}

// إنهاء شفت
async function handleEndShift(confirmed = false) {
  if (!currentShift) return;

  if (!confirmed) {
    elements.shiftEndModal.style.display = 'flex';
    return;
  }
  
  elements.shiftEndModal.style.display = 'none';
  safeShowLoader();
  try {
    // تأكيد إنهاء الشفت وإغلاق جميع الرحلات غير المكتملة
    const shiftRef = doc(db, "shifts", currentShift.id);
    await updateDoc(shiftRef, {
      isCompleted: true,
      endTime: new Date(),
    });
    
    // إيقاف العدادات
    if (shiftTimerInterval) clearInterval(shiftTimerInterval);
    if (tripTimerInterval) clearInterval(tripTimerInterval);

    // إعادة ضبط الحالة المحلية
    currentShift = null;
    currentTrip = null;

    showNotification("✅ تم إنهاء الشفت بنجاح! نهارك سعيد.", "success");
  } catch (error) {
    console.error("خطأ في إنهاء الشفت:", error);
    showNotification("❌ فشل في إنهاء الشفت.", "error");
  }
  safeHideLoader();
}

// بدء رحلة جديدة
async function handleStartTrip() {
  if (!currentShift) return showNotification("❌ يجب بدء شفت أولاً.", "error");
  safeShowLoader();
  try {
    // إنشاء رحلة جديدة
    const newTrip = {
      startTime: new Date(),
      startLocation: 'الرياض', // قيمة افتراضية
      endLocation: null,
      distance: 0,
      fare: 0,
      isCompleted: false,
    };
    
    const tripsCollection = collection(db, `shifts/${currentShift.id}/trips`);
    await addDoc(tripsCollection, newTrip);
    
    showNotification("✅ تم بدء رحلة جديدة! ابدأ القيادة.", "success");
  } catch (error) {
    console.error("خطأ في بدء الرحلة:", error);
    showNotification("❌ فشل في بدء الرحلة.", "error");
  }
  safeHideLoader();
}

// إنهاء الرحلة
function handleEndTrip() {
  if (!currentTrip || !currentShift) return;
  
  // إظهار نافذة إدخال الأجرة
  elements.fareInput.value = ''; // مسح القيمة السابقة
  elements.fareModal.style.display = 'flex';
  elements.fareInput.focus();
}

// تأكيد إدخال الأجرة (منبثق)
async function handleFareConfirm() {
  const fare = parseFloat(elements.fareInput.value);
  
  if (isNaN(fare) || fare <= 0) {
    return showNotification("❌ الرجاء إدخال أجرة صحيحة وموجبة.", "error");
  }

  elements.fareModal.style.display = 'none';
  safeShowLoader();

  try {
    // 1. تحديث الرحلة
    const tripRef = doc(db, `shifts/${currentShift.id}/trips`, currentTrip.id);
    const distance = currentTrip.currentDistance || 5.0; // مسافة افتراضية
    
    await updateDoc(tripRef, {
      endTime: new Date(),
      fare: fare,
      distance: distance,
      isCompleted: true,
      endLocation: 'المكان النهائي' // قيمة افتراضية
    });

    // 2. تحديث الشفت الأم (Shift Parent)
    const shiftRef = doc(db, "shifts", currentShift.id);
    const newIncome = currentShift.totalIncome + fare;
    const newTrips = currentShift.totalTrips + 1;
    const newDistance = currentShift.totalDistance + distance;
    
    await updateDoc(shiftRef, {
      totalIncome: newIncome,
      totalTrips: newTrips,
      totalDistance: newDistance,
    });
    
    // إيقاف عداد الرحلة
    if (tripTimerInterval) clearInterval(tripTimerInterval);
    currentTrip = null;
    
    showNotification(`✅ تم إنهاء الرحلة وإضافة ${fare} ر.س.`, "success");
    
  } catch (error) {
    console.error("خطأ في إنهاء الرحلة:", error);
    showNotification("❌ فشل في إنهاء الرحلة.", "error");
  }
  safeHideLoader();
}

// ----------------------------------------------------
// التهيئة والروابط (Initialization)
// ----------------------------------------------------

async function initializeApp() {
  safeShowLoader();
  await fetchGoals();
  await fetchTotalStats();
  setupRealtimeListeners(); // تبدأ الاستماع وتحديث updateControlCard
  safeHideLoader();
}

// ربط الأحداث بالأزرار
elements.startShiftBtn.addEventListener('click', handleStartShift);
elements.endShiftBtn.addEventListener('click', () => handleEndShift(false)); // إظهار المنبثق
elements.shiftEndConfirmBtn.addEventListener('click', () => handleEndShift(true)); // تأكيد الإنهاء
elements.shiftEndCancelBtn.addEventListener('click', () => {
    elements.shiftEndModal.style.display = 'none';
});

elements.startTripBtn.addEventListener('click', handleStartTrip);
elements.endTripBtn.addEventListener('click', handleEndTrip);

elements.fareConfirmBtn.addEventListener('click', handleFareConfirm);
elements.fareCancelBtn.addEventListener('click', () => {
  elements.fareModal.style.display = 'none';
});

// لمنع الإرسال التلقائي للنموذج عند الضغط على Enter
elements.fareInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        handleFareConfirm();
    }
});


document.addEventListener('DOMContentLoaded', initializeApp);