// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, doc,
  getDocs, query, where, getDoc, writeBatch, deleteDoc, orderBy
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// إعدادات Firebase الصحيحة من لوحة التحكم
const firebaseConfig = {
  apiKey: "AIzaSyAk0y83VxqUCH4JhoDmzxPRbPz0FWi6OT4",
  authDomain: "trip-tracker-rajeh.firebaseapp.com",
  projectId: "trip-tracker-rajeh",
  storageBucket: "trip-tracker-rajeh.appspot.com",
  messagingSenderId: "1025733612933",
  appId: "1:1025733612933:web:63a9b1eb7a6f35e3a0e0c",
  measurementId: "G-1S9X5NSZ6Q",
};

// التهيئة
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// تصدير الدوال
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
  orderBy,
};
