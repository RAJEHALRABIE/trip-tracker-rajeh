// ** app.js - المصحح والنهائي **
// تم استيراد التهيئة من الملف المركزي لحل مشكلة initializeApp

import { 
  db, collection, addDoc, updateDoc, doc, getDocs, query, where, getDoc, writeBatch 
} from "./firebase-config.js"; // تم الافتراض بأن لديك ملف firebase-config.js

// العناصر
const elements = {
  startShiftBtn: document.getElementById('startShiftBtn'),
  endShiftBtn: document.getElementById('endShiftBtn'),
  startTripBtn: document.getElementById('startTripBtn'),
  endTripBtn: document.getElementById('endTripBtn'),
  pauseShiftBtn: document.getElementById('pauseShiftBtn'),

  shiftStatus: document.getElementById('shift-status'),
  shiftDuration: document.getElementById('shiftDuration'),
  shiftIncome: document.getElementById('shiftIncome'),
  shiftTrips: document.getElementById('shiftTrips'),

  noShiftState: document.getElementById('noShiftState'),
  activeShiftState: document.getElementById('activeShiftState'),
  noTripState: document.getElementById('noTripState'),
  activeTripState: document.getElementById('activeTripState'),
  
  globalTotalIncome: document.getElementById('totalIncome'),
  globalTotalDistance: document.getElementById('totalDistance'),
  
  loading: document.getElementById('loading-overlay'),
};

// المراجع
const shiftsRef = collection(db, "shifts");
const tripsRef = collection(db, "trips");
const statsRef = doc(db, "stats", "global");
const goalsRef = doc(db, "settings", "goals");


// المتغيرات العامة لإدارة حالة التطبيق
let state = {
  currentShift: null, // يحتوي على كامل بيانات الشفت النشط
  currentTrip: null,  // يحتوي على كامل بيانات الرحلة النشطة
  shiftStartTime: null,
  isPaused: false,
  timerInterval: null,
};


// -------------------- الوظائف المساعدة --------------------

function formatTime(totalSeconds) {
    if (totalSeconds < 0) return '00:00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => v < 10 ? '0' + v : v).join(':');
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
  // الكود الخاص بالإشعار (تم تبسيطه قليلاً للتناسق)
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

function updateUIForActiveShift() {
    const isActive = !!state.currentShift; // !! يحول القيمة إلى true/false
    const isTripActive = !!state.currentTrip;
    
    // حالة الشفت (نشط / غير نشط)
    elements.noShiftState.style.display = isActive ? 'none' : 'block';
    elements.activeShiftState.style.display = isActive ? 'block' : 'none';

    if (isActive) {
        // حالة الرحلة (نشطة / غير نشطة)
        elements.noTripState.style.display = isTripActive ? 'none' : 'block';
        elements.activeTripState.style.display = isTripActive ? 'block' : 'none';

        // تحديث إحصائيات الشفت
        elements.shiftIncome.textContent = `${(state.currentShift.totalIncome || 0).toFixed(2)} ر.س`;
        elements.shiftTrips.textContent = `${state.currentShift.tripCount || 0}`;

        // حالة الإيقاف المؤقت
        if (elements.pauseShiftBtn) {
            elements.pauseShiftBtn.textContent = state.isPaused ? 'استئناف الشفت' : 'إيقاف مؤقت';
            elements.pauseShiftBtn.classList.toggle('btn-secondary', state.isPaused);
            elements.pauseShiftBtn.classList.toggle('btn-primary', !state.isPaused);
        }

        // تحديث حالة الشفت الرئيسية
        elements.shiftStatus.textContent = isTripActive 
            ? 'رحلة نشطة' 
            : state.isPaused ? 'شفت موقف مؤقتاً' : 'شفت نشط';
    }
}

function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);

    state.timerInterval = setInterval(() => {
        if (!state.currentShift || state.isPaused) return;

        const startTime = state.shiftStartTime ? state.shiftStartTime.getTime() : new Date(state.currentShift.startTime.toDate()).getTime();
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        elements.shiftDuration.textContent = formatTime(durationSeconds);
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
    }
}

