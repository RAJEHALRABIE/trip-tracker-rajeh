// app.js - المصحح والنهائي

import { 
  db, collection, addDoc, updateDoc, doc, getDocs, query, where, getDoc, writeBatch 
} from "./firebase-config.js"; 
import { safeShowLoader, safeHideLoader, showNotification, formatTime } from "./utils.js"; 

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
};

// المراجع
const shiftsRef = collection(db, "shifts");
const tripsRef = collection(db, "trips");
const statsRef = doc(db, "stats", "global");

// المتغيرات العامة لإدارة حالة التطبيق
let state = {
  currentShift: null, 
  currentTrip: null,  
  shiftStartTime: null,
  isPaused: false,
  timerInterval: null,
};


// -------------------- إدارة الواجهة والوقت --------------------

function updateUIForActiveShift() {
    const isActive = !!state.currentShift; 
    const isTripActive = !!state.currentTrip;
    
    // حالة الشفت (نشط / غير نشط)
    if(elements.noShiftState) elements.noShiftState.style.display = isActive ? 'none' : 'block';
    if(elements.activeShiftState) elements.activeShiftState.style.display = isActive ? 'block' : 'none';

    if (isActive) {
        // حالة الرحلة (نشطة / غير نشطة)
        if(elements.noTripState) elements.noTripState.style.display = isTripActive ? 'none' : 'block';
        if(elements.activeTripState) elements.activeTripState.style.display = isTripActive ? 'block' : 'none';

        // تحديث إحصائيات الشفت
        if(elements.shiftIncome) elements.shiftIncome.textContent = `${(state.currentShift.totalIncome || 0).toFixed(2)} ر.س`;
        if(elements.shiftTrips) elements.shiftTrips.textContent = `${state.currentShift.tripCount || 0}`;

        // حالة الإيقاف المؤقت
        if (elements.pauseShiftBtn) {
            elements.pauseShiftBtn.textContent = state.isPaused ? 'استئناف الشفت' : 'إيقاف مؤقت';
            elements.pauseShiftBtn.classList.toggle('btn-secondary', state.isPaused);
            elements.pauseShiftBtn.classList.toggle('btn-primary', !state.isPaused);
        }

        // تحديث حالة الشفت الرئيسية
        if(elements.shiftStatus) elements.shiftStatus.textContent = isTripActive 
            ? 'رحلة نشطة' 
            : state.isPaused ? 'شفت موقف مؤقتاً' : 'شفت نشط';
    }
}

function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);

    state.timerInterval = setInterval(() => {
        if (!state.currentShift || state.isPaused) return;

        const startTime = state.shiftStartTime ? state.shiftStartTime.getTime() : new Date().getTime(); 
        const durationSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        if(elements.shiftDuration) elements.shiftDuration.textContent = formatTime(durationSeconds);
    }, 1000);
}

function stopTimer() {
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
        state.timerInterval = null;
        if(elements.shiftDuration) elements.shiftDuration.textContent = '00:00:00';
    }
}

async function fetchGlobalStats() {
    try {
        const docSnap = await getDoc(statsRef);
        if (docSnap.exists()) {
            const stats = docSnap.data();
            if(elements.globalTotalIncome) elements.globalTotalIncome.textContent = `${(stats.totalIncome || 0).toFixed(2)} ر.س`;
            if(elements.globalTotalDistance) elements.globalTotalDistance.textContent = `${(stats.totalDistance || 0).toFixed(2)} كم`;
        }
    } catch (error) {
        console.error("❌ خطأ في جلب الإحصائيات الكلية:", error);
    }
}


// -------------------- معالجة حالة الشفت (التركيز الأساسي) --------------------

async function checkActiveTrip(shiftId) {
    try {
        const q = query(tripsRef, where("shiftId", "==", shiftId), where("status", "==", "active"));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const tripDoc = snapshot.docs[0];
            state.currentTrip = { id: tripDoc.id, ...tripDoc.data() };
            return true;
        } else {
            state.currentTrip = null;
            return false;
        }
    } catch (error) {
        console.error("❌ خطأ في التحقق من الرحلة النشطة:", error);
        return false;
    }
}


