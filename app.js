import { 
  db, collection, addDoc, updateDoc, doc, getDocs, query, where, orderBy, onSnapshot,
  writeBatch
} from "./firebase-config.js";

// العناصر
const elements = {
  startShiftBtn: document.getElementById('startShiftBtn'),
  endShiftBtn: document.getElementById('endShiftBtn'),
  startTripBtn: document.getElementById('startTripBtn'),
  endTripBtn: document.getElementById('endTripBtn'),
  shiftTime: document.getElementById('shiftTime'),
  shiftTripCount: document.getElementById('shiftTripCount'),
  shiftIncome: document.getElementById('shiftIncome'),
  shiftDistance: document.getElementById('shiftDistance'),
  totalShifts: document.getElementById('totalShifts'),
  totalShiftTime: document.getElementById('totalShiftTime'),
  totalIncome: document.getElementById('totalIncome'),
  totalDistance: document.getElementById('totalDistance'),
  loadingOverlay: document.getElementById('loading-overlay'),
  // عناصر إضافية للتحكم بالرحلة
  tripStatus: document.getElementById('tripStatus'),
  tripStatusIcon: document.getElementById('tripStatusIcon'),
  tripStatusText: document.getElementById('tripStatusText'),
  tripDetails: document.getElementById('tripDetails'),
  // المودالز
  endTripModal: document.getElementById('end-trip-modal'),
  endTripFareInput: document.getElementById('fare-input'),
  endTripCancelBtn: document.getElementById('end-trip-cancel'),
  endTripConfirmBtn: document.getElementById('end-trip-confirm'),
  endShiftModal: document.getElementById('end-shift-modal'),
  endShiftCancelBtn: document.getElementById('end-shift-cancel'),
  endShiftConfirmBtn: document.getElementById('end-shift-confirm'),
};

// الحالة
let state = {
  activeShiftId: localStorage.getItem('activeShiftId'),
  currentTripId: localStorage.getItem('currentTripId'),
  shiftTimer: null,
  tripTimer: null,
  currentShift: null,
  currentTrip: null,
  isOnline: navigator.onLine,
  geolocationWatchId: null, // لتتبع الموقع
  tripStartTime: null,
  tripStartLocation: null,
  tripTotalDistance: 0,
  tripTotalDuration: 0,
};

// التهيئة
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
  try {
    safeShowLoader('جاري تحميل التطبيق...');
    
    // إضافة مستمعين لحالة الاتصال
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // تحميل الإحصائيات العالمية
    await loadGlobalStats();
    
    // التحقق من وجود شفت نشط
    if (state.activeShiftId) {
      await loadActiveShift(state.activeShiftId);
      
      // التحقق من وجود رحلة نشطة داخل الشفت
      if (state.currentTripId) {
        await loadActiveTrip(state.currentTripId);
      }
    } else {
      updateUIForNoShift();
    }
    
    // إضافة المستمعين للأحداث
    addEventListeners();
    
    console.log('✅ التطبيق جاهز للاستخدام');
    
  } catch (error) {
    console.error('❌ خطأ في التهيئة:', error);
    showError('حدث خطأ في تحميل التطبيق. يرجى تحديث الصفحة.');
  } finally {
    safeHideLoader();
  }
}

function addEventListeners() {
  elements.startShiftBtn?.addEventListener('click', startShift);
  elements.endShiftBtn?.addEventListener('click', showEndShiftModal);
  elements.startTripBtn?.addEventListener('click', startTrip);
  elements.endTripBtn?.addEventListener('click', showEndTripModal);
  
  // مودال إنهاء الرحلة
  elements.endTripCancelBtn?.addEventListener('click', () => elements.endTripModal.style.display = 'none');
  elements.endTripConfirmBtn?.addEventListener('click', endTrip);
  
  // مودال إنهاء الشفت
  elements.endShiftCancelBtn?.addEventListener('click', () => elements.endShiftModal.style.display = 'none');
  elements.endShiftConfirmBtn?.addEventListener('click', endShift);
}

// ====================================================================
//                 🛠️ أدوات المساعدة (Utilities)
// ====================================================================

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

function toDateSafe(timestamp) {
  if (!timestamp) return new Date();
  if (timestamp.toDate) return timestamp.toDate(); // Firebase Timestamp
  if (timestamp instanceof Date) return timestamp; // Date Object
  return new Date(timestamp); // Fallback for other formats
}

