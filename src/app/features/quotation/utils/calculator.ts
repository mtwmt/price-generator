/** 報價金額的唯一計算與驗證規則。 */
export const MAX_SAFE_AMOUNT = Number.MAX_SAFE_INTEGER;

const MIN_AMOUNT = 0;
const PERCENTAGE_DIVISOR = 100;
const SINGLE_DIGIT_THRESHOLD = 10;

export type NumericValidationCode =
  | 'required'
  | 'notFinite'
  | 'belowMinimum'
  | 'notPositive'
  | 'aboveMaximum'
  | 'unsafeResult'
  | 'invalidDiscountType';

export interface NumericValidationError {
  readonly code: NumericValidationCode;
  readonly message: string;
}

export interface NumericValidationOptions {
  readonly min?: number;
  readonly max?: number;
  readonly exclusiveMin?: boolean;
  readonly required?: boolean;
}

export interface ServiceItemAmountInput {
  readonly price: unknown;
  readonly count: unknown;
}

export interface QuotationTotalsInput {
  readonly serviceItems: readonly ServiceItemAmountInput[];
  readonly discountType: unknown;
  readonly discountValue: unknown;
  readonly taxPercentage: unknown;
  readonly taxMode: unknown;
}

export interface QuotationTotalsResult {
  readonly valid: boolean;
  readonly errors: Readonly<Record<string, NumericValidationError>>;
  readonly itemAmounts: readonly (number | null)[];
  readonly excludingTax: number | null;
  readonly discountAmount: number | null;
  readonly afterDiscount: number | null;
  readonly tax: number | null;
  readonly includingTax: number | null;
}

export interface DiscountCalculationResult {
  readonly valid: boolean;
  readonly error?: NumericValidationError;
  readonly discountAmount: number | null;
  readonly afterDiscount: number | null;
}

export interface TaxCalculationResult {
  readonly valid: boolean;
  readonly error?: NumericValidationError;
  readonly tax: number | null;
  readonly includingTax: number | null;
}

export interface TaxFromIncludingCalculationResult {
  readonly valid: boolean;
  readonly error?: NumericValidationError;
  readonly tax: number | null;
  readonly excludingTax: number | null;
}

/** 將可接受的數字輸入轉成 number；空白、布林值、NaN、Infinity 一律拒絕。 */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 驗證數字，但保留原值供使用者修正，不靜默截斷。 */
export function validateFiniteNumber(
  value: unknown,
  options: NumericValidationOptions = {}
): NumericValidationError | null {
  const isEmpty = value === null || value === undefined || value === '' ||
    (typeof value === 'string' && value.trim() === '');
  if (isEmpty) {
    return options.required === false ? null : makeError('required', '不得為空');
  }

  const numberValue = toFiniteNumber(value);
  if (numberValue === null) return makeError('notFinite', '必須是數值');
  if (Math.abs(numberValue) > MAX_SAFE_AMOUNT) {
    return makeError('unsafeResult', '數值超出安全計算範圍');
  }
  if (options.min !== undefined &&
      (options.exclusiveMin ? numberValue <= options.min : numberValue < options.min)) {
    return makeError(
      options.exclusiveMin ? 'notPositive' : 'belowMinimum',
      options.exclusiveMin ? '必須大於 0' : `不得小於 ${options.min}`
    );
  }
  if (options.max !== undefined && numberValue > options.max) {
    return makeError('aboveMaximum', `不得大於 ${options.max}`);
  }
  return null;
}

/** 驗證服務項目：免費項目合法，但數量不可空白或為零。 */
export function validateServiceItem(input: ServiceItemAmountInput): Readonly<Record<'price' | 'count' | 'amount', NumericValidationError | null>> {
  const price = validateFiniteNumber(input.price, { min: MIN_AMOUNT, max: MAX_SAFE_AMOUNT });
  const count = validateFiniteNumber(input.count, {
    min: MIN_AMOUNT,
    exclusiveMin: true,
    max: MAX_SAFE_AMOUNT,
  });
  let amount: NumericValidationError | null = null;
  if (!price && !count) {
    const product = toFiniteNumber(input.price)! * toFiniteNumber(input.count)!;
    if (!Number.isFinite(product) || product > MAX_SAFE_AMOUNT) {
      amount = makeError('unsafeResult', '單價與數量相乘後超出安全計算範圍');
    }
  }
  return { price, count, amount };
}

/** 無效時回傳 null，絕不以預設數量掩蓋空白輸入。 */
export function calculateServiceItemAmount(input: ServiceItemAmountInput): number | null {
  const validation = validateServiceItem(input);
  if (validation.price || validation.count || validation.amount) return null;
  return toFiniteNumber(input.price)! * toFiniteNumber(input.count)!;
}

