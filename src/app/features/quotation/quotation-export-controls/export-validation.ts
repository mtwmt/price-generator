/** 匯出前需要的最小表單契約，讓驗證行為能脫離 Angular 元件測試。 */
export interface ExportValidationForm {
  readonly valid: boolean;
  markAllAsTouched(): void;
  updateValueAndValidity(): void;
}

/**
 * 驗證失敗時保留按鈕的 click 流程，先顯示所有欄位錯誤再交由呼叫端處理提示與焦點。
 */
export function ensureExportFormIsValid(
  form: ExportValidationForm,
  onInvalid: () => void
): boolean {
  if (form.valid) return true;
  form.markAllAsTouched();
  form.updateValueAndValidity();
  onInvalid();
  return false;
}
