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
  // 客戶資料
  /** 客戶 LOGO（base64） */
  customerLogo?: string;
  /** 客戶名稱 */
  customerCompany: string;
  /** 客戶統一編號 */
  customerTaxID?: string;
  /** 客戶聯絡人 */
  customerContact?: string;
  /** 客戶聯絡電話 */
  customerPhone?: string;
  /** 客戶 Email */
  customerEmail?: string;
  /** 客戶地址 */
  customerAddress?: string;

  // 報價者資料
  /** 報價者 LOGO（base64） */
  quoterLogo?: string;
  /** 印章圖片（base64） */
  quoterStamp?: string;
  /** 報價公司/人員 */
  quoterName: string;
  /** 報價者統一編號 */
  quoterTaxID?: string;
  /** 報價者地址 */
  quoterAddress?: string;
  /** 報價者 Email */
  quoterEmail: string;
  /** 報價者聯絡電話 */
  quoterPhone?: string;
  /** 報價日期 */
  startDate: string;
  /** 有效日期 */
  endDate?: string;

  // 服務項目與稅率
  /** 服務項目列表 */
  serviceItems: ServiceItem[];
  /** 未稅金額（小計） */
  excludingTax: number;
  /** 折扣類型 */
  discountType?: 'amount' | 'percentage';
  /** 折扣值（金額或百分比） */
  discountValue?: number;
  /** 計算後的折扣金額 */
  discountAmount?: number;
  /** 折扣後金額 */
  afterDiscount?: number;
  /** 稅目名稱 */
  taxName?: string;
  /** 自訂稅別名稱 */
  customTaxName?: string;
  /** 稅率百分比 */
  percentage?: number;
  /** 稅額 */
  tax: number;
  /** 含稅金額 */
  includingTax: number;

  // 其他資訊
  /** 備註說明 */
  desc?: string;
  /** 是否顯示簽章區 */
  isSign: boolean;
}