/**
 * 折數相容規則：0 代表未設定折扣；0 < 值 < 10 時乘十；10 至 100 是支付百分比。
 */
export function validateDiscountValue(
  subtotal: number | null,
  discountType: unknown,
  discountValue: unknown
): NumericValidationError | null {
  if (discountType !== 'amount' && discountType !== 'percentage') {
    return makeError('invalidDiscountType', '折扣類型無效');
  }
  const baseError = validateFiniteNumber(discountValue, {
    min: MIN_AMOUNT,
    max: discountType === 'percentage' ? PERCENTAGE_DIVISOR : MAX_SAFE_AMOUNT,
  });
  if (baseError) return baseError;

  const value = toFiniteNumber(discountValue)!;
  if (discountType === 'amount' && subtotal !== null && value > subtotal) {
    return makeError('aboveMaximum', '固定折扣不得高於目前小計');
  }
  return null;
}

/** 取得 UI 提示用的「支付原價 X%」。 */
export function getDiscountPaymentPercentage(value: unknown): number | null {
  if (validateDiscountValue(0, 'percentage', value)) return null;
  const numericValue = toFiniteNumber(value)!;
  if (numericValue === MIN_AMOUNT) return PERCENTAGE_DIVISOR;
  return numericValue < SINGLE_DIGIT_THRESHOLD
    ? numericValue * SINGLE_DIGIT_THRESHOLD
    : numericValue;
}

/**
 * 從原始欄位重算全部衍生金額。任何欄位或中間結果無效時，總額一律為 null，
 * 防止預覽、儲存或匯出把錯誤輸入誤作有效報價。
 */
export function calculateQuotationTotals(input: QuotationTotalsInput): QuotationTotalsResult {
  const errors: Record<string, NumericValidationError> = {};
  const itemAmounts = input.serviceItems.map((item, index) => {
    const validation = validateServiceItem(item);
    if (validation.price) errors[`serviceItems.${index}.price`] = validation.price;
    if (validation.count) errors[`serviceItems.${index}.count`] = validation.count;
    if (validation.amount) errors[`serviceItems.${index}.amount`] = validation.amount;
    return calculateServiceItemAmount(item);
  });

  let subtotal: number | null = null;
  if (itemAmounts.every((amount): amount is number => amount !== null)) {
    subtotal = sumSafe(itemAmounts);
    if (subtotal === null) {
      errors['serviceItems'] = makeError('unsafeResult', '服務項目小計超出安全計算範圍');
    }
  }

  const discountError = validateDiscountValue(subtotal, input.discountType, input.discountValue);
  if (discountError) errors['discountValue'] = discountError;
  const taxError = validateFiniteNumber(input.taxPercentage, {
    min: MIN_AMOUNT,
    max: PERCENTAGE_DIVISOR,
  });
  if (taxError) errors['percentage'] = taxError;
  if (input.taxMode !== 'excluding' && input.taxMode !== 'including') {
    errors['taxMode'] = makeError('notFinite', '稅金計算模式無效');
  }

  if (Object.keys(errors).length > 0 || subtotal === null) {
    return invalidTotals(errors, itemAmounts, subtotal);
  }

  const discount = calculateDiscount(
    subtotal,
    input.discountType as 'amount' | 'percentage',
    toFiniteNumber(input.discountValue)!
  );
  if (!discount.valid || discount.afterDiscount === null || discount.discountAmount === null) {
    return invalidTotals({ ...errors, discountValue: discount.error! }, itemAmounts, subtotal);
  }

  const taxPercentage = toFiniteNumber(input.taxPercentage)!;
  if (input.taxMode === 'including') {
    const taxResult = calculateTaxFromIncluding(discount.afterDiscount, taxPercentage);
    if (!taxResult.valid || taxResult.tax === null) {
      return invalidTotals({ ...errors, percentage: taxResult.error! }, itemAmounts, subtotal);
    }
    return {
      valid: true, errors, itemAmounts, excludingTax: subtotal,
      discountAmount: discount.discountAmount, afterDiscount: discount.afterDiscount,
      tax: taxResult.tax, includingTax: discount.afterDiscount,
    };
  }

  const taxResult = calculateTaxAndTotal(discount.afterDiscount, taxPercentage);
  if (!taxResult.valid || taxResult.tax === null || taxResult.includingTax === null) {
    return invalidTotals({ ...errors, percentage: taxResult.error! }, itemAmounts, subtotal);
  }
  return {
    valid: true, errors, itemAmounts, excludingTax: subtotal,
    discountAmount: discount.discountAmount, afterDiscount: discount.afterDiscount,
    tax: taxResult.tax, includingTax: taxResult.includingTax,
  };
}

