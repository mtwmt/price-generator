import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-changelog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './changelog.html',
})
export class ChangelogComponent {
  changelog = [
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
