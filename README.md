# 報價單生器

## 更新歷程

- 20251004 新增 Excel 匯出功能
- 20251003 新增公司發票章欄位
- 20231109 新增儲存最後五筆報價單 (僅限於同一台電腦上)
- 20231022 新增客戶簽章區塊
- 20231020 因 node 18 不再支援 gulp，將網站改用 Angular 翻寫，且新增了稅率計算
- 20220408 手機也能匯出 PDF 囉
- 20220405 加上了呈現客戶端 LOGO，也新增報價、有效日期
- 20220401 調整了排版，也一併新增匯出圖片功能

## 主要功能

- ✨ 建立專業報價單，包含公司資訊、客戶資訊、服務項目
- 🖼️ 支援客戶 LOGO 與公司發票章圖片上傳
- 🗑️ 圖片上傳後可快速移除
- 🧮 自動計算稅額（未稅金額、稅額、含稅金額）
- 📅 報價日期與有效日期選擇器
- 💾 自動儲存最近 5 筆報價單於本機（LocalStorage）
- 🗂️ 歷史報價單管理，可快速載入或刪除
- ✍️ 可選擇是否顯示客戶簽章欄位
- 📤 **多格式匯出**
  - 🖼️ 圖片（JPEG，高解析度）
  - 📄 PDF（A4 尺寸）
  - 📊 **Excel（.xlsx）**
    - ✅ 完整樣式支援（背景色、粗體、字體大小、對齊）
    - ✅ 圖片嵌入（LOGO、公司章）
    - ✅ 合併儲存格
    - ✅ 可編輯內容
- 📱 響應式設計，支援手機與平板裝置

## 使用技術

- Angular 19
- TypeScript 5.9
- Signal API（Angular 響應式狀態管理）
- Standalone Components

## 核心套件

### UI 框架
- Bootstrap 5 - 響應式前端框架
- [Tabler UI](https://tabler.io/) - 基於 Bootstrap 的 UI 元件庫
- Tailwind CSS 4 - Utility-first CSS 框架
- ng-bootstrap - Bootstrap 的 Angular 元件

### 功能套件
- Litepicker - 輕量級日期選擇器
- html2canvas-pro - HTML 轉圖片（支援 Tailwind CSS 4 oklch 顏色）
- jsPDF - PDF 生成
- ExcelJS - Excel 生成（支援完整樣式與圖片）

---

Blog: https://mtwmt.com/blog/life/price-generator
