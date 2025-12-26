/**
 * 稅率定義
 */
export interface TaxRate {
  /** 稅率名稱（作為 value） */
  name: string;
  /** 稅率百分比 */
  percentage: number;
  /** 顯示標籤 */
  label: string;
}

/**
 * 預設稅率選項
 * 新增稅率只需在此陣列中加入新項目
 */
export const TAX_RATES: TaxRate[] = [
  { name: '免稅', percentage: 0, label: '免稅 (0%)' },
  { name: '營業稅', percentage: 5, label: '營業稅 (5%)' },
  { name: '二代健保', percentage: 2.11, label: '二代健保 (2.11%)' },
];

/**
 * 自訂稅率選項的名稱
 */
export const CUSTOM_TAX_NAME = '自訂';

/**
 * 根據稅率名稱取得稅率百分比
 */
export function getTaxPercentage(taxName: string): number {
  const taxRate = TAX_RATES.find((t) => t.name === taxName);
  return taxRate?.percentage ?? 0;
}

export const DEFAULT_FORM_VALUES = {
  customerCompany: '',
  customerTaxID: '',
  customerContact: '',
  customerPhone: '',
  customerPhoneExt: '',
  customerEmail: '',
  customerAddress: '',
  quoterName: '',
  quoterTaxID: '',
  quoterEmail: '',
  quoterPhone: '',
  quoterPhoneExt: '',
  quoterAddress: '',
  startDate: '',
  endDate: '',
  discountType: 'amount',
  discountValue: 0,
  discountAmount: 0,
  taxName: '',
  customTaxName: '',
  percentage: 0,
  tax: 0,
  excludingTax: 0,
  afterDiscount: 0,
  includingTax: 0,
  desc: '',
  isSign: true,
} as const;
