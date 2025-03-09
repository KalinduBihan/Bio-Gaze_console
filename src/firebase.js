import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, push, set } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyB_KmmDb6asm8A1drrRiV4XOT8iWCLR-tQ",
  authDomain: "biometricgaze.firebaseapp.com",
  databaseURL: "https://biometricgaze-default-rtdb.firebaseio.com",
  projectId: "biometricgaze",
  storageBucket: "biometricgaze.firebasestorage.app",
  messagingSenderId: "843327441258",
  appId: "1:843327441258:web:19e23507b446bfd6a6fd13",
  measurementId: "G-03EJRFR8LQ",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { database, ref, onValue, push, set };
