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
  /** 本機與雲端都會保留的文件識別；舊報價讀取時會補上。 */
  quotationId?: string;
  /** 對外可讀報價編號，不等同技術修訂識別。 */
  quotationNumber?: string;
  /** 業務版本，已送出後建立下一版時遞增。 */
  businessVersion?: number;
  /** 使用者管理的業務狀態；匯出不會自動變更它。 */
  status?: 'draft' | 'sent' | 'won' | 'lost';
  /** 同一文件較早業務版本的快照，避免覆蓋已送出的內容。 */
  previousVersions?: readonly QuotationVersionSnapshot[];
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
  /** 客戶聯絡電話分機 */
  customerPhoneExt?: string;
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
  /** 報價者聯絡電話分機 */
  quoterPhoneExt?: string;
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
  /** 稅金計算模式：'excluding' 未稅（稅金另加）| 'including' 含稅（價格已含稅） */
  taxMode?: 'excluding' | 'including';

  // 其他資訊
  /** 付款條件 */
  paymentTerms?: string;
  /** 備註說明 */
  desc?: string;
  /** 是否顯示簽章區 */
  isSign: boolean;
}

/** 儲存舊版本內容時的不可變快照；不包含遞迴 previousVersions。 */
export interface QuotationVersionSnapshot {
  readonly businessVersion: number;
  readonly savedAt: string;
  readonly data: Omit<QuotationData, 'previousVersions'>;
}

export interface CustomerTemplate {
  readonly id: string;
  readonly name: string;
  readonly customerCompany: string;
  readonly customerTaxID?: string;
  readonly customerContact?: string;
  readonly customerPhone?: string;
  readonly customerPhoneExt?: string;
  readonly customerEmail?: string;
  readonly customerAddress?: string;
}

export interface ServiceItemTemplate {
  readonly id: string;
  readonly name: string;
  readonly item: string;
  readonly price: number;
  readonly unit?: string;
  readonly category?: string;
}
