// ** app.js - المصحح والجاهز للعمل **
// تم إزالة تهيئة Firebase واستبدالها بالاستيراد من firebase-config.js

import { 
    db, collection, addDoc, updateDoc, doc, getDocs, query, where, getDoc, onSnapshot
} from "./firebase-config.js"; 

// المتغيرات العامة
let state = {
  currentShift: null,
  currentTrip: null,
  shiftStartTime: null,
  tripStartTime: null,
  intervalId: null,
  tripIntervalId: null,
  shiftsRef: collection(db, "shifts"),
  tripsRef: collection(db, "trips"),
  statsRef: doc(db, "stats", "global"),
  isPaused: false,
};

// العناصر (تم تحديثها لتشمل عناصر index.html الجديدة)
const elements = {
  // أزرار التحكم
  startShiftBtn: document.getElementById('startShiftBtn'),
  endShiftBtn: document.getElementById('endShiftBtn'),
  startTripBtn: document.getElementById('startTripBtn'),
  endTripBtn: document.getElementById('endTripBtn'),
  pauseShiftBtn: document.getElementById('pauseShiftBtn'),
  
  // حالات الواجهة
  noShiftState: document.getElementById('noShiftState'), 
  activeShiftState: document.getElementById('activeShiftState'),
  activeTripState: document.getElementById('activeTripState'),
  shiftStatsSection: document.getElementById('shift-stats-section'),
  
  // إحصائيات الشفت النشط
  shiftTime: document.getElementById('shiftTime'),
  shiftTripCount: document.getElementById('shiftTripCount'),
  shiftIncome: document.getElementById('shiftIncome'),
  shiftDistance: document.getElementById('shiftDistance'),
  shiftLiveIndicator: document.getElementById('shift-live-indicator'),
  shiftStatusText: document.getElementById('shift-status-text'),
  currentTripTime: document.getElementById('currentTripTime'),

  // إحصائيات كلية
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

function calculateShiftDuration() {
    if (!state.shiftStartTime || state.isPaused) return;

    // الحصول على الوقت الكلي بالثواني
    const diff = Math.floor((new Date() - state.shiftStartTime) / 1000);
    if (elements.shiftTime) {
        elements.shiftTime.textContent = formatTime(diff);
    }
}

function startTimer() {
    if (state.intervalId) clearInterval(state.intervalId);
    state.intervalId = setInterval(calculateShiftDuration, 1000);
}

function startTripTimer() {
    if (state.tripIntervalId) clearInterval(state.tripIntervalId);
    state.tripIntervalId = setInterval(() => {
        if (!state.tripStartTime) return;
        const diff = Math.floor((new Date() - state.tripStartTime) / 1000);
        if (elements.currentTripTime) {
            elements.currentTripTime.textContent = formatTime(diff);
        }
    }, 1000);
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
  // كود الإشعارات الذي لديك
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

function updateUIForActiveShift(currentShiftData) {
  if (!currentShiftData) return;
  
  // تحديث حالة الشفت
  state.currentShift = currentShiftData;
  state.shiftStartTime = currentShiftData.startTime && currentShiftData.startTime.toDate ? currentShiftData.startTime.toDate() : new Date();
  state.isPaused = currentShiftData.isPaused || false;

  // إظهار وإخفاء الحالات
  if (elements.noShiftState) elements.noShiftState.style.display = 'none';
  if (elements.activeShiftState) elements.activeShiftState.style.display = 'block';
  if (elements.shiftStatsSection) elements.shiftStatsSection.style.display = 'grid'; // استخدم grid بعد تحديث index.html

  // تحديث إحصائيات الشفت
  if (elements.shiftTripCount) elements.shiftTripCount.textContent = currentShiftData.tripCount || 0;
  if (elements.shiftIncome) elements.shiftIncome.textContent = `${formatNumber(currentShiftData.totalIncome || 0)} ر.س`;
  if (elements.shiftDistance) elements.shiftDistance.textContent = `${formatNumber(currentShiftData.totalDistance || 0)} كم`;

  // تحديث حالة الإيقاف المؤقت
  if (elements.pauseShiftBtn) {
    elements.pauseShiftBtn.textContent = state.isPaused ? 'استئناف الشفت' : 'إيقاف مؤقت';
    elements.pauseShiftBtn.className = state.isPaused ? 'btn btn-orange' : 'btn btn-secondary';
  }
  if (elements.shiftLiveIndicator) {
      if(state.isPaused) {
          elements.shiftLiveIndicator.style.backgroundColor = 'var(--orange)';
          elements.shiftLiveIndicator.style.animation = 'none';
      } else {
          elements.shiftLiveIndicator.style.backgroundColor = 'var(--green)';
          elements.shiftLiveIndicator.style.animation = 'pulse 1.5s infinite';
      }
  }
  if (elements.shiftStatusText) {
      elements.shiftStatusText.textContent = state.isPaused ? 'شفت متوقف مؤقتاً' : 'شفت نشط';
      elements.shiftStatusText.style.color = state.isPaused ? 'var(--orange)' : 'var(--green)';
  }

  // تحديث حالة الرحلة
  state.currentTrip = currentShiftData.currentTripId;
  if (state.currentTrip) {
      updateUIForActiveTrip();
  } else {
      updateUIForNoTrip();
  }
  
  // تشغيل المؤقت إذا لم يكن الشفت متوقفاً
  if (!state.isPaused) {
      startTimer();
  } else {
      clearInterval(state.intervalId);
  }
}

function updateUIForNoShift() {
  if (elements.noShiftState) elements.noShiftState.style.display = 'block';
  if (elements.activeShiftState) elements.activeShiftState.style.display = 'none';
  if (elements.shiftStatsSection) elements.shiftStatsSection.style.display = 'none';
  if (elements.activeTripState) elements.activeTripState.style.display = 'none'; // تأكد من إخفائها

  clearInterval(state.intervalId);
  clearInterval(state.tripIntervalId);

  if (elements.shiftTime) elements.shiftTime.textContent = '00:00:00';
}

function updateUIForActiveTrip() {
    if (elements.activeTripState) elements.activeTripState.style.display = 'block';
    if (elements.startTripBtn) elements.startTripBtn.style.display = 'none';
    if (elements.endTripBtn) elements.endTripBtn.style.display = 'block';
    
    // بدء مؤقت الرحلة
    state.tripStartTime = new Date(); // مؤقت مؤقت حتى يتم جلب بيانات الرحلة
    startTripTimer();
}

function updateUIForNoTrip() {
    if (elements.activeTripState) elements.activeTripState.style.display = 'none';
    if (elements.startTripBtn) elements.startTripBtn.style.display = 'block';
    if (elements.endTripBtn) elements.endTripBtn.style.display = 'none';
    
    clearInterval(state.tripIntervalId);
    if (elements.currentTripTime) elements.currentTripTime.textContent = '00:00:00';
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

// -------------------- وظائف الأزرار --------------------
async function startShift() {
  safeShowLoader("جاري بدء شفت جديد...");
  try {
    // 1. التحقق أولاً لتفادي تكرار الشفتات
    const q = query(state.shiftsRef, where("isActive", "==", true));
    const existingShiftSnapshot = await getDocs(q);
    
    if (!existingShiftSnapshot.empty) {
        showNotification("⚠️ يوجد شفت نشط بالفعل! يرجى إنهاء الشفت الحالي أولاً.", 'error');
        safeHideLoader();
        return;
    }
    
    // 2. إنشاء شفت جديد
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
    newShift.id = docRef.id;

    // 3. تحديث الحالة والواجهة
    updateUIForActiveShift(newShift);
    showNotification("✅ تم بدء الشفت بنجاح. هيا نعمل!", 'success');

  } catch (error) {
    console.error("❌ خطأ في بدء الشفت:", error);
    showNotification(`❌ فشل بدء الشفت: ${error.message || "خطأ غير معروف"}`, 'error');
  }
  safeHideLoader();
}

async function endShift() {
    if (!state.currentShift || !state.currentShift.id) {
        showNotification("⚠️ لا يوجد شفت نشط لإنهاءه.", 'error');
        return;
    }
    
    if (state.currentShift.currentTripId) {
        showNotification("⚠️ يجب إنهاء الرحلة الحالية أولاً قبل إنهاء الشفت.", 'error');
        return;
    }

    if (!confirm("هل أنت متأكد من إنهاء الشفت الحالي؟")) return;

    safeShowLoader("جاري إنهاء الشفت وحفظ البيانات...");
    try {
        const shiftDocRef = doc(state.shiftsRef, state.currentShift.id);
        const endTime = new Date();
        
        // تحديث وثيقة الشفت
        await updateDoc(shiftDocRef, {
            endTime: endTime,
            isActive: false,
            isPaused: false,
        });

        // إعادة تعيين الحالة وتحديث الواجهة
        state.currentShift = null;
        updateUIForNoShift();

        // إعادة تحميل الإحصائيات الكلية
        await checkShiftStatus();

        showNotification("🎉 تم إنهاء الشفت وحفظ النتائج بنجاح.", 'success');

    } catch (error) {
        console.error("❌ خطأ في إنهاء الشفت:", error);
        showNotification(`❌ فشل إنهاء الشفت: ${error.message || "خطأ غير معروف"}`, 'error');
    }
    safeHideLoader();
}

async function togglePauseShift() { 
    if (!state.currentShift || !state.currentShift.id) return;
    if (state.currentShift.currentTripId) {
        showNotification("⚠️ يجب إنهاء الرحلة الحالية قبل إيقاف الشفت مؤقتاً.", 'error');
        return;
    }

    safeShowLoader(state.isPaused ? "جاري استئناف الشفت..." : "جاري إيقاف الشفت مؤقتاً...");
    try {
        const newPauseState = !state.isPaused;
        const shiftDocRef = doc(state.shiftsRef, state.currentShift.id);

        await updateDoc(shiftDocRef, {
            isPaused: newPauseState,
            // يمكن إضافة منطق لحساب وقت التوقف هنا إذا لزم الأمر
        });

        // تحديث الواجهة مباشرة (سيتم تحديث state.currentShift من خلال المستمع)
        state.isPaused = newPauseState;
        updateUIForActiveShift(state.currentShift);

        showNotification(newPauseState ? "⏸️ تم إيقاف الشفت مؤقتاً." : "▶️ تم استئناف الشفت.", 'success');
    } catch (error) {
        console.error("❌ خطأ في إيقاف/استئناف الشفت:", error);
        showNotification(`❌ فشل العملية: ${error.message || "خطأ غير معروف"}`, 'error');
    }
    safeHideLoader();
}

async function startTrip() {
    if (!state.currentShift || state.isPaused) {
        showNotification("⚠️ لا يمكن بدء رحلة. ابدأ أو استأنف الشفت أولاً.", 'error');
        return;
    }
    
    safeShowLoader("جاري بدء رحلة جديدة...");
    try {
        const newTrip = {
            shiftId: state.currentShift.id,
            startTime: new Date(),
            endTime: null,
            fare: 0,
            distance: 0,
            status: 'active',
        };

        const docRef = await addDoc(state.tripsRef, newTrip);

        // تحديث الشفت الحالي بالرحلة الجديدة
        const shiftDocRef = doc(state.shiftsRef, state.currentShift.id);
        await updateDoc(shiftDocRef, {
            currentTripId: docRef.id,
        });

        // تحديث الحالة والواجهة
        state.currentTrip = docRef.id;
        state.tripStartTime = newTrip.startTime;
        updateUIForActiveTrip();

        showNotification("🚕 تم بدء الرحلة بنجاح.", 'success');
    } catch (error) {
        console.error("❌ خطأ في بدء الرحلة:", error);
        showNotification(`❌ فشل بدء الرحلة: ${error.message || "خطأ غير معروف"}`, 'error');
    }
    safeHideLoader();
}

async function endTrip() {
    if (!state.currentShift || !state.currentTrip) {
        showNotification("⚠️ لا توجد رحلة نشطة لإنهاءها.", 'error');
        return;
    }
    
    // ** ملاحظة هامة: يجب أن يتم هنا فتح نافذة إدخال بيانات (الأجرة والمسافة)
    //   لكن لتبسيط الحل مؤقتاً، سنضع قيماً افتراضية (Dummy) **
    
    const fare = parseFloat(prompt("أدخل قيمة الأجرة (ريال):", "20") || 0);
    const distance = parseFloat(prompt("أدخل المسافة (كم):", "10") || 0);

    if (isNaN(fare) || isNaN(distance) || fare < 0 || distance < 0) {
        showNotification("⚠️ تم إلغاء العملية أو إدخال قيم غير صالحة.", 'info');
        return;
    }

    safeShowLoader("جاري إنهاء الرحلة وتحديث الإحصائيات...");
    try {
        const batch = writeBatch(db);
        const shiftDocRef = doc(state.shiftsRef, state.currentShift.id);
        const tripDocRef = doc(state.tripsRef, state.currentTrip);
        const statsDocRef = state.statsRef;
        const endTime = new Date();

        // 1. تحديث وثيقة الرحلة
        batch.update(tripDocRef, {
            endTime: endTime,
            fare: fare,
            distance: distance,
            status: 'completed',
        });

        // 2. تحديث وثيقة الشفت (زيادة الإحصائيات وتصفير الرحلة النشطة)
        batch.update(shiftDocRef, {
            totalIncome: state.currentShift.totalIncome + fare,
            totalDistance: state.currentShift.totalDistance + distance,
            tripCount: state.currentShift.tripCount + 1,
            currentTripId: null, // تصفير الرحلة النشطة
        });

        // 3. تحديث الإحصائيات الكلية
        const currentStats = await getGlobalStats();
        batch.set(statsDocRef, {
            totalIncome: (currentStats.totalIncome || 0) + fare,
            totalDistance: (currentStats.totalDistance || 0) + distance,
            totalTrips: (currentStats.totalTrips || 0) + 1,
        }, { merge: true });

        await batch.commit();

        // 4. تحديث الحالة والواجهة
        state.currentTrip = null;
        state.tripStartTime = null;
        updateUIForNoTrip();

        // إعادة تحميل الإحصائيات الكلية
        await checkShiftStatus();

        showNotification(`💰 تم إنهاء الرحلة. الدخل: ${fare} ر.س`, 'success');

    } catch (error) {
        console.error("❌ خطأ في إنهاء الرحلة:", error);
        showNotification(`❌ فشل إنهاء الرحلة: ${error.message || "خطأ غير معروف"}`, 'error');
    }
    safeHideLoader();
}

// -------------------- مراقبة الحالة في الوقت الفعلي --------------------
// هذه الدالة تراقب التغييرات في الشفت النشط والإحصائيات الكلية في الوقت الفعلي
function setupRealtimeListeners() {
    // مراقبة الشفت النشط (بافتراض أن هناك شفت واحد نشط فقط)
    const q = query(state.shiftsRef, where("isActive", "==", true));
    
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const shiftDoc = snapshot.docs[0];
            const shiftData = { id: shiftDoc.id, ...shiftDoc.data() };
            updateUIForActiveShift(shiftData);
        } else {
            updateUIForNoShift();
        }
    }, (error) => {
        console.error("❌ خطأ في مراقبة الشفت النشط:", error);
        // لا تظهر إشعار هنا لمنع الإزعاج المتكرر
    });

    // مراقبة الإحصائيات الكلية
    onSnapshot(state.statsRef, (doc) => {
        if (doc.exists()) {
            updateGlobalStatsDisplay(doc.data());
        }
    }, (error) => {
        console.error("❌ خطأ في مراقبة الإحصائيات الكلية:", error);
    });
}


// -------------------- معالجات الأحداث والتهيئة --------------------

async function initializeApp() {
  safeShowLoader("جاري تهيئة التطبيق...");
  try {
    // إعداد المستمعين في الوقت الفعلي
    setupRealtimeListeners();
    
    // جلب الإحصائيات الكلية لمرة واحدة (ستتم مراقبتها لاحقاً بـ onSnapshot)
    const stats = await getGlobalStats();
    updateGlobalStatsDisplay(stats);

    // ربط الأحداث بالأزرار (سيتم تفعيلها فوراً بعد حل مشكلة التهيئة)
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
  safeHideLoader();
}

// تشغيل التهيئة
document.addEventListener('DOMContentLoaded', initializeApp);