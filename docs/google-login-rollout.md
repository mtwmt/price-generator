# Google 身分登入切換

## 目的與範圍

一般登入改用 Google Identity Services 的身分憑證；Google Drive 的雲端連線仍獨立要求授權。
不新增資料表，不搬移報價單，不修改會員角色。既有會員沿用 `users.id` 與本站 session。

前後端位於不同工作目錄。發布前應確認使用中的前端版本，避免部署另一份副本。
後端的 `backups/before-production-login-20260911-NvOWAt.tar.gz` 保存此次正式發布前
完整 `src`，不含 secret 或資料庫。

## API 合約

- 新入口：`POST /api/auth/google/login`。
- 傳輸：`Content-Type: application/json`，內容為 `{ credential, nonce }`。
- `credential` 是 Google 簽發的 ID token，不是本站 access token。
- 後端驗證 Google 簽章、簽發者、用戶端識別碼、效期、已驗證信箱及 nonce，再簽發本站 access/refresh token。
- 回傳格式與舊 `/api/auth/google/exchange` 一致；舊入口保留相容。
- 新入口及本站續期需要既有 `SESSION_JWT_SECRET`；新入口另需 `GOOGLE_CLIENT_IDS`。
  舊授權碼入口仍需原本的 Google client secret，不應刪除。

新入口只接受受信任的網頁來源與 JSON 請求。正式來源為 `https://mtwmt.com`、
`https://mtwmt.github.io`；非正式環境另允許 `http://localhost`（含連接埠）。
不要把 CORS 設定當成身分驗證，也不要為測試放寬正式來源限制。

## 安全上線順序

1. 先備份並部署後端；確認新 API 已存在、舊登入與續期仍正常。
2. 在隔離測試環境啟用前端的 `GOOGLE_ID_TOKEN_LOGIN_ENABLED`，確認登入、續期、登出與
   原有會員資格，完成獨立審查及正式建置。
3. 啟用並發布正式前端，再由授權的使用者驗收真實 Google 登入與獨立的 Drive 連線。

2026-09-11：後端已部署版本 `edaee2d6-e0fc-4cc2-ad1b-a3c5deb4e63e`；
健康、新入口驗證、拒絕無效憑證及不受信任 Origin、舊入口與續期的空白請求驗證均符合預期。
前端 `app.config.ts` 現在明確提供 `useValue: true`；正式網頁需待此提交的 GitHub Actions 發布完成才會啟用。
InjectionToken 本身的預設值仍為 false，方便隔離測試與未指定 provider 的使用情境。

需要回退時將 `app.config.ts` 的 provider 改為 `useValue: false` 並重新發布，便會回到舊入口；
不需要回滾資料表。若也要回復後端，發布前 Worker 版本為 `ff4624f1-dc33-4031-a0f3-52b59362cd54`。
不要使用真實會員／客戶資料做自動測試，不要把 Google 憑證、本站 token 或 secret 印入紀錄。

開關定義在 `src/app/core/config/auth.config.ts`；啟用時在應用程式 providers 提供
`{ provide: GOOGLE_ID_TOKEN_LOGIN_ENABLED, useValue: true }`。

## 預期結果與限制

新方式使用 Google 官方登入按鈕，將身分登入和 Drive 資料授權分開。
這能移除一般登入對授權碼交換流程的依賴，但不能保證 Google 永遠不寄安全或授權通知。
首次授權、撤銷後重新連線，以及 Google 自身的安全判斷仍可能觸發通知。

離線測試可以驗證程式合約與登入狀態，但無法代替部署後使用者實際走過 Google 登入／Drive 授權。

## 本輪邊界與後續安全維護

- nonce 隨前端登入生命週期更新，後端驗證它與 ID token 一致；沒有新增伺服器端的一次性 nonce 儲存。
  因此本輪不提供「憑證遭竊後仍無法重放」的保證。Google ID token 必須保密，只經 HTTPS 傳輸，
  不寫入日誌；正式後端必須驗證有效期限。
- 新舊 Google 入口共用嚴格的 Google 憑證與帳戶衝突檢查，不再以相同信箱覆蓋其他 Google 身分。
- 登出立即清除本機狀態，背景請求附本站 Bearer token；後端驗簽後依穩定 session ID 撤銷。
  僅此撤銷用途允許已過期的本站 token，一般 API 驗證仍檢查效期。
- refresh 採條件式更新；舊 session 搬入既有 quotation_sessions 的流程採交易與條件式插入，
  防止登出後被較早開始的 refresh 復活。舊客戶端只送 refresh token 的登出仍相容，
  但無法取得新版 Bearer 撤銷所提供的競態保護。

## 本機驗證記錄

- 前端 Jest：147 項通過；Angular 模板／型別檢查、啟用旗標後 production build 通過（初始 827.24 kB）。
- 後端 Vitest：55 項通過，含真實記憶體 SQLite、Google 測試公鑰與實際簽章驗證。
- 後端 Worker dry-run 打包通過，完整 TypeScript 檢查通過。
- 已修正 `imageProcessor.ts` 對 `OptimizeResult.data` 的取用，圖片失敗備援測試通過。
- 前端採 Angular 正式編譯的獨立測試頁，使用合成帳號並封鎖外部網路。
  已走過新／舊入口、續期、登出、失敗重試，以及登出後的延遲 Google／API 回應。
  登入成功後的重複回應不會再呼叫新登入 API；320px 測試頁的內容寬度仍為 320px。
- 驗證使用隔離 Node 24.15；建置以 `CI=1` 關閉該次快取，避開本機 LMDB 原生模組中斷，
  未修改使用者預設 Node、套件或現有開發伺服器。

官方參考：[GIS JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference)、
[驗證 Google ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)。
