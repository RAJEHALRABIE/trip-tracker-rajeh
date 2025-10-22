// update.js — إشعار تحديث النسخة
(function () {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NEW_VERSION_AVAILABLE') showUpdateToast();
  });

  function showUpdateToast() {
    if (document.getElementById('tt-update-toast')) return;
    const box = document.createElement('div');
    box.id = 'tt-update-toast'; box.dir = 'rtl';
    box.style.cssText = 'position:fixed;inset-inline:16px;bottom:16px;background:#111;color:#fff;padding:12px 14px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.2);display:flex;gap:10px;align-items:center;z-index:9999';
    box.innerHTML = '<span>✨ تتوفر نسخة أحدث من التطبيق.</span><button id="tt-update-btn" style="margin-inline-start:auto;background:#00b341;color:#fff;border:none;padding:8px 12px;border-radius:10px;cursor:pointer;">تحديث الآن</button>';
    document.body.appendChild(box);
    document.getElementById('tt-update-btn').onclick = () => {
      if (navigator.serviceWorker && navigator.serviceWorker.controller)
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      setTimeout(() => location.reload(), 600);
    };
  }
})();
