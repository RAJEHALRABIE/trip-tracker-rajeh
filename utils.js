// utils.js

// العناصر المرجعية للودر والإشعارات
const elements = {
  loading: document.getElementById('loading-overlay'),
};

/**
 * لعرض شاشة التحميل مع رسالة محددة.
 */
export function safeShowLoader(message = 'جاري التحميل...') {
  try {
    if (elements.loading) {
        const p = elements.loading.querySelector('p');
        if (p) p.textContent = message;
        
        elements.loading.style.display = 'flex';
        elements.loading.classList.add('show');
    }
  } catch (e) {}
}

/**
 * لإخفاء شاشة التحميل.
 */
export function safeHideLoader() {
  try { 
    if (elements.loading) {
      elements.loading.style.display = 'none'; 
      elements.loading.classList.remove('show');
    }
  } catch (e) {}
}

/**
 * لعرض إشعار في أعلى الشاشة.
 */
export function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : '💡'}</span>
      <span class="notification-message">${message}</span>
    </div>
  `;
  
  const bgColor = type === 'success' ? 'var(--green, #22c55e)' : type === 'error' ? 'var(--red, #ef4444)' : 'var(--orange, #f59e0b)';

  notification.style.cssText = `
    position: fixed;
    top: 100px;
    left: 20px;
    right: 20px;
    background: ${bgColor};
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

/**
 * لتحويل الثواني إلى تنسيق H:M:S
 */
export function formatTime(totalSeconds) {
    if (totalSeconds < 0) return '00:00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map(v => v < 10 ? '0' + v : v).join(':');
}