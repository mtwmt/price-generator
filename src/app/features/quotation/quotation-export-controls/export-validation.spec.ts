import {
  ensureExportFormIsValid,
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
});