function haversineDistance(coords1, coords2) {
    if (!coords1 || !coords2) return 0;
    const R = 6371e3; // نصف قطر الأرض بالمتر
    const lat1 = coords1.latitude * (Math.PI / 180);
    const lat2 = coords2.latitude * (Math.PI / 180);
    const deltaLat = (coords2.latitude - coords1.latitude) * (Math.PI / 180);
    const deltaLon = (coords2.longitude - coords1.longitude) * (Math.PI / 180);

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // المسافة بالأمتار
}


// ====================================================================
//                       📡 حالة الاتصال
// ====================================================================

function handleOnline() {
  state.isOnline = true;
  showSuccess('✅ تم استعادة الاتصال بالإنترنت.');
  // هنا يمكن إضافة منطق مزامنة البيانات غير المزامنة (خارج نطاق هذا الكود حالياً)
}

function handleOffline() {
  state.isOnline = false;
  showError('❌ تم فقد الاتصال بالإنترنت. بعض الوظائف قد لا تعمل.');
}


// ====================================================================
//                     🌍 الإحصائيات العامة
// ====================================================================

async function loadGlobalStats() {
  try {
    const shiftsRef = collection(db, 'shifts');
    const q = query(shiftsRef, where('status', '==', 'completed'));
    const snapshot = await getDocs(q);
    
    let totalShifts = snapshot.size;
    let totalTime = 0; // بالثواني
    let totalIncome = 0;
    let totalDistance = 0; // بالأمتار

    snapshot.forEach(doc => {
      const data = doc.data();
      totalTime += data.activeDurationSeconds || 0;
      totalIncome += data.totalIncome || 0;
      totalDistance += data.totalDistance || 0;
    });
    
    // تحديث الواجهة
    elements.totalShifts.textContent = totalShifts;
    elements.totalShiftTime.textContent = formatDuration(totalTime);
    elements.totalIncome.textContent = totalIncome.toFixed(2) + ' ر.س';
    elements.totalDistance.textContent = (totalDistance / 1000).toFixed(2) + ' كم';

  } catch (error) {
    console.warn('⚠️ فشل تحميل الإحصائيات العامة:', error);
  }
}

// ====================================================================
//                      ⏱️ إدارة الشفت (Shift)
// ====================================================================

// بدء الشفت
async function startShift() {
  try {
    if (!state.isOnline) {
      showError('لا يوجد اتصال بالإنترنت. يرجى الاتصال بالشبكة أولاً.');
      return;
    }
    
    safeShowLoader('جاري بدء الشفت...');
    
    const shiftData = {
      startTime: new Date(),
      status: 'active',
      totalIncome: 0,
      totalDistance: 0,
      tripCount: 0,
      totalTripTimeSeconds: 0,
      totalPausedTimeSeconds: 0,
      activeDurationSeconds: 0, // المدة الفعالة للشفت
      isPaused: false,
      createdAt: new Date()
    };
    
    const docRef = await addDoc(collection(db, 'shifts'), shiftData);
    state.activeShiftId = docRef.id;
    localStorage.setItem('activeShiftId', docRef.id);
    
    await loadActiveShift(docRef.id);
    
    showSuccess('تم بدء الشفت بنجاح! 🚗');
    
  } catch (error) {
    console.error('❌ خطأ في بدء الشفت:', error);
    showError('فشل بدء الشفت. يرجى المحاولة مرة أخرى.');
  } finally {
    safeHideLoader();
  }
}

// تحميل الشفت النشط
async function loadActiveShift(shiftId) {
  try {
    const shiftRef = doc(db, 'shifts', shiftId);
    
    // الاستماع للتغييرات في الوقت الفعلي
    const unsubscribe = onSnapshot(shiftRef, (docSnap) => {
      if (docSnap.exists()) {
        const shiftData = docSnap.data();
        state.currentShift = { 
          id: docSnap.id, 
          ...shiftData,
          // التأكد من تحويل startTime إلى كائن Date
          startTime: toDateSafe(shiftData.startTime)
        };
        
        updateUIForActiveShift();
        
        // بدء المؤقت إذا كان الشفت نشط وغير متوقف
        if (state.currentShift.status === 'active' && !state.currentShift.isPaused) {
          startShiftTimer();
        } else {
          stopShiftTimer();
        }
      } else {
        // الشفت غير موجود، تنظيف
        console.log('⚠️ الشفت غير موجود، التنظيف...');
        clearActiveShift();
      }
    }, (error) => {
      console.error('❌ خطأ في الاستماع للتغييرات:', error);
      showError('فقد الاتصال بالخادم. جاري المحاولة...');
    });
    
  } catch (error) {
    console.error('❌ خطأ في تحميل الشفت:', error);
    showError('فشل تحميل بيانات الشفت.');
    clearActiveShift();
  }
}

