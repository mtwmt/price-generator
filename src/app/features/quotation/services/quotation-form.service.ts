import { Injectable, inject, DestroyRef } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  calculateQuotationTotals,
  calculateServiceItemAmount,
  NumericValidationOptions,
  toFiniteNumber,
  validateDiscountValue,
  validateFiniteNumber,
  validateServiceItem,
} from '@app/features/quotation/utils/calculator';
import {
  QuotationData,
} from '@app/features/quotation/models/quotation.model';
import { DEFAULT_FORM_VALUES } from '@app/features/quotation/models/quotation.constants';
import { taxIdValidator } from '@app/shared/validators/tax-id.validator';
import { phoneValidator } from '@app/shared/validators/phone.validator';

@Injectable({
  providedIn: 'root',
})
export class QuotationFormService {
  private fb = inject(FormBuilder);
  /** 後備 DestroyRef（root 注入）：當呼叫端未提供時使用 */
  private readonly rootDestroyRef = inject(DestroyRef);

  /**
   * 建立報價單表單
   */
  createForm(): FormGroup {
    return this.fb.group({
      // 客戶資料
      customerCompany: ['', Validators.required],
      customerTaxID: ['', taxIdValidator()],
      customerContact: [''],
      customerPhone: ['', phoneValidator()],
      customerPhoneExt: [''],
      customerEmail: ['', Validators.email],
      customerAddress: [''],

      // 報價者資料
      quoterName: ['', Validators.required],
      quoterTaxID: ['', taxIdValidator()],
      quoterAddress: [''],
      quoterEmail: ['', [Validators.required, Validators.email]],
      quoterPhone: ['', phoneValidator()],
      quoterPhoneExt: [''],
      startDate: [this.getTodayDate()],
      endDate: [''],

      // 業務層 metadata：輸出與雲端 v2 讀取同一份 form snapshot。
      quotationId: [''],
      quotationNumber: [''],
      businessVersion: [1],
      status: ['draft'],
      previousVersions: [[]],

      // 服務項目與稅率
      serviceItems: this.fb.array([], Validators.required),
      excludingTax: [0],
      discountType: ['amount'], // 折扣類型：amount 或 percentage
      discountValue: [0, discountValueFormValidator], // 折扣值
      discountAmount: [0], // 計算後的折扣金額
      afterDiscount: [0], // 折扣後金額
      taxName: [''],
      customTaxName: [''], // 自訂稅別名稱
      percentage: [0, numericValidator({ min: 0, max: 100 })],
      tax: [{ value: 0, disabled: true }],
      includingTax: [0],

      // 稅金計算模式
      taxMode: ['excluding'],

      // 其他資訊
      paymentTerms: [''],
      desc: [''],
      isSign: [true],
    }, { validators: quotationCalculationValidator });
  }

  /**
   * 建立單一服務項目 FormGroup
   */
  createServiceItem(): FormGroup {
    return this.fb.group({
      category: [''],
      item: ['', Validators.required],
      price: [null, numericValidator({ min: 0, max: Number.MAX_SAFE_INTEGER })],
      count: [1, numericValidator({ min: 0, exclusiveMin: true, max: Number.MAX_SAFE_INTEGER })],
      unit: [''],
      amount: [0],
    }, { validators: serviceItemCalculationValidator });
  }

  /**
   * 設定表單監聽器，自動觸發計算
   * @param form 報價單表單
   * @param destroyRef 呼叫端（元件）的 DestroyRef。傳入後訂閱會隨元件銷毀而自動退訂，
   *                   避免本服務為 root 單例時訂閱無限累積。未傳入則退回 root 生命週期（相容舊行為）。
   */
  setupFormListeners(form: FormGroup, destroyRef?: DestroyRef): void {
    const cleanupRef = destroyRef ?? this.rootDestroyRef;
    const serviceItems = form.get('serviceItems') as FormArray;

    // 監聽服務項目變更
    serviceItems.valueChanges
      .pipe(takeUntilDestroyed(cleanupRef))
      .subscribe(() => this.calculateTotals(form));

    // 監聽其他影響金額的欄位
    const controlsToWatch = ['percentage', 'discountType', 'discountValue', 'taxMode'];
    controlsToWatch.forEach((controlName) => {
      form
        .get(controlName)
        ?.valueChanges.pipe(takeUntilDestroyed(cleanupRef))
        .subscribe(() => this.calculateTotals(form));
    });
  }

