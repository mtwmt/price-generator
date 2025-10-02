# 報價單生器

- 20251003 新增公司發票章欄位
- 20231109 新增儲存最後五筆報價單 (僅限於同一台電腦上)
- 20231022 新增客戶簽章區塊
- 20231020 因 node 18 不再支援 gulp，將網站改用 Angular 翻寫，且新增了稅率計算
- 20220408 手機也能匯出 PDF 囉。
- 20220405 加上了呈現客戶端 LOGO，也新增報價、有效日期
- 20220401 調整了排版，也一併新增匯出圖片功能。

## 主要功能

- ✨ 建立專業報價單，包含公司資訊、客戶資訊、服務項目
- 🖼️ 支援客戶 LOGO 與公司發票章圖片上傳
- 🗑️ 圖片上傳後可快速移除
- 🧮 自動計算稅額（未稅金額、稅額、含稅金額）
- 📅 報價日期與有效日期選擇器
- 💾 自動儲存最近 5 筆報價單於本機（LocalStorage）
- 🗂️ 歷史報價單管理，可快速載入或刪除
- ✍️ 可選擇是否顯示客戶簽章欄位
- 📤 匯出為 PDF 或圖片格式
- 📱 響應式設計，支援手機與平板裝置

## 使用技術

- Angular 20
- TypeScript
- Signal API (Angular 響應式狀態管理)
- Standalone Components

## 套件

- ng-bootstrap - Bootstrap 元件
- [Tabler](https://tabler.io/) - 架構在 Bootstrap 的 UI 框架
- Tailwind CSS - Utility-first CSS 框架
- Litepicker - 輕量級日期選擇器
- html2canvas - HTML 轉圖片
- jsPDF - PDF 生成

---

Blog: https://mtwmt.com/blog/life/price-generator
