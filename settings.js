// استيراد قاعدة البيانات من settings.html
import { db } from './settings.html'; 
// استيراد دوال Firestore
import { 
  collection, getDocs, deleteDoc, doc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// --- عناصر واجهة المستخدم ---
const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  importBtn: document.getElementById('import-btn'),
  importFileInput: document.getElementById('import-file-input'),
  deleteAllBtn: document.getElementById('delete-all-btn'),
};

// --- تهيئة الصفحة ---
document.addEventListener('DOMContentLoaded', initializeSettings);

function initializeSettings() {
  addEventListeners();
}

function addEventListeners() {
  elements.importBtn.addEventListener('click', () => {
    elements.importFileInput.click();
  });
  elements.importFileInput.addEventListener('change', handleFileUpload);
  elements.deleteAllBtn.addEventListener('click', deleteAllData);
}

// --- 1. مسح كل البيانات ---
async function deleteAllData() {
  // تأكيد مزدوج لخطورة الإجراء
  if (!confirm("تحذير! هل أنت متأكد من رغبتك في مسح **كل** بياناتك؟")) {
    return;
  }
  if (!confirm("تأكيد نهائي: سيتم حذف جميع الشفتات والرحلات. لا يمكن التراجع عن هذا الإجراء.")) {
    return;
  }
  
  showLoading("جاري مسح جميع البيانات...");
  
  try {
    const shiftsRef = collection(db, 'shifts');
    const shiftsSnapshot = await getDocs(shiftsRef);
    
    if (shiftsSnapshot.empty) {
      alert("لا توجد بيانات لمسحها.");
      hideLoading();
      return;
    }

    const batch = writeBatch(db);

    for (const shiftDoc of shiftsSnapshot.docs) {
      const shiftId = shiftDoc.id;
      
      // حذف الرحلات (subcollection)
      const tripsRef = collection(db, 'shifts', shiftId, 'trips');
      const tripsSnapshot = await getDocs(tripsRef);
      if (!tripsSnapshot.empty) {
        tripsSnapshot.forEach(tripDoc => {
          batch.delete(tripDoc.ref);
        });
      }
      
      // إضافة الشفت نفسه لعملية الحذف
      batch.delete(shiftDoc.ref);
    }
    
    // تنفيذ الحذف دفعة واحدة
    await batch.commit();

    alert("تم مسح جميع البيانات بنجاح.");
    // تحديث الصفحة الرئيسية لإظهار الإحصائيات الصفرية
    window.location.href = 'index.html'; 

  } catch (error) {
    console.error("خطأ فادح أثناء مسح البيانات:", error);
    alert("حدث خطأ أثناء محاولة مسح البيانات. الرجاء المحاولة مرة أخرى.");
  } finally {
    hideLoading();
  }
}

// --- 2. استيراد البيانات ---
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file || file.type !== 'application/json') {
    alert("الرجاء اختيار ملف JSON صحيح.");
    return;
  }
  
  const reader = new FileReader();
  
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.shifts) {
        throw new Error("ملف JSON غير متوافق.");
      }
      
      showLoading("جاري استيراد البيانات...");
      
      // (ملاحظة: هذا استيراد بسيط. الاستيراد المتقدم يتطلب معالجة التواريخ)
      // سنفترض أن التواريخ مخزنة كنصوص ISO
      const batch = writeBatch(db);
      
      for (const shift of data.shifts) {
        const shiftId = shift.id; // افتراض وجود ID
        const shiftData = { ...shift };
        delete shiftData.id;
        
        // تحويل التواريخ النصية إلى Timestamps
        if (shiftData.startTime) shiftData.startTime = new Date(shiftData.startTime);
        if (shiftData.endTime) shiftData.endTime = new Date(shiftData.endTime);
        
        const shiftRef = doc(db, 'shifts', shiftId);
        batch.set(shiftRef, shiftData);
        
        // استيراد الرحلات التابعة
        if (shift.trips && Array.isArray(shift.trips)) {
          for (const trip of shift.trips) {
            const tripId = trip.id;
            const tripData = { ...trip };
            delete tripData.id;
            
            if (tripData.startTime) tripData.startTime = new Date(tripData.startTime);
            if (tripData.endTime) tripData.endTime = new Date(tripData.endTime);
            
            const tripRef = doc(db, 'shifts', shiftId, 'trips', tripId);
            batch.set(tripRef, tripData);
          }
        }
      }
      
      await batch.commit();
      
      alert(`تم استيراد ${data.shifts.length} شفت بنجاح.`);
      window.location.href = 'index.html';

    } catch (error) {
      console.error("خطأ في قراءة أو استيراد الملف:", error);
      alert("فشل استيراد الملف. تأكد من أن الملف بصيغة JSON الصحيحة.");
    } finally {
      hideLoading();
    }
  };
  
  reader.readAsText(file);
}


// --- دوال مساعدة ---
function showLoading(message = 'جاري تنفيذ العملية...') {
  elements.loadingOverlay.querySelector('p').textContent = message;
  elements.loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  elements.loadingOverlay.style.display = 'none';
}