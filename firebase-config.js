// ** firebase-config.js **
// هذا الملف يقوم بتهيئة Firebase مرة واحدة وتصدير الكائنات اللازمة
// هذا يحل مشكلة initializeApp has already been declared بشكل جذري.

import { 
  initializeApp 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where, getDoc, 
  writeBatch, deleteDoc, setDoc, orderBy, onSnapshot // استيراد onSnapshot لـ app.js
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// تكوين Firebase (التهيئة لمرة واحدة)
const firebaseConfig = {
  apiKey: "AIzaSyA4kGynSyqJmUHzHbuRNPWzDFWHGGT4",
  authDomain: "trip-tracker-rajeh.firebaseapp.com",
  projectId: "trip-tracker-rajeh",
  storageBucket: "trip-tracker-rajeh.appspot.com",
  messagingSenderId: "1025723412931",
  appId: "1:1025723412931:web:53a9fa6e1a7a5f43a3dbec",
  measurementId: "G-J1RBF8H0CC"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// تصدير جميع الكائنات والدوال للاستخدام
export { 
    db, 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    getDocs, 
    query, 
    where, 
    getDoc, 
    writeBatch,
    deleteDoc,
    setDoc,
    orderBy,
    onSnapshot 
};