// -------------------- وظائف البيانات الأساسية --------------------

async function fetchGlobalStats() {
    try {
        const docSnap = await getDoc(statsRef);
        if (docSnap.exists()) {
            const stats = docSnap.data();
            elements.globalTotalIncome.textContent = `${(stats.totalIncome || 0).toFixed(2)} ر.س`;
            elements.globalTotalDistance.textContent = `${(stats.totalDistance || 0).toFixed(2)} كم`;
        }
    } catch (error) {
        console.error("❌ خطأ في جلب الإحصائيات الكلية:", error);
    }
}


// -------------------- معالجة حالة الشفت (التركيز الأساسي) --------------------

async function checkShiftStatus() {
    safeShowLoader('جاري التحقق من حالة الشفت...');
    try {
        const q = query(shiftsRef, where("isActive", "==", true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            // ✅ الحالة المثالية: لا يوجد شفت نشط في قاعدة البيانات
            state.currentShift = null;
            state.currentTrip = null;
            stopTimer();
            showNotification("💡 لا يوجد شفت فعال حالياً.", 'info');
        } else {
            // ⚠️ يوجد شفت نشط في قاعدة البيانات
            const shiftDoc = snapshot.docs[0];
            state.currentShift = { id: shiftDoc.id, ...shiftDoc.data() };
            state.shiftStartTime = state.currentShift.startTime.toDate();

            // التحقق من الرحلة النشطة المرتبطة بهذا الشفت
            await checkActiveTrip(state.currentShift.id); 

            startTimer();
            showNotification(`✅ تم استئناف الشفت #${shiftDoc.id.substring(0, 4)}.`, 'success');
        }

    } catch (error) {
        console.error("❌ خطأ في التحقق من حالة الشفت:", error);
        showNotification("❌ فشل في جلب حالة الشفت. حاول مرة أخرى.", 'error');
    }
    updateUIForActiveShift();
    safeHideLoader();
}

async function checkActiveTrip(shiftId) {
    try {
        const q = query(tripsRef, where("shiftId", "==", shiftId), where("status", "==", "active"));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const tripDoc = snapshot.docs[0];
            state.currentTrip = { id: tripDoc.id, ...tripDoc.data() };
            showNotification(`⚠️ يوجد رحلة نشطة (${tripDoc.id.substring(0, 4)}) مرتبطة بالشفت.`, 'info');
        } else {
            state.currentTrip = null;
        }
    } catch (error) {
        console.error("❌ خطأ في التحقق من الرحلة النشطة:", error);
    }
}


async function startShift() {
    if (state.currentShift) {
        // **معالجة الخطأ الذي ذكره المستخدم:** التحقق مرة أخرى قبل البدء
        showNotification("⚠️ يوجد شفت فعال بالفعل! قم بإنهائه أولاً.", 'error');
        return;
    }

    safeShowLoader("جاري بدء الشفت...");
    try {
        const newShift = {
            startTime: new Date(),
            isActive: true,
            totalIncome: 0,
            totalDistance: 0,
            tripCount: 0,
        };

        const docRef = await addDoc(shiftsRef, newShift);
        
        state.currentShift = { id: docRef.id, ...newShift };
        state.shiftStartTime = newShift.startTime;
        state.isPaused = false;
        
        updateUIForActiveShift();
        startTimer();
        showNotification("✅ تم بدء الشفت بنجاح!", 'success');

    } catch (error) {
        console.error("❌ خطأ في بدء الشفت:", error);
        showNotification("❌ فشل بدء الشفت.", 'error');
    }
    safeHideLoader();
}

