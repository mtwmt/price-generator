import { QuotationTemplate } from '@app/features/templates/models/quotation-template.model';
import { TemplateClassic } from '@app/features/templates/template-classic/template-classic.component';
import { TemplateDetail } from '@app/features/templates/template-detail/template-detail.component';
import { TemplateSideBySide } from '@app/features/templates/template-side-by-side/template-side-by-side.component';
import { ClassicExcelExporter } from '@app/features/templates/template-classic/classic-excel-exporter';
import { DetailExcelExporter } from '@app/features/templates/template-detail/detail-excel-exporter';
import { SideBySideExcelExporter } from '@app/features/templates/template-side-by-side/side-by-side-excel-exporter';

/**
 * 可用的報價單樣板列表
 * 集中管理所有樣板配置，包含 HTML 渲染器和 Excel 匯出器
 */
export const QUOTATION_TEMPLATES: QuotationTemplate[] = [
  {
    id: 'classic',
    name: '精典版',
    component: TemplateClassic,
    excelExporter: ClassicExcelExporter,
  },
  {
    id: 'full',
    name: '詳細版',
    component: TemplateDetail,
    excelExporter: DetailExcelExporter,
  },
  {
    id: 'invoice',
    name: '並列版',
    component: TemplateSideBySide,
    excelExporter: SideBySideExcelExporter,
  },
];