  /**
   * 計算所有金額（小計、折扣、稅額、總計）
   */
  calculateTotals(form: FormGroup): void {
    const serviceItems = form.get('serviceItems') as FormArray;
    const result = calculateQuotationTotals({
      serviceItems: serviceItems.getRawValue(),
      discountType: form.get('discountType')?.value,
      discountValue: form.get('discountValue')?.value,
      taxPercentage: form.get('percentage')?.value,
      taxMode: form.get('taxMode')?.value,
    });

    // 不信任歷史資料或既有 amount；一律從單價與數量重新計算。
    serviceItems.controls.forEach((itemControl, index) => {
      itemControl.get('amount')?.setValue(result.itemAmounts[index], { emitEvent: false });
      itemControl.updateValueAndValidity({ emitEvent: false });
    });

    form.patchValue(
      {
        excludingTax: result.excludingTax,
        discountAmount: result.discountAmount,
        afterDiscount: result.afterDiscount,
        tax: result.tax,
        includingTax: result.includingTax,
      },
      { emitEvent: false }
    );
    // 讓固定折扣在小計變動後立即重驗，且不改寫使用者原輸入。
    form.get('discountValue')?.updateValueAndValidity({ emitEvent: false });
    form.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * 載入報價單資料
   */
  loadQuotationData(form: FormGroup, data: QuotationData): void {
    const { customerLogo, quoterLogo, quoterStamp, serviceItems, ...formData } =
      data;

    // 載入前先重置為預設狀態，防止舊資料內容殘留 (例如：備註欄位)
    form.reset(DEFAULT_FORM_VALUES);

    // 載入基本欄位
    form.patchValue(formData);

    // 載入服務項目
    const serviceItemsArray = form.get('serviceItems') as FormArray;
    serviceItemsArray.clear();

    if (Array.isArray(serviceItems)) {
      serviceItems.forEach((item) => {
        const itemGroup = this.createServiceItem();
        itemGroup.patchValue(item);
        serviceItemsArray.push(itemGroup);
      });
    }

    // 重新計算所有金額並更新驗證狀態
    this.calculateTotals(form);
    form.updateValueAndValidity();
  }

  /**
   * 重置表單
   */
  resetForm(form: FormGroup): void {
    form.reset({
      ...DEFAULT_FORM_VALUES,
      startDate: this.getTodayDate(),
      quotationId: '',
      quotationNumber: '',
      businessVersion: 1,
      status: 'draft',
      previousVersions: [],
    });

    const serviceItems = form.get('serviceItems') as FormArray;
    serviceItems.clear();
    serviceItems.push(this.createServiceItem());
  }

  /**
   * 處理折扣值的正規化
   */
  normalizeDiscountValue(form: FormGroup): void {
    this.normalizeNumberInput(form, 'discountValue');
  }

  /**
   * 處理稅率的正規化
   */
  normalizePercentage(form: FormGroup): void {
    this.normalizeNumberInput(form, 'percentage');
  }

  // --- 私有輔助方法 ---

  private normalizeNumberInput(
    form: FormGroup,
    controlName: string
  ): void {
    const control = form.get(controlName);
    if (!control) return;

    const numValue = toFiniteNumber(control.value);
    if (numValue === null) return;

    // 超額輸入必須留在欄位並顯示錯誤，不能截斷。
    control.setValue(numValue);
  }

  private getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

}

/** 將共用數值規則轉為 Angular 欄位錯誤。 */
function numericValidator(options: NumericValidationOptions): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const validation = validateFiniteNumber(control.value, options);
    return validation ? { [validation.code]: validation } : null;
  };
}

/** 處理價格與數量皆合法、但相乘溢位的跨欄位錯誤。 */
const serviceItemCalculationValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const validation = validateServiceItem({
    price: control.get('price')?.value,
    count: control.get('count')?.value,
  });
  return validation.amount ? { unsafeAmount: validation.amount } : null;
};

/** 固定折扣上限依目前小計重新驗證，絕不將既有輸入截斷。 */
const discountValueFormValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const form = control.parent;
  const rawItems = form?.get('serviceItems')?.getRawValue();
  const amounts = Array.isArray(rawItems)
    ? rawItems.map((item) => calculateServiceItemAmount(item))
    : [];
  const subtotal = amounts.every((amount): amount is number => amount !== null)
    ? amounts.reduce((sum, amount) => sum + amount, 0)
    : null;
  const validation = validateDiscountValue(
    subtotal !== null && subtotal <= Number.MAX_SAFE_INTEGER ? subtotal : null,
    form?.get('discountType')?.value,
    control.value
  );
  return validation ? { [validation.code]: validation } : null;
};

/**
 * 根表單以同一套 calculator 驗證衍生計算。這同時讓匯出與儲存入口的 form.valid
 * 能阻擋從 HTML 限制以外注入的無效資料。
 */
const quotationCalculationValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const serviceItems = control.get('serviceItems')?.getRawValue();
  const result = calculateQuotationTotals({
    serviceItems: Array.isArray(serviceItems) ? serviceItems : [],
    discountType: control.get('discountType')?.value,
    discountValue: control.get('discountValue')?.value,
    taxPercentage: control.get('percentage')?.value,
    taxMode: control.get('taxMode')?.value,
  });
  return result.valid ? null : { invalidCalculation: result.errors };
};