async function endShift() {
    if (!state.currentShift) {
        showNotification("⚠️ لا يوجد شفت فعال لإنهاءه.", 'error');
        return;
    }
    
    if (state.currentTrip) {
        showNotification("⚠️ يجب إنهاء الرحلة النشطة أولاً.", 'error');
        return;
    }

    if (!confirm("هل أنت متأكد من إنهاء الشفت الحالي؟")) return;

    safeShowLoader("جاري إنهاء الشفت...");
    try {
        const shiftDocRef = doc(shiftsRef, state.currentShift.id);
        const endTime = new Date();
        
        // 1. تحديث وثيقة الشفت
        await updateDoc(shiftDocRef, {
            endTime: endTime,
            isActive: false,
        });

        // 2. تحديث الإحصائيات الكلية (لضمان الدقة في حالة وجود تأخير في التحديث المباشر)
        // لا نحتاج لعملية هنا لأن تحديث الإحصائيات يتم مع كل رحلة مكتملة (كما في المنطق السابق).

        // 3. إعادة تعيين الحالة والمتغيرات
        state.currentShift = null;
        state.currentTrip = null;
        state.shiftStartTime = null;
        state.isPaused = false;
        stopTimer();
        
        // 4. تحديث الواجهة والـ Stats
        updateUIForActiveShift();
        fetchGlobalStats(); 
        
        showNotification("✅ تم إنهاء الشفت بنجاح!", 'success');

    } catch (error) {
        console.error("❌ خطأ في إنهاء الشفت:", error);
        // **التصحيح الهام هنا:** حتى لو فشل التحديث (بسبب مشاكل اتصال مثلاً)، يجب إعادة التحقق من الحالة.
        // ولكن للتأكد من عدم العودة للحالة العالقة، سنقوم بإظهار رسالة الخطأ فقط ونسمح للمستخدم بإعادة المحاولة.
        showNotification(`❌ فشل إنهاء الشفت: ${error.message || "خطأ غير معروف"}`, 'error');
    }
    safeHideLoader();
}

async function startTrip() {
    if (!state.currentShift) {
        showNotification("⚠️ يجب بدء شفت فعال أولاً!", 'error');
        return; // **هذا يحل المشكلة العالقة 👆**
    }
    if (state.currentTrip) {
        showNotification("⚠️ يوجد رحلة نشطة حالياً. يجب إنهائها أولاً.", 'error');
        return;
    }
    if (state.isPaused) {
        showNotification("⚠️ الشفت موقف مؤقتاً. استأنف الشفت أولاً.", 'error');
        return;
    }

    safeShowLoader("جاري بدء الرحلة...");
    try {
        const newTrip = {
            shiftId: state.currentShift.id,
            startTime: new Date(),
            status: "active",
            distance: 0,
            fare: 0,
        };

        const docRef = await addDoc(tripsRef, newTrip);
        
        state.currentTrip = { id: docRef.id, ...newTrip };

        // تحديث حالة الشفت في قاعدة البيانات (لتسهيل التتبع)
        const shiftDocRef = doc(shiftsRef, state.currentShift.id);
        await updateDoc(shiftDocRef, {
            currentTripId: docRef.id,
        });
        
        updateUIForActiveShift();
        showNotification("✅ تم بدء رحلة جديدة!", 'success');

    } catch (error) {
        console.error("❌ خطأ في بدء الرحلة:", error);
        showNotification("❌ فشل بدء الرحلة.", 'error');
    }
    safeHideLoader();
}


