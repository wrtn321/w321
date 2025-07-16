// firebase-init.js

// 여기에 복사한 구성 객체 붙여넣기
const firebaseConfig = {
  apiKey: "AIzaSyCUgyBYUhzeVNDrm_Fh8j57o-IJZerRn4E",
  authDomain: "wrtn321-7239c.firebaseapp.com",
  projectId: "wrtn321-7239c",
  storageBucket: "wrtn321-7239c.firebasestorage.app",
  messagingSenderId: "832157655052",
  appId: "1:832157655052:web:da5de07298638505508e29"
};

// Firebase 앱 초기화
const app = firebase.initializeApp(firebaseConfig);
// Firestore 데이터베이스 서비스 초기화
const db = firebase.firestore();