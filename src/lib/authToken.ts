// 현재 로그인 사용자의 Firebase ID 토큰을 모듈 전역에 보관.
// AuthProvider 가 갱신하고, fetch 헬퍼들이 Authorization 헤더로 사용한다.
let currentToken: string | null = null;

export function setAuthToken(t: string | null) {
  currentToken = t;
}

export function authHeaders(base: HeadersInit = {}): HeadersInit {
  return currentToken
    ? { ...base, Authorization: `Bearer ${currentToken}` }
    : base;
}
