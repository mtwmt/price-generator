import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Clock } from 'lucide-angular';

@Component({
  selector: 'app-changelog',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './changelog.component.html',
})
export class ChangelogComponent {
  // Lucide Icons
  readonly Clock = Clock;

  changelog = [
    {
      date: '2026-02-14',
      features: [
        '認證系統升級為 Google OAuth 2.0，提升安全性與穩定性',
        '留言系統重新整合，改善載入速度與穩定度',
        '修復留言排序變更後分頁未重置的問題',
      ],
    },
    {
      date: '2025-12-30',
      features: [
        '調整預設字體大小，提升閱讀體驗',
        '修復 PDF 匯出無法顯示全部內容的問題',
      ],
    },
    {
      date: '2025-12-17',
      features: ['新增報價單底部來源標示，贊助會員可享有無標示版本'],
    },
    {
      date: '2025-12-06',
      features: [
        '推出會員系統，未來將提供贊助會員專屬功能',
        '統一改用 Google 帳號登入',
        '留言系統重新整合至會員功能',
      ],
    },
    {
      date: '2025-11-10',
      features: ['新增電話分機欄位，支援市話分機號碼輸入'],
    },
    {
      date: '2025-11-02',
      features: ['新增匯出並列樣式'],
    },
    {
      date: '2025-10-27',
      features: ['新增報價單樣板選擇'],
    },
    {
      date: '2025-10-25',
      features: [
        '新增折扣設定',
        '新增項目拖曳功能',
        '新增 MIT License 授權條款，明確使用規範',
      ],
    },
    {
      date: '2025-10-24',
      features: ['現在可以刪除報價單歷史記錄嚕！'],
    },
    {
      date: '2025-10-23',
      features: [
        '全新大改版，PC版新增即時預覽區',
        '移除 bootstrap 與 tabler 改用 daisyui',
      ],
    },
    {
      date: '2025-10-15',
      features: ['留言系統從 utterances 遷移至 giscus，支援更多功能'],
    },
    {
      date: '2025-10-04',
      features: [
        '新增 Excel 匯出功能',
        '新增更新記錄頁面，查看所有功能更新歷程',
      ],
    },
    {
      date: '2025-10-03',
      features: ['新增公司發票章欄位'],
    },
    {
      date: '2023-11-09',
      features: ['新增儲存最後五筆報價單 (僅限於同一台電腦上)'],
    },
    {
      date: '2023-10-22',
      features: ['新增客戶簽章區塊'],
    },
    {
      date: '2023-10-20',
      features: ['使用 Angular 重寫', '新增稅率計算功能'],
    },
    {
      date: '2022-04-08',
      features: ['支援手機匯出 PDF'],
    },
    {
      date: '2022-04-05',
      features: ['新增客戶 LOGO 顯示', '新增報價日期與有效日期'],
    },
    {
      date: '2022-04-01',
      features: ['調整排版', '新增匯出圖片功能'],
    },
  ];
}
