# 報價單產生器 (Price Generator)

## 主要功能

- **本機與雲端儲存**：報價單歷史記錄預設保存在瀏覽器 LocalStorage；贊助會員與管理員可啟用 Google Drive 同步，由瀏覽器直接存取個人 Drive 的應用程式資料空間。常用客戶與常用項目沿用相同連線及開關，保留本機快取與離線待送紀錄。
- ✨ 建立專業報價單，包含公司與客戶完整資訊
- 🎯 **拖曳排序**：服務項目支援桌面與行動裝置拖曳排序
- 🧮 **自動計算**：即時計算未稅金額、稅額、含稅總金額
- 🔧 **彈性稅率**：可自訂稅目名稱和稅率百分比
- 🖼️ 支援客戶 LOGO 與公司發票章上傳（PNG、JPG、GIF）
- 📅 報價日期與有效日期選擇器
- 💾 本機歷史記錄最多保留 5 筆報價單，可快速載入、更新或刪除
- ✍️ 客戶簽章欄位（可選）
- 📤 **多格式匯出**
  - 🖼️ 圖片（JPEG 高解析度 2x）
  - 📄 PDF（固定 A4 版面與安全分頁）
  - 📊 Excel（完整樣式、圖片嵌入、可編輯）
  <!-- - 🖨️ 列印（優化排版） -->
- 📱 響應式設計，完美支援手機與平板


## 常用資料同步

- 登入後的常用資料依會員帳號隔離；訪客資料留在訪客區，不會自動上傳至登入帳號。
- 新增、更新、重新命名與刪除以不可變操作保存。不同資料自動合併；同筆資料並行修改或修改／刪除衝突時，介面可選擇版本或將未刪除版本保留為不同資料。
- 歷史紀錄、常用客戶與常用項目共用一個同步狀態，全部完成才顯示「已同步」。連線後自動同步，正常狀態不需手動操作；恢復網路或頁面重新取得焦點（30 秒節流）也會自動更新三種資料。本機儲存成功但雲端失敗時保留待送紀錄，只有失敗時才顯示「重試同步」，授權失效則提示重新連結。第一版採最終一致，沒有即時推播。
- 關閉同步會保留本機資料與待送紀錄，停止後續請求。已送出的請求可能已完成，重新啟用後會去重及合併。
- 本機使用 `quotation:templates:<scope>:v2` 單一封套保存所有版本與待送紀錄，透過 Web Locks 保護多分頁操作。需支援 Web Crypto 與 Web Locks 的安全瀏覽器環境（HTTPS 或 localhost）；缺少安全鎖定能力時會回報錯誤並停止寫入。
- 首次升版會驗證、遷移兩個舊常用資料 keys，完整寫入及讀回驗證後才使用新版；舊 keys 保留作為來源。新版建立後不再匯入舊 keys，避免刪除資料復活。**舊版分頁的後續修改不會同步到新版，請重新載入所有分頁再繼續編輯。**
- Drive 常用資料 namespace 為 `price-quotation-templates`，與報價資料分開。單筆操作上限 64 KiB，SHA-256 驗證內容與操作識別；首次和後續同步都全量讀取操作。第一版不清理舊版本與刪除標記，長期使用會增加讀取流量及本機儲存用量；容量錯誤會顯示失敗並保留既有內容。

## 本機開發與驗證

```sh
npm install
npm start
npm test -- --runInBand
npx tsc -p tsconfig.app.json --noEmit
npm run build
```

隔離瀏覽器回歸可在建置後執行 `node scripts/verify-template-sync.browser.cjs`；需已有 Playwright 與 Chromium，也可用 `PLAYWRIGHT_MODULE` 指向現有 Playwright 套件、`CHROMIUM_EXECUTABLE` 指向已安裝的 Chrome。此腳本自行啟動臨時本機靜態伺服器、建立全新瀏覽器 contexts，攔截所有外部請求，以合成會員與 Drive 操作驗證跨裝置流程，不使用既有登入、真實資料或正式 API。

## 使用技術

- Angular 22.1
- TypeScript 6.0
- Signal API（Angular 響應式狀態管理）
- NgRx Signal Store
- Standalone Components

## 核心套件

### UI 框架

- [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first CSS 框架
- [daisyUI](https://daisyui.com/) - 基於 Tailwind 的 UI 元件庫
- [Lucide Angular](https://lucide.dev/) - 現代化 SVG 圖示庫
- Angular CDK - 拖曳排序功能

### 功能套件

- Litepicker - 輕量級日期選擇器
- html2canvas-pro - HTML 轉圖片（支援 Tailwind CSS 4 oklch 顏色）
- jsPDF - PDF 生成
- ExcelJS - Excel 生成（支援完整樣式與圖片）

## 授權與使用條款

### 📋 使用說明

本專案為**開源專案**，歡迎學習和參考，但請遵守以下使用規範：

#### ✅ 允許的使用方式

- 個人學習和研究
- Fork 專案進行自行開發和客製化
- 參考程式碼架構和技術實作
- 在您的專案中引用部分程式碼（請註明出處）

#### ⚠️ 使用限制

- **禁止直接複製整個專案用於商業用途**
- **禁止移除原作者資訊和連結**
- 若要將本專案用於商業用途，請先聯繫作者取得授權
- Fork 後的衍生專案建議保留原專案連結，尊重開源精神

#### 📝 引用規範

如果您在專案中使用了本專案的程式碼，請在您的 README 或相關文件中註明：

```
本專案部分程式碼參考自：
報價單生器 by Mandy (MTWMT)
https://mtwmt.com/price-generator
```

#### 💡 貢獻與回饋

- 歡迎提交 Issue 回報問題
- 歡迎提交 Pull Request 貢獻改進
- 若有商業合作需求，請透過 Blog 聯繫

### 📄 授權協議

本專案採用 **MIT License** 授權，詳見 [LICENSE](LICENSE) 檔案

---

Blog: https://mtwmt.com/blog/life/price-generator
