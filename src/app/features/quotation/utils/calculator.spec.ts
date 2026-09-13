import {
  calculateDiscount,
  calculateQuotationTotals,
  calculateServiceItemAmount,
  calculateTaxAndTotal,
  calculateTaxFromIncluding,
  getDiscountPaymentPercentage,
  validateDiscountValue,
  validateFiniteNumber,
} from './calculator';

describe('折扣計算工具', () => {
  it('小數小計套用折數時，衍生向上取整不會令合法報價失效', () => {
    const result = calculateQuotationTotals({
      serviceItems: [{ price: 1, count: 0.5 }],
      discountType: 'percentage', discountValue: 85, taxPercentage: 0, taxMode: 'excluding',
    });
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(0.5);
    expect(result.afterDiscount).toBe(0);
    expect((result.discountAmount ?? 0) + (result.afterDiscount ?? 0)).toBe(0.5);
  });
  describe('calculateDiscount - 固定金額', () => {
    it('固定金額折扣', () => {
      const r = calculateDiscount(1200, 'amount', 100);
      expect(r.discountAmount).toBe(100);
      expect(r.afterDiscount).toBe(1100);
    });
    it('折扣為0', () => {
      const r = calculateDiscount(1200, 'amount', 0);
      expect(r.discountAmount).toBe(0);
      expect(r.afterDiscount).toBe(1200);
    });
    it('折扣大於原價時必須標示為無效而非靜默截斷', () => {
      const r = calculateDiscount(1000, 'amount', 1500);
      expect(r.valid).toBe(false);
      expect(r.discountAmount).toBeNull();
      expect(r.afterDiscount).toBeNull();
    });
    it('固定折扣恰等於小計', () => {
      const r = calculateDiscount(1000, 'amount', 1000);
      expect(r.afterDiscount).toBe(0);
    });
  });

  describe('calculateDiscount - 折數', () => {
    it('8折(個位數自動轉80)', () => {
      const r = calculateDiscount(1200, 'percentage', 8);
      expect(r.discountAmount).toBe(240);
      expect(r.afterDiscount).toBe(960);
    });
    it('95折', () => {
      const r = calculateDiscount(1200, 'percentage', 95);
      expect(r.discountAmount).toBe(60);
      expect(r.afterDiscount).toBe(1140);
    });
    it('小數折數 9.5 折 -> 付95%', () => {
      const r = calculateDiscount(1000, 'percentage', 9.5);
      expect(r.discountAmount).toBe(50);
      expect(r.afterDiscount).toBe(950);
    });
    it('折數100=無折扣', () => {
      const r = calculateDiscount(1200, 'percentage', 100);
      expect(r.discountAmount).toBe(0);
      expect(r.afterDiscount).toBe(1200);
    });
    it('Math.ceil 向上取整', () => {
      const r = calculateDiscount(1001, 'percentage', 85);
      expect(r.discountAmount).toBe(151);
    });
  });

  describe('calculateTaxAndTotal', () => {
    it('5%營業稅', () => {
      const r = calculateTaxAndTotal(1000, 5);
      expect(r.tax).toBe(50);
      expect(r.includingTax).toBe(1050);
    });
    it('免稅', () => {
      const r = calculateTaxAndTotal(1000, 0);
      expect(r.tax).toBe(0);
      expect(r.includingTax).toBe(1000);
    });
    it('ceil 取整', () => {
      const r = calculateTaxAndTotal(1001, 5);
      expect(r.tax).toBe(51);
    });
  });

  describe('calculateTaxFromIncluding 含稅反推', () => {
    it('1050含稅反推5%', () => {
      const r = calculateTaxFromIncluding(1050, 5);
      expect(r.excludingTax).toBe(1000);
      expect(r.tax).toBe(50);
    });
    it('免稅時未稅=含稅', () => {
      const r = calculateTaxFromIncluding(1000, 0);
      expect(r.excludingTax).toBe(1000);
      expect(r.tax).toBe(0);
    });
    it('非整除用 round', () => {
      const r = calculateTaxFromIncluding(1000, 5);
      expect(r.excludingTax).toBe(952);
      expect(r.tax).toBe(48);
    });
    it('反推相加還原含稅(不漏分)', () => {
      const r = calculateTaxFromIncluding(12345, 5);
      expect((r.excludingTax ?? 0) + (r.tax ?? 0)).toBe(12345);
    });
    it('金額0', () => {
      const r = calculateTaxFromIncluding(0, 5);
      expect(r.excludingTax).toBe(0);
      expect(r.tax).toBe(0);
    });
  });
});

describe('報價數值防守與一致計算', () => {
  it.each([
    [8, 800],
    [85, 850],
    [9.5, 950],
    [100, 1000],
    [0, 1000],
  ])('小計 1,000、折數 %p 會支付 %p', (discountValue, expected) => {
    const result = calculateQuotationTotals({
      serviceItems: [{ price: 1000, count: 1 }],
      discountType: 'percentage', discountValue, taxPercentage: 0, taxMode: 'excluding',
    });
    expect(result.valid).toBe(true);
    expect(result.afterDiscount).toBe(expected);
  });

  it('折數 110 必須阻擋，並有對應欄位錯誤', () => {
    const result = calculateQuotationTotals({
      serviceItems: [{ price: 1000, count: 1 }],
      discountType: 'percentage', discountValue: 110, taxPercentage: 0, taxMode: 'excluding',
    });
    expect(result.valid).toBe(false);
    expect(result.errors['discountValue']?.code).toBe('aboveMaximum');
  });

  it('固定折扣會隨小計降低重新驗證，而不變更原輸入', () => {
    expect(validateDiscountValue(1000, 'amount', 1000)).toBeNull();
    expect(validateDiscountValue(999, 'amount', 1000)?.message).toBe('固定折扣不得高於目前小計');
  });

  it.each([NaN, Infinity, -Infinity, '', null, undefined])('拒絕非有限或空白數字：%p', (value) => {
    expect(validateFiniteNumber(value, { min: 0 })).not.toBeNull();
  });

  it('拒絕負單價、空白或零數量，並保留免費的小數數量項目', () => {
    expect(calculateServiceItemAmount({ price: -1, count: 1 })).toBeNull();
    expect(calculateServiceItemAmount({ price: 10, count: '' })).toBeNull();
    expect(calculateServiceItemAmount({ price: 10, count: 0 })).toBeNull();
    expect(calculateServiceItemAmount({ price: 0, count: 1.25 })).toBe(0);
  });

  it('拒絕乘法與稅額溢位，且不產生可交付總額', () => {
    const result = calculateQuotationTotals({
      serviceItems: [{ price: Number.MAX_SAFE_INTEGER, count: 2 }],
      discountType: 'amount', discountValue: 0, taxPercentage: 5, taxMode: 'excluding',
    });
    expect(result.valid).toBe(false);
    expect(result.includingTax).toBeNull();
  });

  it('折數提示保留舊有 8、85、9.5 語義', () => {
    expect(getDiscountPaymentPercentage(8)).toBe(80);
    expect(getDiscountPaymentPercentage(85)).toBe(85);
    expect(getDiscountPaymentPercentage(9.5)).toBe(95);
  });
});