// بدء مؤقت الشفت
function startShiftTimer() {
  if (state.shiftTimer) clearInterval(state.shiftTimer);
  
  state.shiftTimer = setInterval(() => {
    if (state.currentShift && !state.currentShift.isPaused) {
      const startTime = state.currentShift.startTime;
      const now = new Date();
      // حساب المدة الزمنية للشفت مع خصم وقت الإيقاف المؤقت
      const elapsedSeconds = Math.floor((now - startTime) / 1000);
      const totalSeconds = elapsedSeconds - (state.currentShift.totalPausedTimeSeconds || 0);
      
      elements.shiftTime.textContent = formatDuration(totalSeconds);
      
      // تحديث كل 30 ثانية في الخلفية
      if (totalSeconds > 0 && totalSeconds % 30 === 0) {
        updateShiftTimeInFirestore(totalSeconds);
      }
    }
  }, 1000);
}

// تحديث وقت الشفت في Firestore
async function updateShiftTimeInFirestore(totalSeconds) {
  if (!state.activeShiftId || !state.isOnline) return;
  try {
    const shiftRef = doc(db, 'shifts', state.activeShiftId);
    await updateDoc(shiftRef, { 
      activeDurationSeconds: totalSeconds,
      lastUpdated: new Date() 
    });
  } catch (error) {
    console.error('❌ خطأ في تحديث الوقت:', error);
  }
}

// إيقاف مؤقت الشفت
function stopShiftTimer() {
  if (state.shiftTimer) {
    clearInterval(state.shiftTimer);
    state.shiftTimer = null;
  }
}

// إنهاء الشفت (تأكيد)
function showEndShiftModal() {
  if (state.currentTripId) {
    showError('لا يمكنك إنهاء الشفت بوجود رحلة نشطة.');
    return;
  }
  elements.endShiftModal.style.display = 'flex';
}

// إنهاء الشفت (تنفيذ)
async function endShift() {
  elements.endShiftModal.style.display = 'none';
  if (!state.activeShiftId || !state.currentShift) return;

  try {
    safeShowLoader('جاري إنهاء الشفت وحفظ البيانات...');
    stopShiftTimer();
    
    const shiftRef = doc(db, 'shifts', state.activeShiftId);
    
    // حساب المدة النهائية للشفت
    const now = new Date();
    const startTime = state.currentShift.startTime;
    const elapsedSeconds = Math.floor((now - startTime) / 1000);
    const finalDuration = elapsedSeconds - (state.currentShift.totalPausedTimeSeconds || 0);

    const updateData = {
      status: 'completed',
      endTime: now,
      activeDurationSeconds: finalDuration,
      lastUpdated: new Date()
    };
    
    await updateDoc(shiftRef, updateData);
    
    // تحديث الإحصائيات العامة مباشرة
    loadGlobalStats();

    clearActiveShift();
    showSuccess('تم إنهاء الشفت وحفظه بنجاح! 🎉');

  } catch (error) {
    console.error('❌ خطأ في إنهاء الشفت:', error);
    showError('فشل إنهاء الشفت. يرجى مراجعة التقارير لاحقًا.');
    clearActiveShift(); // تنظيف الواجهة حتى لو فشل التحديث النهائي
  } finally {
    safeHideLoader();
  }
}

// تنظيف حالة الشفت
function clearActiveShift() {
  localStorage.removeItem('activeShiftId');
  state.activeShiftId = null;
  state.currentShift = null;
  state.currentTripId = null;
  localStorage.removeItem('currentTripId');
  stopShiftTimer();
  stopTripTracking();
  updateUIForNoShift();
  updateUIForNoTrip();
}


// ====================================================================
//                     🚕 إدارة الرحلة (Trip)
// ====================================================================

