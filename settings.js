// ** settings.js - المصحح **
// تم استيراد التهيئة من الملف المركزي لحل مشكلة initializeApp

import { 
  db, collection, getDocs, deleteDoc, doc, writeBatch, setDoc, getDoc 
} from "./firebase-config.js"; 

// العناصر
const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  importBtn: document.getElementById('import-btn'),
  importFileInput: document.getElementById('import-file-input'),
  deleteAllBtn: document.getElementById('delete-all-btn'),
  incomeGoalInput: document.getElementById('income-goal'),
  hoursGoalInput: document.getElementById('hours-goal'),
  saveGoalsBtn: document.getElementById('save-goals'),
};

// المراجع
const goalsRef = doc(db, "settings", "goals");
const tripsRef = collection(db, "trips");
const shiftsRef = collection(db, "shifts");
const statsRef = doc(db, "stats", "global");


// -------------------- الوظائف المساعدة --------------------

function safeShowLoader(message = 'جاري تنفيذ العملية...') {
  try {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.querySelector('p').textContent = message;
        elements.loadingOverlay.style.display = 'flex';
        elements.loadingOverlay.classList.add('show');
    }
  } catch (error) {
    console.error('❌ خطأ في إظهار اللودر:', error);
  }
}

function safeHideLoader() {
  try {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.style.display = 'none';
      elements.loadingOverlay.classList.remove('show');
    }
  } catch (error) {
    console.error('❌ خطأ في إخفاء اللودر:', error);
  }
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


// -------------------- إدارة الأهداف --------------------

async function fetchGoals() {
    try {
        const docSnap = await getDoc(goalsRef);
        if (docSnap.exists()) {
            const goals = docSnap.data();
            if (elements.incomeGoalInput) elements.incomeGoalInput.value = goals.dailyIncomeGoal || '';
            if (elements.hoursGoalInput) elements.hoursGoalInput.value = goals.dailyHoursGoal || '';
        }
    } catch (error) {
        console.error("❌ خطأ في جلب الأهداف:", error);
    }
}

async function saveGoals() {
    safeShowLoader("جاري حفظ الأهداف...");
    try {
        const incomeGoal = parseFloat(elements.incomeGoalInput.value) || 0;
        const hoursGoal = parseFloat(elements.hoursGoalInput.value) || 0;
        
        if (incomeGoal < 0 || hoursGoal < 0) {
            showNotification("⚠️ يجب أن تكون الأهداف قيمة موجبة.", 'error');
            safeHideLoader();
            return;
        }

        await setDoc(goalsRef, {
            dailyIncomeGoal: incomeGoal,
            dailyHoursGoal: hoursGoal,
            lastUpdated: new Date()
        }, { merge: true });

        showNotification("✅ تم حفظ الأهداف بنجاح.", 'success');
    } catch (error) {
        console.error("❌ خطأ في حفظ الأهداف:", error);
        showNotification("❌ فشل حفظ الأهداف.", 'error');
    }
    safeHideLoader();
}

// -------------------- إدارة البيانات --------------------

async function handleDeleteAllData() {
    if (!confirm("⚠️ تحذير: هل أنت متأكد من حذف جميع بيانات الرحلات والشفتات والإحصائيات نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.")) return;

    safeShowLoader("جاري حذف جميع البيانات...");
    try {
        const batch = writeBatch(db);

        // 1. حذف جميع الرحلات
        const tripsSnapshot = await getDocs(tripsRef);
        tripsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 2. حذف جميع الشفتات
        const shiftsSnapshot = await getDocs(shiftsRef);
        shiftsSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 3. إعادة تعيين الإحصائيات الكلية
        batch.set(statsRef, {
            totalIncome: 0,
            totalDistance: 0,
            totalTrips: 0
        }, { merge: false }); // merge: false لإعادة الكتابة بالكامل

        await batch.commit();
        
        showNotification("✅ تم حذف جميع البيانات بنجاح وإعادة تعيين الإحصائيات.", 'success');

    } catch (error) {
        console.error("❌ خطأ في حذف جميع البيانات:", error);
        showNotification(`❌ فشل حذف البيانات: ${error.message || "خطأ غير معروف"}`, 'error');
    }
    safeHideLoader();
}

// -------------------- وظائف التهيئة --------------------

function initializeSettings() {
    // ربط الأحداث
    if (elements.saveGoalsBtn) elements.saveGoalsBtn.addEventListener('click', saveGoals);
    if (elements.deleteAllBtn) elements.deleteAllBtn.addEventListener('click', handleDeleteAllData);
    
    // جلب الأهداف
    fetchGoals();
}

document.addEventListener('DOMContentLoaded', initializeSettings);