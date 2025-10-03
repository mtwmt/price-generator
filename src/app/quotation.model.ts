/**
 * 服務項目介面
 */
export interface ServiceItem {
  /** 類別 */
  category?: string;
  /** 項目名稱 */
  item: string;
  /** 單價 */
  price: number;
  /** 數量 */
  count: number;
  /** 單位 */
  unit?: string;
  /** 金額（單價 × 數量） */
  amount: number;
}

/**
 * 報價單資料介面
 */
export interface QuotationData {
  /** 客戶 LOGO（base64） */
  logo?: string;
  /** 印章圖片（base64） */
  stamp?: string;
  /** 客戶名稱 */
  company: string;
  /** 客戶統一編號 */
  customerTaxID?: string;
  /** 報價公司/人員 */
  quoterName: string;
  /** 報價者統一編號 */
  quoterTaxID?: string;
  /** Email */
  email: string;
  /** 聯絡電話 */
  tel?: string;
  /** 報價日期 */
  startDate: string;
  /** 有效日期 */
  endDate?: string;
  /** 服務項目列表 */
  serviceItems: ServiceItem[];
  /** 未稅金額 */
  excludingTax: number;
  /** 稅目名稱 */
  taxName?: string;
  /** 稅率百分比 */
  percentage?: number;
  /** 稅額 */
  tax: number;
  /** 含稅金額 */
  includingTax: number;
  /** 備註說明 */
  desc?: string;
  /** 是否顯示簽章區 */
  isSign: boolean;
}
