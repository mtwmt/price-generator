import {
  ensureExportFormIsValid,
  getExportValidationMessage,
  type ExportValidationForm,
} from './export-validation';

describe('匯出前表單驗證', () => {
  it('無效表單會標記全部欄位、通知外層，且阻止匯出流程', () => {
    const form: ExportValidationForm = {
      valid: false,
      markAllAsTouched: jest.fn(),
      updateValueAndValidity: jest.fn(),
    };
    const onInvalid = jest.fn();

    expect(ensureExportFormIsValid(form, onInvalid)).toBe(false);
    expect(form.markAllAsTouched).toHaveBeenCalledTimes(1);
    expect(form.updateValueAndValidity).toHaveBeenCalledTimes(1);
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it('有效表單維持原本匯出路徑，不額外觸發提示', () => {
    const form: ExportValidationForm = {
      valid: true,
      markAllAsTouched: jest.fn(),
      updateValueAndValidity: jest.fn(),
    };
    const onInvalid = jest.fn();

    expect(ensureExportFormIsValid(form, onInvalid)).toBe(true);
    expect(form.markAllAsTouched).not.toHaveBeenCalled();
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('金額計算錯誤會指出實際欄位，而非只說缺少必填', () => {
    const form: ExportValidationForm = {
      valid: false,
      errors: {
        invalidCalculation: {
          'serviceItems.0.count': { message: '必須大於 0' },
          discountValue: { message: '固定折扣不得高於目前小計' },
        },
      },
      markAllAsTouched: jest.fn(),
      updateValueAndValidity: jest.fn(),
    };

    expect(getExportValidationMessage(form)).toBe(
      '無法匯出：服務項目數量必須大於 0；固定折扣不得高於目前小計'
    );
  });

  it('多個服務項目相同錯誤時會去重，避免重複串接提示', () => {
    const form: ExportValidationForm = {
      valid: false,
      errors: {
        invalidCalculation: {
          'serviceItems.0.price': { message: '不得為空' },
          'serviceItems.1.price': { message: '不得為空' },
          'serviceItems.2.price': { message: '不得為空' },
        },
      },
      markAllAsTouched: jest.fn(),
      updateValueAndValidity: jest.fn(),
    };

    expect(getExportValidationMessage(form)).toBe(
      '無法匯出：服務項目單價不得為空'
    );
  });
});
