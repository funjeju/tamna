import { readFileSync, writeFileSync } from "node:fs";

const compact = JSON.stringify(
  JSON.parse(readFileSync(new URL("./sa.json", import.meta.url))),
);

// 클라이언트(NEXT_PUBLIC) 공개 설정 — 사용자가 제공한 firebaseConfig + 카카오 키
const pub = {
  NEXT_PUBLIC_KAKAO_MAP_KEY: "AIzaSyBSjWBufRrQlTWzHN7K1hw5us4PzlWYQug",
  NEXT_PUBLIC_FIREBASE_API_KEY: "AIzaSyBSjWBufRrQlTWzHN7K1hw5us4PzlWYQug",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "myjejuspace.firebaseapp.com",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "myjejuspace",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "myjejuspace.firebasestorage.app",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "274235016737",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:274235016737:web:7b4b30d167f5bfce204560",
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: "G-YJDR1MS1NM",
};

const lines = [
  `FIREBASE_SERVICE_ACCOUNT='${compact}'`,
  ...Object.entries(pub).map(([k, v]) => `${k}=${v}`),
];

writeFileSync(new URL("../.env.local", import.meta.url), lines.join("\n") + "\n");
console.log("ok: wrote .env.local with", lines.length, "vars");
