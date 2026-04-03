import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyD286MvFfEtZq2gdZMprEjcWYc0TKwfezo",
    authDomain: "noorent-web.firebaseapp.com",
    projectId: "noorent-web",
    storageBucket: "noorent-web.firebasestorage.app",
    messagingSenderId: "716350593479",
    appId: "1:716350593479:web:4fd66b120f61302a2e61e2",
    measurementId: "G-2VW79HCD1C"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);
export const auth = getAuth(app);
