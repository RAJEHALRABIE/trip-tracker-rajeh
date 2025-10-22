// auth-init.js — توقيع تلقائي مجهول لتلبية قواعد Firestore
(function () {
  try {
    // ننتظر تحميل Firebase من السكربتات (compat CDN) إن وُجدت
    function ready(fn) {
      if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
      else document.addEventListener('DOMContentLoaded', fn);
    }

    ready(function () {
      if (!window.firebase || !firebase.app || !firebase.apps) {
        console.warn('[auth-init] Firebase SDK (compat) غير موجود على الصفحة. لا إجراء.');
        return;
      }
      if (firebase.apps.length === 0) {
        console.warn('[auth-init] لم يتم تهيئة Firebase app. تأكد أن firebase-config.js يستدعي initializeApp.');
        return;
      }

      if (!firebase.auth) {
        console.warn('[auth-init] مكتبة firebase.auth غير محمّلة. أضف firebase-auth-compat.js للصفحة.');
        return;
      }

      // بدء جلسة مجهولة إن لم يوجد مستخدم
      firebase.auth().onAuthStateChanged(function (user) {
        if (!user) {
          firebase
            .auth()
            .signInAnonymously()
            .then(() => console.log('[auth-init] تم تسجيل الدخول المجهول'))
            .catch((err) => console.error('[auth-init] فشل تسجيل الدخول المجهول:', err));
        } else {
          // لديك مستخدم بالفعل
          // console.log('[auth-init] مستخدم نشط:', user.uid);
        }
      });
    });
  } catch (e) {
    console.error('[auth-init] خطأ غير متوقع:', e);
  }
})();
