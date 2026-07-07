import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";

// Firebase configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyAK4o-WjuH4hbivqnLnAyUsvAvb6-k04jA",
  authDomain: "gen-lang-client-0723923129.firebaseapp.com",
  projectId: "gen-lang-client-0723923129",
  storageBucket: "gen-lang-client-0723923129.firebasestorage.app",
  messagingSenderId: "723348623930",
  appId: "1:723348623930:web:101cb0d3c91ecc41311b03",
  databaseId: "ai-studio-securechat-14ca1f26-3d47-4813-a06c-77f9c2501203"
};

// Initialize Firebase with the correct custom database ID and enable long-polling
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.databaseId);