async function checkShiftStatus() {
    safeShowLoader('جاري التحقق من حالة الشفت...');
    try {
        const q = query(shiftsRef, where("isActive", "==", true));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            state.currentShift = null; 
            state.currentTrip = null; 
            stopTimer();
        } else {
            const shiftDoc = snapshot.docs[0];
            state.currentShift = { id: shiftDoc.id, ...shiftDoc.data() };
            state.shiftStartTime = state.currentShift.startTime ? state.currentShift.startTime.toDate() : new Date(); 

            await checkActiveTrip(state.currentShift.id); 

            startTimer();
            showNotification(`✅ تم استئناف الشفت النشط.`, 'success');
        }

    } catch (error) {
        console.error("❌ خطأ حرج في التحقق من حالة الشفت:", error);
        showNotification("❌ فشل الاتصال بقاعدة البيانات. تحقق من اتصالك.", 'error');
        // إذا فشل التحقق، نفترض عدم وجود شفت فعال محلياً لتجنب التناقض
        state.currentShift = null; 
        state.currentTrip = null; 
    }
    
    // ضمان إغلاق اللودر وتحديث الواجهة في أي حال
    finally {
      updateUIForActiveShift();
      safeHideLoader();
    }
}


async function startShift() {
    // 1. إجراء التحقق المزدوج الإجباري من قاعدة البيانات
    safeShowLoader("جاري التحقق...");
    await checkShiftStatus(); 
    safeHideLoader();

    if (state.currentShift) {
        // حل مشكلة التناقض: إذا وجد شفت بعد التحقق، نمنع البدء
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
    
    if (await checkActiveTrip(state.currentShift.id)) { 
        showNotification("⚠️ يجب إنهاء الرحلة النشطة أولاً.", 'error');
        return;
    }

    if (!confirm("هل أنت متأكد من إنهاء الشفت الحالي؟")) return;

    safeShowLoader("جاري إنهاء الشفت...");
    try {
        const shiftDocRef = doc(shiftsRef, state.currentShift.id);
        
        await updateDoc(shiftDocRef, {
            endTime: new Date(),
            isActive: false,
        });

        showNotification("✅ تم إنهاء الشفت بنجاح!", 'success');

    } catch (error) {
        console.error("❌ خطأ في إنهاء الشفت:", error);
        showNotification(`❌ فشل إنهاء الشفت. تم إزالة الشفت محلياً: ${error.message}`, 'error');
    }
    
    // إعادة ضبط الحالة والمتغيرات محلياً في كل الأحوال (الحل لمنع العودة للحالة العالقة)
    state.currentShift = null;
    state.currentTrip = null;
    state.shiftStartTime = null;
    state.isPaused = false;
    stopTimer();
    updateUIForActiveShift();
    fetchGlobalStats(); 
    
    safeHideLoader();
}

async function startTrip() {
    if (!state.currentShift) {
        showNotification("⚠️ لا يمكنك بدء رحلة حتى تبدأ شفت فعال!", 'error');
        return; 
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

        const batch = writeBatch(db);
        
        batch.update(tripDocRef, {
            endTime: endTime,
            status: "completed",
            fare: fare,
            distance: distance,
        });

        const shiftDocRef = doc(shiftsRef, state.currentShift.id);
        const newTotalIncome = (state.currentShift.totalIncome || 0) + fare;
        const newTotalDistance = (state.currentShift.totalDistance || 0) + distance;
        const newTripCount = (state.currentShift.tripCount || 0) + 1;

        batch.update(shiftDocRef, {
            totalIncome: newTotalIncome,
            totalDistance: newTotalDistance,
            tripCount: newTripCount,
            currentTripId: null, 
        });

        const statsDocSnap = await getDoc(statsRef);
        let currentStats = statsDocSnap.exists() ? statsDocSnap.data() : { totalIncome: 0, totalDistance: 0, totalTrips: 0 };

        batch.set(statsRef, {
            totalIncome: (currentStats.totalIncome || 0) + fare,
            totalDistance: (currentStats.totalDistance || 0) + distance,
            totalTrips: (currentStats.totalTrips || 0) + 1,
        }, { merge: true });

        await batch.commit();

        state.currentShift.totalIncome = newTotalIncome;
        state.currentShift.totalDistance = newTotalDistance;
        state.currentShift.tripCount = newTripCount;
        state.currentTrip = null;

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
    fetchGlobalStats();
    checkShiftStatus(); 

    if (elements.startShiftBtn) elements.startShiftBtn.addEventListener('click', startShift);
    if (elements.endShiftBtn) elements.endShiftBtn.addEventListener('click', endShift);
    if (elements.startTripBtn) elements.startTripBtn.addEventListener('click', startTrip);
    if (elements.endTripBtn) elements.endTripBtn.addEventListener('click', endTrip);
    if (elements.pauseShiftBtn) elements.pauseShiftBtn.addEventListener('click', togglePauseShift);
}

document.addEventListener('DOMContentLoaded', initializeApp);