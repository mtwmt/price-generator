import { Type } from '@angular/core';
import { RendererClassic } from '../quotation-renderers/renderer-classic/renderer-classic';
import { RendererFull } from '../quotation-renderers/renderer-full/renderer-full';
import { RendererSideBySide } from '../quotation-renderers/renderer-side-by-side/renderer-side-by-side';

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
    name: '詳細版',
    component: RendererFull,
  },
  {
    id: 'invoice',
    name: '並列版',
    component: RendererSideBySide,
  },
];
