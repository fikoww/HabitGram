import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAhOPtRxCtbuMDNfcZ4Dujf7BtXA1RzFMs",
  authDomain: "habit-gram.firebaseapp.com",
  projectId: "habit-gram",
  storageBucket: "habit-gram.firebasestorage.app",
  messagingSenderId: "912301275529",
  appId: "1:912301275529:web:fb467f95a4034f4b874958",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);