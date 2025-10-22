// firebase-config.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { 
  getFirestore, collection, addDoc, updateDoc, doc, getDocs, query, where, getDoc, writeBatch, deleteDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// يجب استبدال هذا التكوين بالتكوين الفعلي الخاص بك
const firebaseConfig = {
  apiKey: "AIzaSyA4kGynSyqJmUHzHbuRNPWzDFWHGGT4",
  authDomain: "trip-tracker-rajeh.firebaseapp.com",
  projectId: "trip-tracker-rajeh",
  storageBucket: "trip-tracker-rajeh.appspot.com",
  messagingSenderId: "1025723412931",
  appId: "1:1025723412931:web:53a9fa6e1a7a5f43a3dbec",
  measurementId: "G-J1RBF8H0CC"
};

// التهيئة (مرة واحدة فقط)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// تصدير الأدوات اللازمة
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
    orderBy 
};