// بدء الرحلة
async function startTrip() {
  if (!state.activeShiftId) {
    showError('يجب بدء شفت جديد أولاً.');
    return;
  }
  
  if (!navigator.geolocation) {
    showError('متصفحك لا يدعم خاصية تحديد الموقع.');
    return;
  }
  
  safeShowLoader('جاري تحديد الموقع وبدء الرحلة...');
  
  try {
    const position = await getCurrentLocation();
    
    state.tripStartLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: new Date()
    };
    
    const tripData = {
      shiftId: state.activeShiftId,
      startTime: state.tripStartLocation.timestamp,
      startLocation: state.tripStartLocation,
      status: 'active',
      fare: 0,
      distanceMeters: 0,
      durationSeconds: 0,
      route: [state.tripStartLocation], // سجل المسار
      createdAt: new Date()
    };
    
    const tripsRef = collection(db, 'shifts', state.activeShiftId, 'trips');
    const docRef = await addDoc(tripsRef, tripData);
    
    state.currentTripId = docRef.id;
    localStorage.setItem('currentTripId', docRef.id);
    state.currentTrip = { id: docRef.id, ...tripData };
    
    // بدء التتبع الجغرافي
    startTripTracking();
    
    updateUIForActiveTrip();
    showSuccess('انطلقت الرحلة! 🗺️');

  } catch (error) {
    console.error('❌ خطأ في بدء الرحلة:', error);
    showError('فشل بدء الرحلة: تعذر تحديد الموقع. (ربما تحتاج للسماح بالوصول).');
  } finally {
    safeHideLoader();
  }
}

// الحصول على الموقع الحالي مرة واحدة
function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });
}

// بدء التتبع الجغرافي المستمر
function startTripTracking() {
  if (state.geolocationWatchId) navigator.geolocation.clearWatch(state.geolocationWatchId);
  
  // حفظ آخر نقطة مسافة لتجنب التحديثات الصفرية
  let lastRecordedPosition = state.tripStartLocation;
  
  // المؤقت لتحديث المسافة والوقت كل ثانية
  if (state.tripTimer) clearInterval(state.tripTimer);
  state.tripStartTime = new Date();
  state.tripTotalDuration = 0;
  
  state.tripTimer = setInterval(() => {
    state.tripTotalDuration++;
    elements.tripStatusText.textContent = `نشطة - ${formatDuration(state.tripTotalDuration)} - ${(state.tripTotalDistance / 1000).toFixed(2)} كم`;
  }, 1000);

  // التتبع الجغرافي
  state.geolocationWatchId = navigator.geolocation.watchPosition(async (position) => {
    const newLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      timestamp: new Date()
    };
    
    // حساب المسافة المقطوعة بين آخر نقطة ونقطة جديدة (بالمتر)
    const segmentDistance = haversineDistance(lastRecordedPosition, newLocation);
    
    // تحديث المسافة الإجمالية فقط إذا كانت المسافة المقطوعة منطقية (مثلاً > 5 أمتار لتجنب ضوضاء GPS)
    if (segmentDistance > 5) {
      state.tripTotalDistance += segmentDistance;
      lastRecordedPosition = newLocation;
      
      // تحديث البيانات في Firestore (كل 15 ثانية أو عند مسافة كبيرة)
      if (state.tripTotalDistance > 0 && state.tripTotalDuration % 15 === 0) {
        // تحديث Trip
        const tripRef = doc(db, 'shifts', state.activeShiftId, 'trips', state.currentTripId);
        await updateDoc(tripRef, { 
          distanceMeters: state.tripTotalDistance,
          durationSeconds: state.tripTotalDuration,
          lastLocation: newLocation,
          // لا نحدث Route هنا لتجنب الكتابة الكثيفة، يمكن تحديثه عند الانتهاء.
        });
      }
    }
    
    // تحديث واجهة المستخدم بشكل مستمر
    elements.tripStatusText.textContent = `نشطة - ${formatDuration(state.tripTotalDuration)} - ${(state.tripTotalDistance / 1000).toFixed(2)} كم`;
    
  }, (error) => {
    console.warn('⚠️ خطأ في تتبع الموقع:', error);
  }, {
    enableHighAccuracy: true,
    timeout: 30000,
    maximumAge: 5000
  });
}

// إيقاف التتبع الجغرافي
function stopTripTracking() {
  if (state.geolocationWatchId) {
    navigator.geolocation.clearWatch(state.geolocationWatchId);
    state.geolocationWatchId = null;
  }
  if (state.tripTimer) {
    clearInterval(state.tripTimer);
    state.tripTimer = null;
  }
  state.tripStartLocation = null;
  state.tripTotalDistance = 0;
  state.tripTotalDuration = 0;
}