async function endTrip() {
    if (!state.currentTrip || !state.currentShift) {
        showNotification("⚠️ لا توجد رحلة نشطة لإنهاءها.", 'error');
        return;
    }
    
    // **ملاحظة:** هنا يجب إضافة نافذة تطلب إدخال الأجرة والمسافة الفعلية.
    // لغرض التصحيح، سنستخدم قيم افتراضية ونفترض أن الواجهة ستطلب هذه القيم.
    
    const fare = parseFloat(prompt("أدخل الأجرة (ريال سعودي):", "50")) || 0;
    const distance = parseFloat(prompt("أدخل المسافة (كم):", "15")) || 0;
    
    if (fare <= 0 || distance <= 0) {
        showNotification("⚠️ تم إلغاء إنهاء الرحلة أو إدخال قيم غير صالحة.", 'info');
        return;
    }

    safeShowLoader("جاري إنهاء الرحلة وحفظ البيانات...");
    try {
        const tripDocRef = doc(tripsRef, state.currentTrip.id);
        const endTime = new Date();

        // 1. تحديث الرحلة كـ 'completed'
        await updateDoc(tripDocRef, {
            endTime: endTime,
            status: "completed",
            fare: fare,
            distance: distance,
        });

        // 2. تحديث الشفت الحالي (بمعاملة batch لضمان Atomic Operation)
        const batch = writeBatch(db);
        const shiftDocRef = doc(shiftsRef, state.currentShift.id);
        
        // تحديث إجمالي دخل ومسافة وعدد رحلات الشفت
        const newTotalIncome = (state.currentShift.totalIncome || 0) + fare;
        const newTotalDistance = (state.currentShift.totalDistance || 0) + distance;
        const newTripCount = (state.currentShift.tripCount || 0) + 1;

        batch.update(shiftDocRef, {
            totalIncome: newTotalIncome,
            totalDistance: newTotalDistance,
            tripCount: newTripCount,
            currentTripId: null, // إزالة الرحلة النشطة من الشفت
        });

        // 3. تحديث الإحصائيات الكلية
        const statsDocSnap = await getDoc(statsRef);
        let currentStats = statsDocSnap.exists() ? statsDocSnap.data() : { totalIncome: 0, totalDistance: 0, totalTrips: 0 };

        batch.set(statsRef, {
            totalIncome: (currentStats.totalIncome || 0) + fare,
            totalDistance: (currentStats.totalDistance || 0) + distance,
            totalTrips: (currentStats.totalTrips || 0) + 1,
        }, { merge: true });

        await batch.commit();

        // 4. تحديث الحالة والمتغيرات المحلية
        state.currentShift.totalIncome = newTotalIncome;
        state.currentShift.totalDistance = newTotalDistance;
        state.currentShift.tripCount = newTripCount;
        state.currentTrip = null;

        // 5. تحديث الواجهة والـ Stats
        updateUIForActiveShift();
        fetchGlobalStats();

        showNotification(`✅ تم إنهاء الرحلة بنجاح. الأجرة: ${fare} ر.س.`, 'success');

    } catch (error) {
        console.error("❌ خطأ في إنهاء الرحلة:", error);
        showNotification(`❌ فشل إنهاء الرحلة: ${error.message || "خطأ غير معروف"}`, 'error');
    }
    safeHideLoader();
}

function togglePauseShift() { 
    if (!state.currentShift) {
        showNotification("⚠️ لا يوجد شفت فعال لوقفه مؤقتاً.", 'error');
        return;
    }
    if (state.currentTrip) {
        showNotification("⚠️ يجب إنهاء الرحلة النشطة أولاً قبل إيقاف الشفت مؤقتاً.", 'error');
        return;
    }

    state.isPaused = !state.isPaused;
    showNotification(state.isPaused ? "✅ تم إيقاف الشفت مؤقتاً." : "✅ تم استئناف الشفت.", 'success');
    updateUIForActiveShift();
    if (state.isPaused) {
        stopTimer();
    } else {
        startTimer();
    }
}


// -------------------- معالجات الأحداث والتهيئة --------------------

function initializeApp() {
    // 1. جلب الإحصائيات الكلية
    fetchGlobalStats();
    
    // 2. التحقق من حالة الشفت عند تشغيل التطبيق (الأهم لحل المشكلة)
    checkShiftStatus();

    // 3. ربط الأحداث بالأزرار
    if (elements.startShiftBtn) elements.startShiftBtn.addEventListener('click', startShift);
    if (elements.endShiftBtn) elements.endShiftBtn.addEventListener('click', endShift);
    if (elements.startTripBtn) elements.startTripBtn.addEventListener('click', startTrip);
    if (elements.endTripBtn) elements.endTripBtn.addEventListener('click', endTrip);
    if (elements.pauseShiftBtn) elements.pauseShiftBtn.addEventListener('click', togglePauseShift);
}

document.addEventListener('DOMContentLoaded', initializeApp);