import { 
  db, collection, getDocs, deleteDoc, doc, writeBatch, setDoc, getDoc 
} from "./firebase-config.js";

const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  importBtn: document.getElementById('import-btn'),
  importFileInput: document.getElementById('import-file-input'),
  deleteAllBtn: document.getElementById('delete-all-btn'),
  incomeGoalInput: document.getElementById('income-goal'),
  hoursGoalInput: document.getElementById('hours-goal'),
  saveGoalsBtn: document.getElementById('save-goals'),
};

document.addEventListener('DOMContentLoaded', () => {
  elements?.importBtn?.addEventListener('click', () => elements.importFileInput?.click());
  elements?.importFileInput?.addEventListener('change', handleFileUpload);
  elements?.deleteAllBtn?.addEventListener('click', deleteAllData);
  elements?.saveGoalsBtn?.addEventListener('click', saveGoals);
  
  loadGoals();
});

// ====================================================================
//                            🎯 الأهداف
// ====================================================================

// تحميل الأهداف
async function loadGoals() {
  try {
    const settingsRef = doc(db, 'config', 'userSettings');
    const docSnap = await getDoc(settingsRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (elements.incomeGoalInput) elements.incomeGoalInput.value = data.dailyIncomeGoal || 300;
      if (elements.hoursGoalInput) elements.hoursGoalInput.value = data.dailyHoursGoal || 8;
    }
  } catch (error) {
    console.error('❌ خطأ في تحميل الأهداف:', error);
  }
}

// حفظ الأهداف
async function saveGoals() {
  try {
    const incomeGoal = parseInt(elements.incomeGoalInput?.value) || 300;
    const hoursGoal = parseInt(elements.hoursGoalInput?.value) || 8;
    
    if (incomeGoal < 0 || hoursGoal < 0) {
      alert('يرجى إدخال قيم صحيحة للأهداف');
      return;
    }
    
    safeShowLoader('جاري حفظ الأهداف...');
    
    const settingsRef = doc(db, 'config', 'userSettings');
    await setDoc(settingsRef, {
      dailyIncomeGoal: incomeGoal,
      dailyHoursGoal: hoursGoal,
      updatedAt: new Date()
    }, { merge: true });

    safeHideLoader();
    showNotification('تم حفظ الأهداف بنجاح!', 'success');

  } catch (error) {
    console.error('❌ خطأ في حفظ الأهداف:', error);
    safeHideLoader();
    showNotification('فشل حفظ الأهداف', 'error');
  }
}

// ====================================================================
//                          🗑️ مسح البيانات
// ====================================================================

// مسح جميع البيانات
async function deleteAllData() {
  if (!confirm("⚠️ تحذير شديد!\n\nهل أنت متأكد من مسح جميع بيانات الشفتات والرحلات؟ لا يمكن التراجع عن هذا الإجراء.")) {
    return;
  }

  safeShowLoader('جاري مسح جميع البيانات...');

  try {
    const shiftsRef = collection(db, 'shifts');
    const shiftsSnapshot = await getDocs(shiftsRef);
    const batchSize = 100;
    let totalDeleted = 0;

    // مسح الشفتات ورحلاتها في دفعات (batches)
    for (let i = 0; i < shiftsSnapshot.docs.length; i += batchSize) {
      const batch = writeBatch(db);
      const batchDocs = shiftsSnapshot.docs.slice(i, i + batchSize);

      for (const shiftDoc of batchDocs) {
        const shiftId = shiftDoc.id;

        // 1. مسح الرحلات الفرعية (Subcollection - Trips)
        const tripsRef = collection(db, 'shifts', shiftId, 'trips');
        const tripsSnapshot = await getDocs(tripsRef);
        
        for (const tripDoc of tripsSnapshot.docs) {
          batch.delete(doc(db, 'shifts', shiftId, 'trips', tripDoc.id));
        }

        // 2. مسح الشفت نفسه
        batch.delete(doc(db, 'shifts', shiftId));
        totalDeleted++;
      }
      
      await batch.commit();
    }
    
    // مسح إعدادات المستخدم (الأهداف)
    await deleteDoc(doc(db, 'config', 'userSettings'));

    // تنظيف التخزين المحلي
    localStorage.removeItem('activeShiftId');
    localStorage.removeItem('currentTripId');

    safeHideLoader();
    showNotification(`تم مسح ${totalDeleted} شفت وجميع رحلاتها بنجاح!`, 'success');

  } catch (error) {
    console.error('❌ خطأ في مسح البيانات:', error);
    safeHideLoader();
    showNotification('فشل في مسح البيانات. تحقق من الاتصال.', 'error');
  }
}


// ====================================================================
//                          📥 استيراد البيانات (Mock)
// ====================================================================

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.json')) {
    showError('يرجى اختيار ملف JSON صالح.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const jsonContent = JSON.parse(e.target.result);
      await importData(jsonContent);
    } catch (error) {
      console.error('❌ خطأ في معالجة الملف:', error);
      showError('فشل في تحليل ملف JSON. تأكد من سلامة التنسيق.');
    }
  };
  reader.readAsText(file);
}

// وظيفة وهمية (Mock) للاستيراد
async function importData(data) {
  safeShowLoader('جاري استيراد البيانات...');
  try {
    // هنا يجب إضافة منطق الاستيراد الفعلي لـ Firestore
    // For now, it's just a placeholder to show the UI flow
    console.log('بيانات للاستيراد (وهمية):', data);
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // محاكاة وقت التحميل

    safeHideLoader();
    showNotification(`تم محاكاة استيراد ${data.length || 0} عنصر بنجاح!`, 'success');
  } catch (error) {
    console.error('❌ خطأ في الاستيراد:', error);
    safeHideLoader();
    showNotification('فشل الاستيراد.', 'error');
  }
}


// ====================================================================
//                        📢 الإشعارات والتحميل
// ====================================================================

function safeShowLoader(message = 'جاري تنفيذ العملية...') {
  try {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.querySelector('p').textContent = message;
      elements.loadingOverlay.style.display = 'flex';
      setTimeout(() => {
        elements.loadingOverlay.classList.add('show');
      }, 10);
    }
  } catch (error) {
    console.error('❌ خطأ في إظهار اللودر:', error);
  }
}

function safeHideLoader() {
  try {
    if (elements.loadingOverlay) {
      elements.loadingOverlay.classList.remove('show');
      setTimeout(() => {
        elements.loadingOverlay.style.display = 'none';
      }, 300);
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
      <span class="notification-icon">${type === 'success' ? '✅' : '❌'}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;
  
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    left: 20px;
    right: 20px;
    background: ${type === 'success' ? 'var(--green)' : 'var(--red)'};
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);\
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
    setTimeout(() => notification.remove(), 300);
  }, 4000);
}

function showError(message) {
  showNotification(message, 'error');
}