// إنهاء الرحلة (تأكيد)
function showEndTripModal() {
  if (!state.currentTripId) return;
  elements.endTripModal.style.display = 'flex';
  elements.endTripFareInput.value = '';
  elements.endTripFareInput.focus();
}

// إنهاء الرحلة (تنفيذ)
async function endTrip() {
  elements.endTripModal.style.display = 'none';
  if (!state.currentTripId || !state.activeShiftId) return;
  
  stopTripTracking();
  safeShowLoader('جاري إنهاء الرحلة وحساب المسافة...');
  
  const fare = parseFloat(elements.endTripFareInput.value) || 0;
  if (fare < 0) {
    showError('الأجرة المدخلة غير صالحة.');
    safeHideLoader();
    return;
  }

  try {
    const endPosition = await getCurrentLocation();
    const endTime = new Date();
    
    const endLocation = {
      latitude: endPosition.coords.latitude,
      longitude: endPosition.coords.longitude,
      timestamp: endTime
    };

    // حساب المسافة النهائية مرة أخرى
    // بما أننا كنا نحدث المسافة بشكل مستمر في التتبع، فالمتغير state.tripTotalDistance يجب أن يكون دقيقاً
    // (بالمتر)
    const finalDistanceMeters = state.tripTotalDistance; 
    
    // حساب المدة الزمنية النهائية
    const finalDurationSeconds = state.tripTotalDuration;

    const tripRef = doc(db, 'shifts', state.activeShiftId, 'trips', state.currentTripId);
    const shiftRef = doc(db, 'shifts', state.activeShiftId);
    
    // 1. تحديث الرحلة
    await updateDoc(tripRef, {
      status: 'completed',
      endTime: endTime,
      endLocation: endLocation,
      fare: fare,
      distanceMeters: finalDistanceMeters,
      durationSeconds: finalDurationSeconds,
      lastUpdated: new Date()
      // يمكن إضافة تحديث نهائي لـ route هنا إن لزم الأمر
    });
    
    // 2. تحديث الشفت باستخدام حزمة (Batch)
    const batch = writeBatch(db);
    
    const newTotalIncome = (state.currentShift.totalIncome || 0) + fare;
    const newTotalDistance = (state.currentShift.totalDistance || 0) + finalDistanceMeters / 1000; // تحويل إلى كم
    const newTripCount = (state.currentShift.tripCount || 0) + 1;
    const newTotalTripTime = (state.currentShift.totalTripTimeSeconds || 0) + finalDurationSeconds;

    batch.update(shiftRef, {
      totalIncome: newTotalIncome,
      totalDistance: newTotalDistance,
      tripCount: newTripCount,
      totalTripTimeSeconds: newTotalTripTime,
      lastUpdated: new Date()
    });
    
    await batch.commit();

    // 3. تنظيف الحالة وتحديث الواجهة
    state.currentTripId = null;
    localStorage.removeItem('currentTripId');
    updateUIForNoTrip(); // إخفاء تفاصيل الرحلة وإظهار زر البدء
    
    showSuccess(`تم إنهاء الرحلة. الأجرة: ${fare.toFixed(2)} ر.س`);

  } catch (error) {
    console.error('❌ خطأ في إنهاء الرحلة:', error);
    showError('فشل إنهاء الرحلة. يرجى المحاولة مرة أخرى.');
  } finally {
    safeHideLoader();
  }
}

// تنظيف حالة الرحلة
function clearActiveTrip() {
  localStorage.removeItem('currentTripId');
  state.currentTripId = null;
  state.currentTrip = null;
  stopTripTracking();
  updateUIForNoTrip();
}


// ====================================================================
//                          🎨 تحديث الواجهة
// ====================================================================

// تحديث واجهة الشفت النشط
function updateUIForActiveShift() {
  if (!state.currentShift) return;
  
  // إظهار/إخفاء الأزرار
  elements.startShiftBtn.style.display = 'none';
  elements.endShiftBtn.style.display = 'block';
  
  // تحديث الإحصائيات
  elements.shiftTripCount.textContent = state.currentShift.tripCount || 0;
  elements.shiftIncome.textContent = (state.currentShift.totalIncome || 0).toFixed(2) + ' ر.س';
  // يتم حفظ المسافة في Shift بـ (كم)
  elements.shiftDistance.textContent = (state.currentShift.totalDistance || 0).toFixed(2) + ' كم';

  // إضافة فئة للنقطة الحية
  const endShiftBtn = elements.endShiftBtn;
  if (!endShiftBtn.querySelector('.live-dot')) {
    const liveDot = document.createElement('div');
    liveDot.className = 'live-dot';
    endShiftBtn.style.position = 'relative';
    endShiftBtn.appendChild(liveDot);
  }
  
  // تحديث حالة زر بدء الرحلة بناءً على حالة الرحلة
  updateTripButtonVisibility();
}

