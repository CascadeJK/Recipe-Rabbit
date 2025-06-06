import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD0RWdJSkJwBbVmpHArmHat3zTFKZJqF00",
  authDomain: "recipe-rabbit-8a946.firebaseapp.com",
  projectId: "recipe-rabbit-8a946",
  storageBucket: "recipe-rabbit-8a946.firebasestorage.app",
  messagingSenderId: "1003438566668",
  appId: "1:1003438566668:web:f4dcfcdb72849fa8c4ad29",
  measurementId: "G-876SRPQ0MY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;