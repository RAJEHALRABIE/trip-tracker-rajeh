// settings.js

import { 
  db, collection, getDocs, deleteDoc, doc, writeBatch, setDoc, getDoc
} from "./firebase-config.js"; 
import { safeShowLoader, safeHideLoader, showNotification } from "./utils.js"; 

// العناصر
const elements = {
  goalsForm: document.getElementById('goalsForm'),
  dailyIncomeGoal: document.getElementById('dailyIncomeGoal'),
  monthlyTripsGoal: document.getElementById('monthlyTripsGoal'),
  saveGoalsBtn: document.getElementById('saveGoalsBtn'),
  clearDataBtn: document.getElementById('clearDataBtn'),
  goalsStatus: document.getElementById('goalsStatus'),
};

// المراجع
const shiftsRef = collection(db, "shifts");
const tripsRef = collection(db, "trips");
const statsRef = doc(db, "stats", "global");
const goalsDocRef = doc(db, "settings", "goals");


// -------------------- إدارة الأهداف --------------------

async function fetchGoals() {
    safeShowLoader('جاري جلب الأهداف...');
    try {
        const docSnap = await getDoc(goalsDocRef);
        if (docSnap.exists()) {
            const goals = docSnap.data();
            if (elements.dailyIncomeGoal) elements.dailyIncomeGoal.value = goals.dailyIncomeGoal || '';
            if (elements.monthlyTripsGoal) elements.monthlyTripsGoal.value = goals.monthlyTripsGoal || '';
            
            if (elements.goalsStatus) {
                elements.goalsStatus.textContent = `آخر تحديث: ${new Date(goals.lastUpdated.toDate()).toLocaleTimeString()}`;
            }
        } else {
            if (elements.goalsStatus) elements.goalsStatus.textContent = 'لم يتم تعيين أهداف بعد.';
        }
    } catch (error) {
        console.error("❌ خطأ في جلب الأهداف:", error);
        showNotification("❌ فشل جلب الأهداف.", 'error');
    }
    safeHideLoader();
}

async function saveGoals(e) {
    e.preventDefault();
    
    const dailyIncomeGoal = parseFloat(elements.dailyIncomeGoal.value) || 0;
    const monthlyTripsGoal = parseInt(elements.monthlyTripsGoal.value) || 0;

    if (dailyIncomeGoal <= 0 && monthlyTripsGoal <= 0) {
        showNotification("⚠️ يجب إدخال قيمة صحيحة لهدف الدخل أو هدف الرحلات.", 'info');
        return;
    }

    safeShowLoader('جاري حفظ الأهداف...');
    try {
        await setDoc(goalsDocRef, {
            dailyIncomeGoal: dailyIncomeGoal,
            monthlyTripsGoal: monthlyTripsGoal,
            lastUpdated: new Date(),
        }, { merge: true });

        showNotification("✅ تم حفظ الأهداف بنجاح!", 'success');
        fetchGoals(); // إعادة جلب الأهداف لتحديث حالة التحديث
    } catch (error) {
        console.error("❌ خطأ في حفظ الأهداف:", error);
        showNotification("❌ فشل حفظ الأهداف.", 'error');
    }
    safeHideLoader();
}


// -------------------- إدارة البيانات --------------------

async function clearAllData() {
    if (!confirm("⚠️ تحذير: هل أنت متأكد تمامًا من مسح جميع بيانات الشفتات والرحلات والإحصائيات الكلية؟ لا يمكن التراجع عن هذا الإجراء.")) return;
    
    safeShowLoader('جاري مسح جميع البيانات...');
    try {
        const batch = writeBatch(db);

        // 1. مسح الرحلات
        const tripsSnapshot = await getDocs(tripsRef);
        tripsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 2. مسح الشفتات
        const shiftsSnapshot = await getDocs(shiftsRef);
        shiftsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 3. إعادة تعيين الإحصائيات الكلية
        batch.set(statsRef, {
            totalIncome: 0,
            totalDistance: 0,
            totalTrips: 0,
        });

        await batch.commit();

        showNotification("✅ تم مسح جميع البيانات بنجاح!", 'success');
        fetchGoals(); // لتحديث الواجهة
    } catch (error) {
        console.error("❌ خطأ في مسح البيانات:", error);
        showNotification(`❌ فشل مسح البيانات: ${error.message}`, 'error');
    }
    safeHideLoader();
}


// -------------------- التهيئة --------------------

function initializeSettings() {
    fetchGoals();

    if (elements.goalsForm) elements.goalsForm.addEventListener('submit', saveGoals);
    if (elements.clearDataBtn) elements.clearDataBtn.addEventListener('click', clearAllData);
}

document.addEventListener('DOMContentLoaded', initializeSettings);