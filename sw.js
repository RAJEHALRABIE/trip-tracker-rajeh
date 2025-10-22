const CACHE_NAME = 'trip-tracker-v16'; // تم تغيير الإصدار هنا
const urlsToCache = [
  '/',
  '/index.html',
  '/reports.html',
  '/analytics.html',
  '/settings.html',
  '/style.css',
  '/app.js',
  '/reports.js',
  '/analytics.js',
  '/settings.js',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
];

// جميع الأيقونات الـ 25 (لضمان حفظها في الكاش)
const allIcons = [
  'home.png', 'reports.png', 'analytics.png', 'settings.png',
  'play.png', 'stop.png', 'car.png', 'flag.png', 'time.png',
  'cash.png', 'distance.png', 'live.png', 'download.png',
  'edit.png', 'upload.png', 'delete.png', 'search.png',
  'details.png', 'stats-icon.png', 'global-stats.png',
  'calendar.png', 'clock.png', 'csv.png', 'pdf.png',
  'icon-192.png', 'icon-512.png', 'finish-flag.png',
  'dollar.png', 'target.png', 'save.png', 'map-pin.png', // تم إضافة أيقونات إضافية هنا
];

// إضافة مسارات الأيقونات إلى الكاش
urlsToCache.push(...allIcons.map(icon => `assets/icons/${icon}`));

// التثبيت
self.addEventListener('install', (event) => {
  console.log('Service Worker: التثبيت');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: تخزين الملفات في الكاش');
        return cache.addAll(urlsToCache);
      })
  );
});

// التنشيط
self.addEventListener('activate', (event) => {
  console.log('Service Worker: التنشيط');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: حذف الكاش القديم:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// الجلب
self.addEventListener('fetch', (event) => {
  // تجاهل طلبات Firebase وخرائط Google
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis') ||
      event.request.url.includes('gstatic')) {
    return fetch(event.request);
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then((fetchResponse) => {
          if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
            return fetchResponse;
          }

          const responseToCache = fetchResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });

          return fetchResponse;
        });
      })
  );
});