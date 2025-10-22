import { app } from './login.html'; // استيراد التطبيق المهيأ
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// تخصيص إعدادات OAuth للمشروع الثاني (trip-tracker-maps-475723)
// هذا هو السر لدمج المشروعين
provider.setCustomParameters({
  'client_id': '1087606954535-0uf57augj1bbt5j5hllg6dop3m5tj9i4.apps.googleusercontent.com'
  // لا نضع الـ client_secret هنا أبداً، فهو سري ويبقى في الخادم (غير مطلوب للـ Web)
});

const loginButton = document.getElementById('login-button');
const loadingSpinner = document.getElementById('loading');

// 1. مراقبة حالة المصادقة
onAuthStateChanged(auth, (user) => {
  if (user) {
    // المستخدم مسجل دخوله
    console.log('المستخدم مسجل:', user.displayName);
    // توجيه المستخدم إلى الصفحة الرئيسية
    if (window.location.pathname.endsWith('login.html') || window.location.pathname === '/') {
      window.location.href = 'index.html';
    }
  } else {
    // المستخدم غير مسجل دخوله
    console.log('المستخدم غير مسجل');
    // التأكد من أن المستخدم في صفحة تسجيل الدخول
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
    loadingSpinner.style.display = 'none';
  }
});

// 2. معالج حدث النقر لزر تسجيل الدخول
if (loginButton) {
  loginButton.addEventListener('click', () => {
    loadingSpinner.style.display = 'block';
    loginButton.style.display = 'none';
    
    signInWithPopup(auth, provider)
      .then((result) => {
        // تم تسجيل الدخول بنجاح
        const user = result.user;
        console.log('تسجيل دخول ناجح:', user.displayName);
        // سيقوم onAuthStateChanged بالتعامل مع التوجيه
      })
      .catch((error) => {
        // معالجة الأخطاء
        console.error('خطأ في تسجيل الدخول:', error);
        alert('حدث خطأ أثناء تسجيل الدخول: ' + error.message);
        loadingSpinner.style.display = 'none';
        loginButton.style.display = 'flex';
      });
  });
}

// 3. دالة تسجيل الخروج (للاستخدام في صفحات أخرى)
export async function logout() {
  try {
    await auth.signOut();
    console.log('تم تسجيل الخروج');
    window.location.href = 'login.html';
  } catch (error) {
    console.error('خطأ في تسجيل الخروج:', error);
  }
}

// 4. دالة للحصول على المستخدم الحالي (للاستخدام في صفحات أخرى)
export function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        // إذا لم يكن هناك مستخدم، أعده إلى صفحة تسجيل الدخول
        console.log("لا يوجد مستخدم، إعادة توجيه لتسجيل الدخول");
        window.location.href = 'login.html';
        reject(new Error('User not authenticated'));
      }
    });
  });
}

export { auth, db }; // db سيتم تهيئته في app.js