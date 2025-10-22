// firebase-config.js — DROP-IN MINIMAL FIX (no other changes)
// Exact config for trip-tracker-rajeh. Replace your existing file with this one ONLY.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAk0y83VxqUCH4JhoDmzxPRbPz0FWi6OT4",
  authDomain: "trip-tracker-rajeh.firebaseapp.com",
  projectId: "trip-tracker-rajeh",
  storageBucket: "trip-tracker-rajeh.appspot.com",
  messagingSenderId: "1025733612933",
  appId: "1:1025733612933:web:63a9b1eb7a6f35e3a0e0c",
  measurementId: "G-1S9X5NSZ6Q",
};

export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
