import { calculateDiscount, calculateTaxAndTotal } from './calculator';

describe('折扣計算工具', () => {
  describe('calculateDiscount', () => {
    describe('固定金額折扣', () => {
      it('應該正確計算固定金額折扣', () => {
        const result = calculateDiscount(1200, 'amount', 100);
        expect(result.discountAmount).toBe(100);
        expect(result.afterDiscount).toBe(1100);
      });

      it('應該處理折扣金額為0的情況', () => {
        const result = calculateDiscount(1200, 'amount', 0);
        expect(result.discountAmount).toBe(0);
        expect(result.afterDiscount).toBe(1200);
      });

      it('應該處理折扣金額大於原價的情況', () => {
        const result = calculateDiscount(1000, 'amount', 1500);
        expect(result.discountAmount).toBe(1500);
        expect(result.afterDiscount).toBe(0); // 最小為0
      });
    });

    describe('折數折扣 - 個位數（自動轉換）', () => {
      it('應該正確計算8折（自動轉為80折）', () => {
        const result = calculateDiscount(1200, 'percentage', 8);
        expect(result.discountAmount).toBe(240); // 1200 × 20% = 240
        expect(result.afterDiscount).toBe(960); // 1200 - 240 = 960
      });

      it('應該正確計算9折（自動轉為90折）', () => {
        const result = calculateDiscount(1200, 'percentage', 9);
        expect(result.discountAmount).toBe(120); // 1200 × 10% = 120
        expect(result.afterDiscount).toBe(1080); // 1200 - 120 = 1080
      });

      it('應該正確計算7折（自動轉為70折）', () => {
        const result = calculateDiscount(1000, 'percentage', 7);
        expect(result.discountAmount).toBe(300); // 1000 × 30% = 300
        expect(result.afterDiscount).toBe(700); // 1000 - 300 = 700
      });

      it('應該正確計算5折（自動轉為50折）', () => {
        const result = calculateDiscount(2000, 'percentage', 5);
        expect(result.discountAmount).toBe(1000); // 2000 × 50% = 1000
        expect(result.afterDiscount).toBe(1000); // 2000 - 1000 = 1000
      });
    });

    describe('折數折扣 - 兩位數（直接使用）', () => {
      it('應該正確計算95折', () => {
        const result = calculateDiscount(1200, 'percentage', 95);
        expect(result.discountAmount).toBe(60); // 1200 × 5% = 60
        expect(result.afterDiscount).toBe(1140); // 1200 - 60 = 1140
      });

      it('應該正確計算85折', () => {
        const result = calculateDiscount(1000, 'percentage', 85);
        expect(result.discountAmount).toBe(150); // 1000 × 15% = 150
        expect(result.afterDiscount).toBe(850); // 1000 - 150 = 850
      });

      it('應該正確計算75折', () => {
        const result = calculateDiscount(2000, 'percentage', 75);
        expect(result.discountAmount).toBe(500); // 2000 × 25% = 500
        expect(result.afterDiscount).toBe(1500); // 2000 - 500 = 1500
      });

      it('應該正確計算88折', () => {
        const result = calculateDiscount(500, 'percentage', 88);
        expect(result.discountAmount).toBe(60); // 500 × 12% = 60
        expect(result.afterDiscount).toBe(440); // 500 - 60 = 440
      });
    });

    describe('邊界情況', () => {
      it('應該處理折數為0的情況', () => {
        const result = calculateDiscount(1200, 'percentage', 0);
        expect(result.discountAmount).toBe(0);
        expect(result.afterDiscount).toBe(1200);
      });

      it('應該處理折數為100的情況（無折扣）', () => {
        const result = calculateDiscount(1200, 'percentage', 100);
        expect(result.discountAmount).toBe(0); // 100 - 100 = 0%
        expect(result.afterDiscount).toBe(1200);
      });

      it('應該處理原價為0的情況', () => {
        const result = calculateDiscount(0, 'percentage', 8);
        expect(result.discountAmount).toBe(0);
        expect(result.afterDiscount).toBe(0);
      });

      it('應該使用 Math.ceil 向上取整折扣金額', () => {
        // 1000 × (100 - 85) / 100 = 1000 × 0.15 = 150（整數）
        const result1 = calculateDiscount(1000, 'percentage', 85);
        expect(result1.discountAmount).toBe(150);

        // 1001 × (100 - 85) / 100 = 1001 × 0.15 = 150.15 → 151
        const result2 = calculateDiscount(1001, 'percentage', 85);
        expect(result2.discountAmount).toBe(151);
      });
    });
  });

  describe('calculateTaxAndTotal', () => {
    it('應該正確計算5%營業稅', () => {
      const result = calculateTaxAndTotal(1000, 5);
      expect(result.tax).toBe(50); // 1000 × 5% = 50
      expect(result.includingTax).toBe(1050); // 1000 + 50 = 1050
    });

    it('應該正確計算2.11%二代健保', () => {
      const result = calculateTaxAndTotal(1000, 2.11);
      expect(result.tax).toBe(22); // Math.ceil(1000 × 2.11%) = 22
      expect(result.includingTax).toBe(1022);
    });

    it('應該處理免稅情況（0%）', () => {
      const result = calculateTaxAndTotal(1000, 0);
      expect(result.tax).toBe(0);
      expect(result.includingTax).toBe(1000);
    });

    it('應該使用 Math.ceil 向上取整稅額', () => {
      // 1001 × 5% = 50.05 → 51
      const result = calculateTaxAndTotal(1001, 5);
      expect(result.tax).toBe(51);
      expect(result.includingTax).toBe(1052);
    });
  });

  describe('整合測試：完整報價單計算', () => {
    it('情境1：8折 + 5%營業稅', () => {
      // 小計：$1200
      // 8折：折扣 $240，折扣後 $960
      // 5%稅：$48
      // 總計：$1008
      const discount = calculateDiscount(1200, 'percentage', 8);
      expect(discount.discountAmount).toBe(240);
      expect(discount.afterDiscount).toBe(960);

      const taxResult = calculateTaxAndTotal(discount.afterDiscount, 5);
      expect(taxResult.tax).toBe(48);
      expect(taxResult.includingTax).toBe(1008);
    });

    it('情境2：95折 + 5%營業稅', () => {
      // 小計：$1200
      // 95折：折扣 $60，折扣後 $1140
      // 5%稅：$57
      // 總計：$1197
      const discount = calculateDiscount(1200, 'percentage', 95);
      expect(discount.discountAmount).toBe(60);
      expect(discount.afterDiscount).toBe(1140);

      const taxResult = calculateTaxAndTotal(discount.afterDiscount, 5);
      expect(taxResult.tax).toBe(57);
      expect(taxResult.includingTax).toBe(1197);
    });

    it('情境3：固定折扣$100 + 免稅', () => {
      // 小計：$1200
      // 固定折扣：$100，折扣後 $1100
      // 免稅：$0
      // 總計：$1100
      const discount = calculateDiscount(1200, 'amount', 100);
      expect(discount.discountAmount).toBe(100);
      expect(discount.afterDiscount).toBe(1100);

      const taxResult = calculateTaxAndTotal(discount.afterDiscount, 0);
      expect(taxResult.tax).toBe(0);
      expect(taxResult.includingTax).toBe(1100);
    });
  });
});
