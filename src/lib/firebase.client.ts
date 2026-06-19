"use client";
// Firebase 클라이언트 SDK (브라우저 — 구글 로그인용)
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// 환경변수에 BOM(U+FEFF)/공백이 끼어드는 경우가 있어 방어적으로 제거
const clean = (v?: string) => v?.replace(/^﻿/, "").trim();

const config = {
  apiKey: clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
  authDomain: clean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: clean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: clean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  measurementId: clean(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID),
};

export const clientApp: FirebaseApp =
  getApps()[0] ?? initializeApp(config);
export const clientAuth: Auth = getAuth(clientApp);
export const clientStorage: FirebaseStorage = getStorage(clientApp);
export const googleProvider = new GoogleAuthProvider();
