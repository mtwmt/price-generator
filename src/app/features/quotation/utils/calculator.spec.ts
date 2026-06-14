import {
  calculateDiscount,
  calculateTaxAndTotal,
  calculateTaxFromIncluding,
} from './calculator';

describe('折扣計算工具', () => {
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
    it('折扣大於原價時折扣後為0', () => {
      const r = calculateDiscount(1000, 'amount', 1500);
      expect(r.discountAmount).toBe(1500);
      expect(r.afterDiscount).toBe(0);
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
      expect(r.excludingTax + r.tax).toBe(12345);
    });
    it('金額0', () => {
      const r = calculateTaxFromIncluding(0, 5);
      expect(r.excludingTax).toBe(0);
      expect(r.tax).toBe(0);
    });
  });
});
