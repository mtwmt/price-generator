# 報價單生器

## 更新歷程

- 20251025 新增折扣設定與項目拖曳功能, 還有 MIT License 授權條款，明確使用規範
- 20251024 現在可以刪除報價單歷史記錄嚕！
- 20251023 全新大改版，PC版新增即時預覽區，移除 Bootstrap 與 Tabler 改用 daisyUI
- 20251015 留言系統從 utterances 遷移至 giscus，支援更多功能
- 20251004 新增 Excel 匯出功能
- 20251003 新增公司發票章欄位
- 20231109 新增儲存最後五筆報價單 (僅限於同一台電腦上)
- 20231022 新增客戶簽章區塊
- 20231020 因 node 18 不再支援 gulp，將網站改用 Angular 翻寫，且新增了稅率計算
- 20220408 手機也能匯出 PDF 囉
- 20220405 加上了呈現客戶端 LOGO，也新增報價、有效日期
- 20220401 調整了排版，也一併新增匯出圖片功能

## 主要功能

- **零後端依賴**：純前端應用，資料存於瀏覽器本地，隱私安全
- ✨ 建立專業報價單，包含公司與客戶完整資訊
- 🎯 **拖曳排序**：服務項目支援桌面與行動裝置拖曳排序
- 🧮 **自動計算**：即時計算未稅金額、稅額、含稅總金額
- 🔧 **彈性稅率**：可自訂稅目名稱和稅率百分比
- 🖼️ 支援客戶 LOGO 與公司發票章上傳（PNG、JPG、GIF）
- 📅 報價日期與有效日期選擇器
- 💾 自動儲存最近 5 筆報價單，可快速載入或刪除
- ✍️ 客戶簽章欄位（可選）
- 📤 **多格式匯出**
  - 🖼️ 圖片（JPEG 高解析度 2x）
  - 📄 PDF（A4 尺寸）
  - 📊 Excel（完整樣式、圖片嵌入、可編輯）
  <!-- - 🖨️ 列印（優化排版） -->
- 📱 響應式設計，完美支援手機與平板

## 使用技術

- Angular 20
- TypeScript 5.9
- Signal API（Angular 響應式狀態管理）
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
https://github.com/mtwmt/price-generator
```

#### 💡 貢獻與回饋

- 歡迎提交 Issue 回報問題
- 歡迎提交 Pull Request 貢獻改進
- 若有商業合作需求，請透過 Blog 聯繫

### 📄 授權協議

本專案採用 **MIT License** 授權，詳見 [LICENSE](LICENSE) 檔案

---

Blog: https://mtwmt.com/blog/life/price-generator