/** 不截斷超額固定折扣；改以 valid: false 明確回報。 */
export function calculateDiscount(
  excludingTax: number,
  discountType: 'amount' | 'percentage',
  discountValue: number
): DiscountCalculationResult {
  const subtotalError = validateFiniteNumber(excludingTax, { min: MIN_AMOUNT, max: MAX_SAFE_AMOUNT });
  const discountError = subtotalError ?? validateDiscountValue(excludingTax, discountType, discountValue);
  if (discountError) return invalidDiscount(discountError);

  // 百分比折扣沿用向上取整，但小數小計時向上後不得超過小計。
  // 這不是截斷使用者的固定折扣輸入；固定折扣仍由 validateDiscountValue 拒絕。
  const discountAmount = discountType === 'amount'
    ? discountValue
    : Math.min(
        excludingTax,
        Math.ceil(excludingTax * (PERCENTAGE_DIVISOR - getDiscountPaymentPercentage(discountValue)!) / PERCENTAGE_DIVISOR)
      );
  const afterDiscount = excludingTax - discountAmount;
  if (!isSafeAmount(discountAmount) || !isSafeAmount(afterDiscount) ||
      discountAmount < MIN_AMOUNT || afterDiscount < MIN_AMOUNT) {
    return invalidDiscount(makeError('unsafeResult', '折扣計算結果超出安全範圍'));
  }
  return { valid: true, discountAmount, afterDiscount };
}

/** 未稅模式；稅額維持既有向上取整規則。 */
export function calculateTaxAndTotal(afterDiscount: number, taxPercentage: number): TaxCalculationResult {
  const amountError = validateFiniteNumber(afterDiscount, { min: MIN_AMOUNT, max: MAX_SAFE_AMOUNT });
  const taxError = validateFiniteNumber(taxPercentage, { min: MIN_AMOUNT, max: PERCENTAGE_DIVISOR });
  if (amountError || taxError) return invalidTax(amountError ?? taxError!);

  const tax = Math.ceil((taxPercentage / PERCENTAGE_DIVISOR) * afterDiscount);
  const includingTax = afterDiscount + tax;
  if (!isSafeAmount(tax) || !isSafeAmount(includingTax) || includingTax > MAX_SAFE_AMOUNT) {
    return invalidTax(makeError('unsafeResult', '稅額計算結果超出安全範圍'));
  }
  return { valid: true, tax, includingTax };
}

/** 含稅模式；未稅額維持既有四捨五入規則。 */
export function calculateTaxFromIncluding(
  includingAmount: number,
  taxPercentage: number
): TaxFromIncludingCalculationResult {
  const amountError = validateFiniteNumber(includingAmount, { min: MIN_AMOUNT, max: MAX_SAFE_AMOUNT });
  const taxError = validateFiniteNumber(taxPercentage, { min: MIN_AMOUNT, max: PERCENTAGE_DIVISOR });
  if (amountError || taxError) {
    return { valid: false, error: amountError ?? taxError!, tax: null, excludingTax: null };
  }
  if (taxPercentage === MIN_AMOUNT) {
    return { valid: true, tax: MIN_AMOUNT, excludingTax: includingAmount };
  }

  const excludingTax = Math.round(includingAmount / (1 + taxPercentage / PERCENTAGE_DIVISOR));
  const tax = includingAmount - excludingTax;
  if (!isSafeAmount(excludingTax) || !isSafeAmount(tax) || excludingTax < MIN_AMOUNT || tax < MIN_AMOUNT) {
    return { valid: false, error: makeError('unsafeResult', '含稅反推結果超出安全範圍'), tax: null, excludingTax: null };
  }
  return { valid: true, tax, excludingTax };
}

function sumSafe(amounts: readonly number[]): number | null {
  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return isSafeAmount(total) && total <= MAX_SAFE_AMOUNT ? total : null;
}

function invalidTotals(
  errors: Readonly<Record<string, NumericValidationError>>,
  itemAmounts: readonly (number | null)[],
  subtotal: number | null
): QuotationTotalsResult {
  return {
    valid: false, errors, itemAmounts, excludingTax: subtotal,
    discountAmount: null, afterDiscount: null, tax: null, includingTax: null,
  };
}

function invalidDiscount(error: NumericValidationError): DiscountCalculationResult {
  return { valid: false, error, discountAmount: null, afterDiscount: null };
}

function invalidTax(error: NumericValidationError): TaxCalculationResult {
  return { valid: false, error, tax: null, includingTax: null };
}

function makeError(code: NumericValidationCode, message: string): NumericValidationError {
  return { code, message };
}

function isSafeAmount(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= MAX_SAFE_AMOUNT;
}
