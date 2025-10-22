<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>التقارير - Trip Tracker</title>
  
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#6b4de6">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
  
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <div id="loading-overlay" class="loading-overlay" style="display: flex;">
    <div class="loading-spinner"></div>
    <p>جاري تحميل التقارير...</p>
  </div>

  <header class="main-header">
    <a href="index.html" class="header-back-btn">→</a>
    <div class="header-title">
      <h1>تقارير الشفتات</h1>
      <span>إدارة وتعديل الرحلات</span>
    </div>
    <div class="header-logo">
      <img src="assets/logo.png" alt="Logo">
    </div>
  </header>

  <main class="main-content">

    <section class="filters-container">
      <div class="search-bar">
        <input type="text" id="search-input" placeholder="ابحث في الرحلات (بالقيمة أو الملاحظة)...">
        <img src="assets/icons/search.png" alt="بحث">
      </div>
      <div class="filter-dropdowns">
        <select id="filter-status">
          <option value="all">كل الحالات</option>
          <option value="completed">مكتملة</option>
          <option value="active">جارية</option>
        </select>
        <select id="filter-period">
          <option value="all">كل الفترات</option>
          <option value="today">اليوم</option>
          <option value="week">هذا الأسبوع</option>
          <option value="month">هذا الشهر</option>
        </select>
      </div>
    </section>

    <div class="active-shift-bar" id="active-shift-bar" style="display: none;">
      <img src="assets/icons/calendar.png" alt="">
      <span><strong>الشفت النشط:</strong> <span id="active-shift-details">...</span></span>
    </div>

    <section id="trips-list" class="trips-list">
      <div id="no-trips-message" class="card-message" style="display: none;">
        <p>لا توجد رحلات تطابق هذا البحث.</p>
      </div>
    </section>

  </main>

  <nav class="bottom-nav">
    <a href="index.html" class="nav-item">
      <img src="assets/icons/home.png" alt="">
      <span>الرئيسية</span>
    </a>
    <a href="reports.html" class="nav-item active">
      <img src="assets/icons/reports.png" alt="">
      <span>التقارير</span>
    </a>
    <a href="analytics.html" class="nav-item">
      <img src="assets/icons/analytics.png" alt="">
      <span>تحليل</span>
    </a>
    <a href="settings.html" class="nav-item">
      <img src="assets/icons/settings.png" alt="">
      <span>الإعدادات</span>
    </a>
  </nav>

  <div id="details-modal" class="modal-overlay" style="display: none;">
    <div class="modal-content">
      <span id="close-details-modal" class="close-btn">&times;</span>
      <h2>تفاصيل الرحلة</h2>
      <div class="details-grid">
        <p><strong>نقطة البداية:</strong> <span id="detail-start-loc">غير متوفر</span></p>
        <p><strong>نقطة النهاية:</strong> <span id="detail-end-loc">غير متوفر</span></p>
        <p><strong>البداية:</strong> <span id="detail-start-time">...</span></p>
        <p><strong>النهاية:</strong> <span id="detail-end-time">...</span></p>
        <p><strong>المدة:</strong> <span id="detail-duration">...</span></p>
        <p><strong>المسافة:</strong> <span id="detail-distance">...</span></p>
        <p><strong>القيمة:</strong> <span id="detail-fare">...</span></p>
        <p><strong>الحالة:</strong> <span id="detail-status">...</span></p>
      </div>
      <button id="details-close-btn" class="btn btn-primary">إغلاق</button>
    </div>
  </div>

  <div id="edit-modal" class="modal-overlay" style="display: none;">
    <div class="modal-content">
      <span id="close-edit-modal" class="close-btn">&times;</span>
      <h2>تعديل الرحلة</h2>
      <input type="hidden" id="edit-shift-id">
      <input type="hidden" id="edit-trip-id">
      
      <label for="edit-fare">قيمة الرحلة (ر.س):</label>
      <input type="number" id="edit-fare" inputmode="decimal">
      
      <label for="edit-distance">المسافة (كم):</label>
      <input type="number" id="edit-distance" inputmode="decimal" step="0.01">
      
      <label for="edit-notes">ملاحظات (اختياري):</label>
      <textarea id="edit-notes" rows="3"></textarea>
      
      <button id="save-edit-btn" class="btn btn-primary">حفظ التعديلات</button>
      <button id="cancel-edit-btn" class="btn btn-secondary">إلغاء</button>
    </div>
  </div>


  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
    import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

    // إعدادات Firebase الخاصة بك (من ملف 1.jpg)
    const firebaseConfig = {
      apiKey: "AIzaSyA4kGynSyqJmUHzHbuRNPWzDFWHGGT4",
      authDomain: "trip-tracker-rajeh.firebaseapp.com",
      projectId: "trip-tracker-rajeh",
      storageBucket: "trip-tracker-rajeh.appspot.com",
      messagingSenderId: "1025723412931",
      appId: "1:1025723412931:web:53a9fa6e1a7a5f43a3dbec",
      measurementId: "G-J1RBF8H0CC"
    };

    // تهيئة Firebase
    const app = initializeApp(firebaseConfig);
    export const db = getFirestore(app);
  </script>

  <script type="module" src="reports.js"></script>

</body>
</html>