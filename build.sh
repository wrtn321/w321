#!/bin/bash

echo "Writing to existing firebase-init.js file..."

# 기존 echo 명령어에서, 파일 경로 앞에 있는 > 기호를 유지하는 것이 중요합니다.
# > 기호는 "파일을 새로 만들거나, 있으면 덮어쓴다"는 의미입니다.

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

echo "firebase-init.js file updated successfully."
