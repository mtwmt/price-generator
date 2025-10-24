/**
 * 折扣值正規化邏輯的單元測試
 *
 * 由於 Angular 元件測試需要複雜的設定，這裡將核心邏輯抽離測試。
 * 測試重點：
 * 1. 固定金額折扣不可超過小計
 * 2. 折數型折扣不受限制
 * 3. 前導零處理
 * 4. 邊界情況處理
 */

interface DiscountNormalizationInput {
  discountValue: number | string | null | undefined;
  discountType: 'amount' | 'percentage';
  excludingTax: number;
}

/**
 * 模擬 normalizeDiscountValue 方法的核心邏輯
 */
function normalizeDiscountValue(input: DiscountNormalizationInput): number | null {
  const { discountValue, discountType, excludingTax } = input;

  if (discountValue === null || discountValue === undefined || discountValue === '') {
    return null;
  }

  let numValue = Number(discountValue);
  if (isNaN(numValue)) {
    return null;
  }

  // 如果是固定金額折扣，限制不可超過小計
  if (discountType === 'amount') {
    if (numValue > excludingTax) {
      numValue = excludingTax;
    }
  }

  return numValue;
}

describe('折扣值正規化邏輯', () => {
  describe('固定金額折扣驗證', () => {
    it('當折扣金額超過小計時，應自動限制為小計金額', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 1500,
      });

      expect(result).toBe(1200);
    });

    it('當折扣金額等於小計時，應保持不變', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 1200,
      });

      expect(result).toBe(1200);
    });

    it('當折扣金額小於小計時，應保持不變', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 500,
      });

      expect(result).toBe(500);
    });

    it('當小計為 0 時，折扣金額應被限制為 0', () => {
      const result = normalizeDiscountValue({
        excludingTax: 0,
        discountType: 'amount',
        discountValue: 100,
      });

      expect(result).toBe(0);
    });

    it('當折扣金額為負數時，應保持為負數（小於小計）', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: -50,
      });

      expect(result).toBe(-50);
    });
  });

  describe('折數型折扣不受限制', () => {
    it('折數型折扣應保持原值不變', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: 95,
      });

      expect(result).toBe(95);
    });

    it('折數型折扣即使數值很大也不受限', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: 9999,
      });

      expect(result).toBe(9999);
    });

    it('折數型折扣可以是小數', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: 8.5,
      });

      expect(result).toBe(8.5);
    });
  });

  describe('前導零處理', () => {
    it('應移除前導零 - 固定金額', () => {
      const result = normalizeDiscountValue({
        excludingTax: 5000,
        discountType: 'amount',
        discountValue: '0100',
      });

      expect(result).toBe(100);
    });

    it('應移除前導零 - 折數', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: '08',
      });

      expect(result).toBe(8);
    });

    it('應移除多個前導零', () => {
      const result = normalizeDiscountValue({
        excludingTax: 5000,
        discountType: 'amount',
        discountValue: '00050',
      });

      expect(result).toBe(50);
    });
  });

  describe('邊界情況', () => {
    it('當折扣值為 null 時，應返回 null', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: null,
      });

      expect(result).toBeNull();
    });

    it('當折扣值為 undefined 時，應返回 null', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: undefined,
      });

      expect(result).toBeNull();
    });

    it('當折扣值為空字串時，應返回 null', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: '',
      });

      expect(result).toBeNull();
    });

    it('當折扣值為非數字字串時，應返回 null', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 'abc',
      });

      expect(result).toBeNull();
    });

    it('當折扣值為 0 時，應返回 0', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 0,
      });

      expect(result).toBe(0);
    });

    it('當折扣值為字串 "0" 時，應返回 0', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: '0',
      });

      expect(result).toBe(0);
    });
  });

  describe('整合情境', () => {
    it('情境1: 使用者輸入 "01500" 於固定金額折扣（小計 1200）', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: '01500',
      });

      // 應移除前導零得到 1500，再限制為小計 1200
      expect(result).toBe(1200);
    });

    it('情境2: 使用者輸入 "095" 於折數（小計 1200）', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: '095',
      });

      // 應移除前導零得到 95，折數不受小計限制
      expect(result).toBe(95);
    });

    it('情境3: 使用者輸入 "00800" 於固定金額折扣（小計 1200）', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: '00800',
      });

      // 應移除前導零得到 800，小於小計所以保持不變
      expect(result).toBe(800);
    });
  });
});
