import { Type } from '@angular/core';
import { RendererClassic } from '../quotation-renderers/renderer-classic/renderer-classic';
import { RendererFull } from '../quotation-renderers/renderer-full/renderer-full';

/**
 * 報價單樣式模板配置
 */
export interface QuotationTemplate {
  /** 樣式 ID */
  id: string;
  /** 顯示名稱 */
  name: string;
  /** 對應的渲染器元件 */
  component: Type<any>;
  /** 簡短描述 */
  description?: string;
  /** 文字縮圖（emoji 或文字） */
  icon?: string;
  /** 標籤 */
  tags?: string[];
}

/**
 * 可用的報價單樣式列表
 */
export const QUOTATION_TEMPLATES: QuotationTemplate[] = [
  {
    id: 'classic',
    name: '精典版',
    component: RendererClassic,
  },
  {
    id: 'full',
    name: '完整版',
    component: RendererFull,
  },
];
