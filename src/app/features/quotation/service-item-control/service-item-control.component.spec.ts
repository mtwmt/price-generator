/**
 * 服務項目金額計算邏輯的單元測試
 *
 * 由於 Angular 元件測試需要複雜的設定，這裡將核心邏輯抽離測試。
 * 測試重點：
 * 1. 數量為 0 時應計算為 0（P0 Bug 修復）
 * 2. 負數單價應正確計算（P2 扣除項目支援）
 * 3. 空值與 null 的 fallback 行為
 */

// ⚠️ 此函數須與 ServiceItemControlComponent.getNumericValue 保持同步
function getNumericValue(
  value: number | string | null | undefined,
  defaultValue: number
): number {
  const num = Number(value);
  return value != null && value !== '' && !isNaN(num) ? num : defaultValue;
}

/**
 * 模擬 calculateAmount 方法
 */
function calculateAmount(
  price: number | string | null | undefined,
  count: number | string | null | undefined
): number {
  const DEFAULT_PRICE = 0;
  const DEFAULT_COUNT = 1;
  const p = getNumericValue(price, DEFAULT_PRICE);
  const c = getNumericValue(count, DEFAULT_COUNT);
  return p * c;
}

describe('服務項目金額計算', () => {
  describe('getNumericValue — 數值解析', () => {
    it('數值 0 應保持為 0，不使用預設值', () => {
      expect(getNumericValue(0, 1)).toBe(0);
    });

    it('數值 0 的單價應保持為 0', () => {
      expect(getNumericValue(0, 0)).toBe(0);
    });

    it('字串 "0" 應解析為 0', () => {
      expect(getNumericValue('0', 1)).toBe(0);
    });

    it('null 應使用預設值', () => {
      expect(getNumericValue(null, 1)).toBe(1);
    });

    it('undefined 應使用預設值', () => {
      expect(getNumericValue(undefined, 1)).toBe(1);
    });

    it('空字串應使用預設值', () => {
      expect(getNumericValue('', 1)).toBe(1);
    });

    it('正常數值應保持不變', () => {
      expect(getNumericValue(100, 0)).toBe(100);
    });

    it('負數應保持為負數', () => {
      expect(getNumericValue(-500, 0)).toBe(-500);
    });

    it('字串 "-500" 應解析為 -500', () => {
      expect(getNumericValue('-500', 0)).toBe(-500);
    });

    it('小數應正確解析', () => {
      expect(getNumericValue(3.5, 1)).toBe(3.5);
    });

    it('非數值字串應使用預設值', () => {
      expect(getNumericValue('abc', 1)).toBe(1);
    });

    it('NaN 應使用預設值', () => {
      expect(getNumericValue(NaN, 0)).toBe(0);
    });
  });

  describe('calculateAmount — P0: 數量為 0 的情況', () => {
    it('單價 100、數量 0 → 金額應為 0', () => {
      expect(calculateAmount(100, 0)).toBe(0);
    });

    it('單價 500、數量 0 → 金額應為 0', () => {
      expect(calculateAmount(500, 0)).toBe(0);
    });

    it('單價 0、數量 0 → 金額應為 0', () => {
      expect(calculateAmount(0, 0)).toBe(0);
    });

    it('單價 0、數量 5 → 金額應為 0', () => {
      expect(calculateAmount(0, 5)).toBe(0);
    });
  });

  describe('calculateAmount — P2: 負數單價（扣除項目）', () => {
    it('單價 -500、數量 1 → 金額應為 -500', () => {
      expect(calculateAmount(-500, 1)).toBe(-500);
    });

    it('單價 -1000、數量 2 → 金額應為 -2000', () => {
      expect(calculateAmount(-1000, 2)).toBe(-2000);
    });

    it('單價 -300、數量 0 → 金額應為 -0（JS 特性：負數乘以零）', () => {
      expect(calculateAmount(-300, 0)).toBe(-0);
    });
  });

  describe('calculateAmount — 正常計算', () => {
    it('單價 100、數量 3 → 金額應為 300', () => {
      expect(calculateAmount(100, 3)).toBe(300);
    });

    it('單價 null、數量 5 → 使用預設單價 0，金額應為 0', () => {
      expect(calculateAmount(null, 5)).toBe(0);
    });

    it('單價 100、數量 null → 使用預設數量 1，金額應為 100', () => {
      expect(calculateAmount(100, null)).toBe(100);
    });

    it('單價 100、數量空字串 → 使用預設數量 1，金額應為 100', () => {
      expect(calculateAmount(100, '')).toBe(100);
    });
  });
});
