/** 匯出前需要的最小表單契約，讓驗證行為能脫離 Angular 元件測試。 */
export interface ExportValidationForm {
  readonly valid: boolean;
  readonly errors?: Record<string, unknown> | null;
  markAllAsTouched(): void;
  updateValueAndValidity(): void;
}

/** 將計算層的欄位錯誤轉成可操作的匯出提示，並將同類錯誤去重以保持提示簡潔。 */
export function getExportValidationMessage(form: ExportValidationForm): string {
  const calculationErrors = form.errors?.['invalidCalculation'];
  if (calculationErrors && typeof calculationErrors === 'object') {
    const rawDetails = Object.entries(calculationErrors as Record<string, unknown>)
      .map(([path, value]) => {
        const message = typeof value === 'object' && value !== null && 'message' in value
          ? String((value as { message: unknown }).message)
          : '輸入值無效';
        return formatCalculationError(path, message);
      });
    const details = Array.from(new Set(rawDetails)).slice(0, 3);
    if (details.length > 0) return `無法匯出：${details.join('；')}`;
  }
  return '請先完成必填欄位後才能匯出報價單';
}

/**
 * 驗證失敗時保留按鈕的 click 流程，先顯示所有欄位錯誤再交由呼叫端處理提示與焦點。
 */
export function ensureExportFormIsValid(
  form: ExportValidationForm,
  onInvalid: (message: string) => void
): boolean {
  if (form.valid) return true;
  form.markAllAsTouched();
  form.updateValueAndValidity();
  onInvalid(getExportValidationMessage(form));
  return false;
}

function formatCalculationError(path: string, message: string): string {
  if (path.endsWith('.price')) return `服務項目單價${message}`;
  if (path.endsWith('.count')) return `服務項目數量${message}`;
  if (path.endsWith('.amount')) {
    return message.includes('服務項目') ? message : `服務項目金額${message}`;
  }
  if (path === 'serviceItems') {
    return message.includes('服務項目') ? message : `服務項目小計${message}`;
  }
  if (path === 'discountValue') {
    return message.includes('折扣') ? message : `折扣值${message}`;
  }
  if (path === 'percentage') {
    return message.includes('稅率') ? message : `稅率${message}`;
  }
  if (path === 'taxMode') {
    return message.includes('稅') ? message : `稅金模式${message}`;
  }
  return `計價設定${message}`;
}
