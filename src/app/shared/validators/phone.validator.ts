import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * 台灣電話號碼驗證器
 * 支援格式：
 * - 手機：09xx-xxx-xxx 或 09xxxxxxxx (10碼)
 * - 市話：0x-xxxx-xxxx 或 0x-xxxxxxx 或 0xx-xxxxxxx (含區碼共9-10碼)
 */
export function phoneValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    // 允許空值（如需必填請配合 Validators.required 使用）
    if (!value) {
      return null;
    }

    // 移除所有空格和連字號
    const cleanedValue = value.replace(/[\s-]/g, '');

    // 手機號碼：09 開頭，共 10 碼
    const mobilePattern = /^09\d{8}$/;

    // 市話號碼：區碼 + 號碼
    // 02: 02-xxxx-xxxx (8碼) 或 02-xxx-xxxx (7碼)
    // 03-09: 0x-xxxx-xxxx (8碼) 或 0x-xxx-xxxx (7碼)
    const landlinePattern = /^0[2-9]\d{7,8}$/;

    if (mobilePattern.test(cleanedValue) || landlinePattern.test(cleanedValue)) {
      return null;
    }

    return {
      phone: {
        message: '請輸入有效的台灣電話號碼（手機：09xx-xxx-xxx，市話：0x-xxxx-xxxx）',
      },
    };
  };
}
