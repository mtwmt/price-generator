import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * 台灣統一編號格式驗證器
 *
 * 驗證規則：
 * - 必須是 8 位數字
 * - 僅允許數字字元
 *
 * @returns ValidatorFn 驗證函數
 *
 * @example
 * ```typescript
 * this.fb.group({
 *   taxID: ['', taxIdValidator()]
 * });
 * ```
 */
export function taxIdValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    // 允許空值（使用 Validators.required 來處理必填）
    if (!value) {
      return null;
    }

    // 檢查是否為 8 位數字
    const TAX_ID_PATTERN = /^[0-9]{8}$/;
    const isValid = TAX_ID_PATTERN.test(value);

    return isValid ? null : { taxId: { value, message: '請輸入正確統一編號' } };
  };
}
