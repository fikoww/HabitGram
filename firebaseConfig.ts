import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDu2zXFQzGFsMXWa9vfyejNHssjsuLdzMw",
  authDomain: "next-phase-of-life.firebaseapp.com",
  projectId: "next-phase-of-life",
  storageBucket: "next-phase-of-life.firebasestorage.app",
  messagingSenderId: "194958713490",
  appId: "1:194958713490:web:cac6402e04130333eb7c4b",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);