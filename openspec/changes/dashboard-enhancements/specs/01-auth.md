# Spec 01: 認證保護 (Firebase Auth + Middleware)

## 目標

保護前端頁面，僅允許白名單使用者登入查看。

## 詳細規格

### 1. 環境變數

在 `.env.local` 新增：

```
AUTHORIZED_EMAILS=your-email@gmail.com
```

### 2. `src/lib/firebase/auth.ts`

- 初始化 Firebase Client SDK Auth（使用 `getAuth`）
- 提供 `signInWithGoogle()` 函數（使用 `GoogleAuthProvider` + `signInWithPopup`）
- 提供 `signOut()` 函數
- 匯出 `auth` 實例

### 3. `src/components/AuthProvider.tsx`

- `'use client'` 元件
- 使用 `onAuthStateChanged` 監聽登入狀態
- 提供 `useAuth()` hook 回傳 `{ user, loading }`
- 登入成功後呼叫 `/api/auth/session` POST 設定 Cookie
- 登出時呼叫 `/api/auth/session` DELETE 清除 Cookie

### 4. `src/app/api/auth/session/route.ts`

- `POST`: 接收 `idToken`，用 Firebase Admin `verifyIdToken` 驗證
  - 檢查 email 是否在 `AUTHORIZED_EMAILS` 白名單中
  - 建立 Session Cookie（`firebase-session`），有效期 5 天
  - 回傳 200
- `DELETE`: 清除 Session Cookie，回傳 200

### 5. `src/middleware.ts`

- 攔截所有頁面路由（`/`, `/accounting`, `/archive`）
- 排除：`/login`, `/api/webhook/*`, `/api/auth/*`, 靜態資源
- 檢查 `firebase-session` Cookie 合法性
- 無效或過期 → redirect `/login`

### 6. `src/app/login/page.tsx`

- 全螢幕置中的登入畫面
- 顯示應用 Logo + 「Sign in with Google」按鈕
- 登入成功後 redirect 到 `/`

### 7. `src/app/layout.tsx`

- 用 `<AuthProvider>` 包裝整個 App
