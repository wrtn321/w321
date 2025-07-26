#!/bin/bash

echo "Creating firebase-init.js file..."

# Netlify/Vercel의 환경 변수를 읽어서 firebase-init.js 파일을 생성합니다.
# 각 줄 끝에 있는 역슬래시(\)는 "명령어가 아직 끝나지 않고 다음 줄로 이어집니다" 라는 뜻입니다.

echo "const firebaseConfig = { \
  apiKey: \"${FIREBASE_API_KEY}\", \
  authDomain: \"${FIREBASE_AUTH_DOMAIN}\", \
  projectId: \"${FIREBASE_PROJECT_ID}\", \
  storageBucket: \"${FIREBASE_STORAGE_BUCKET}\", \
  messagingSenderId: \"${FIREBASE_MESSAGING_SENDER_ID}\", \
  appId: \"${FIREBASE_APP_ID}\" \
}; \
\
firebase.initializeApp(firebaseConfig);" > firebase-init.js

echo "firebase-init.js file created successfully."