// تحديث واجهة عدم وجود شفت
function updateUIForNoShift() {
  elements.startShiftBtn.style.display = 'block';
  elements.endShiftBtn.style.display = 'none';
  elements.startTripBtn.style.display = 'none';
  elements.endTripBtn.style.display = 'none';
  elements.shiftTime.textContent = '00:00:00';
  elements.shiftTripCount.textContent = '0';
  elements.shiftIncome.textContent = '0.00 ر.س';
  elements.shiftDistance.textContent = '0.00 كم';
  
  const liveDot = elements.endShiftBtn.querySelector('.live-dot');
  if (liveDot) liveDot.remove();
  
  // التأكد من أن حالة الرحلة مخفية
  updateUIForNoTrip();
  
  const noShiftState = document.getElementById('noShiftState');
  const activeShiftState = document.getElementById('activeShiftState');
  if (noShiftState && activeShiftState) {
    noShiftState.style.display = 'block';
    activeShiftState.style.display = 'none';
  }
}

// تحديث واجهة الرحلة النشطة
function updateUIForActiveTrip() {
  elements.startTripBtn.style.display = 'none';
  elements.endTripBtn.style.display = 'block';
  
  // تحديث حالة الرحلة في الواجهة
  elements.tripStatus.classList.remove('no-trip');
  elements.tripStatus.classList.add('active-trip');
  elements.tripStatusIcon.src = 'assets/icons/car.png';
  
  elements.tripDetails.style.display = 'block';
  elements.tripStatusText.textContent = `نشطة - 00:00:00 - 0.00 كم`;
  
  // التأكد من إخفاء حالة عدم وجود شفت/رحلة
  const noShiftState = document.getElementById('noShiftState');
  const activeShiftState = document.getElementById('activeShiftState');
  if (noShiftState && activeShiftState) {
    noShiftState.style.display = 'none';
    activeShiftState.style.display = 'block';
  }
}

// تحديث واجهة عدم وجود رحلة
function updateUIForNoTrip() {
  elements.endTripBtn.style.display = 'none';
  
  // تحديث حالة زر بدء الرحلة
  updateTripButtonVisibility();
  
  // تحديث حالة الرحلة في الواجهة
  elements.tripStatus.classList.add('no-trip');
  elements.tripStatus.classList.remove('active-trip');
  elements.tripStatusIcon.src = 'assets/icons/stop.png';
  elements.tripStatusText.textContent = 'متوقف - لا توجد رحلة نشطة';
  
  elements.tripDetails.style.display = 'none';
}

// وظيفة مساعدة لتحديث حالة زر بدء الرحلة
function updateTripButtonVisibility() {
  // إظهار زر بدء الرحلة فقط إذا كان هناك شفت نشط ولا توجد رحلة نشطة حالياً
  if (state.activeShiftId && !state.currentTripId) {
    elements.startTripBtn.style.display = 'block';
  } else {
    elements.startTripBtn.style.display = 'none';
  }
}

// ====================================================================
//                        📢 الإشعارات والتحميل
// ====================================================================

function safeShowLoader(message = 'جاري التحميل...') {
  try {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.querySelector('p').textContent = message;
      elements.loadingOverlay.style.display = 'flex';
      // استخدام setTimeout مع إضافة فئة بعد تأخير لضمان عمل الانتقال CSS
      setTimeout(() => {
        elements.loadingOverlay.classList.add('show');
      }, 10);
    }
  } catch {}
}

function safeHideLoader() {
  try {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.classList.remove('show');
      // إخفاء العنصر بعد انتهاء الانتقال (300ms)
      setTimeout(() => {
        elements.loadingOverlay.style.display = 'none';
      }, 300);
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
  
  // إخفاء الإشعار بعد 4 ثواني
  setTimeout(() => {
    notification.style.transform = 'translateY(-20px)';
    notification.style.opacity = '0';
    // إزالة العنصر من DOM بعد الانتهاء من الإخفاء
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

function showError(message) {
  showNotification(message, 'error');
}

function showSuccess(message) {
  showNotification(message, 'success');
}