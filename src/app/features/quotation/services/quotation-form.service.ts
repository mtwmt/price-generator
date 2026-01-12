import { Injectable, inject, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  calculateDiscount,
  calculateTaxAndTotal,
} from '@app/features/quotation/utils/calculator';
import {
  QuotationData,
  ServiceItem,
} from '@app/features/quotation/models/quotation.model';
import { DEFAULT_FORM_VALUES } from '@app/features/quotation/models/quotation.constants';
import { taxIdValidator } from '@app/shared/validators/tax-id.validator';
import { phoneValidator } from '@app/shared/validators/phone.validator';

@Injectable({
  providedIn: 'root',
})
export class QuotationFormService {
  private fb = inject(FormBuilder);
  private destroyRef = inject(DestroyRef);

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

      // 服務項目與稅率
      serviceItems: this.fb.array([], Validators.required),
      excludingTax: [0],
      discountType: ['amount'], // 折扣類型：amount 或 percentage
      discountValue: [0], // 折扣值
      discountAmount: [0], // 計算後的折扣金額
      afterDiscount: [0], // 折扣後金額
      taxName: [''],
      customTaxName: [''], // 自訂稅別名稱
      percentage: [0],
      tax: [{ value: 0, disabled: true }],
      includingTax: [0],

      // 其他資訊
      desc: [''],
      isSign: [true],
    });
  }

  /**
   * 建立單一服務項目 FormGroup
   */
  createServiceItem(): FormGroup {
    return this.fb.group({
      category: [''],
      item: ['', Validators.required],
      price: [null, Validators.required],
      count: [1],
      unit: [''],
      amount: [0],
    });
  }

  /**
   * 設定表單監聽器，自動觸發計算
   */
  setupFormListeners(form: FormGroup): void {
    const serviceItems = form.get('serviceItems') as FormArray;

    // 監聽服務項目變更
    serviceItems.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.calculateTotals(form));

    // 監聽其他影響金額的欄位
    const controlsToWatch = ['percentage', 'discountType', 'discountValue'];
    controlsToWatch.forEach((controlName) => {
      form
        .get(controlName)
        ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.calculateTotals(form));
    });
  }

  /**
   * 計算所有金額（小計、折扣、稅額、總計）
   */
  calculateTotals(form: FormGroup): void {
    // 1. 計算小計（服務項目總和）
    const excludingTax = this.calculateSubtotal(form);

    // 2. 計算折扣
    const discountType = form.get('discountType')?.value || 'amount';
    const discountValue = Number(form.get('discountValue')?.value) || 0;
    const { discountAmount, afterDiscount } = calculateDiscount(
      excludingTax,
      discountType,
      discountValue
    );

    // 3. 計算稅額和總計
    const taxPercentage = Number(form.get('percentage')?.value) || 0;
    const { tax, includingTax } = calculateTaxAndTotal(
      afterDiscount,
      taxPercentage
    );

    // 4. 更新表單
    form.patchValue(
      { excludingTax, discountAmount, afterDiscount, tax, includingTax },
      { emitEvent: false }
    );
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
  }

  /**
   * 重置表單
   */
  resetForm(form: FormGroup): void {
    form.reset({
      ...DEFAULT_FORM_VALUES,
      startDate: this.getTodayDate(),
    });

    const serviceItems = form.get('serviceItems') as FormArray;
    serviceItems.clear();
    serviceItems.push(this.createServiceItem());
  }

  /**
   * 處理折扣值的正規化
   */
  normalizeDiscountValue(form: FormGroup): void {
    const discountType = form.get('discountType')?.value;
    const maxValue =
      discountType === 'amount'
        ? form.get('excludingTax')?.value || 0
        : undefined;

    this.normalizeNumberInput(form, 'discountValue', maxValue);
  }

  /**
   * 處理稅率的正規化
   */
  normalizePercentage(form: FormGroup): void {
    this.normalizeNumberInput(form, 'percentage', 100);
  }

  // --- 私有輔助方法 ---

  private calculateSubtotal(form: FormGroup): number {
    const items = form.get('serviceItems')?.value as ServiceItem[];
    if (!items) return 0;
    return items.reduce((acc, item) => acc + (item.amount || 0), 0);
  }

  private normalizeNumberInput(
    form: FormGroup,
    controlName: string,
    maxValue?: number
  ): void {
    const control = form.get(controlName);
    if (!control) return;

    const value = control.value;
    if (value === null || value === undefined || value === '') return;

    let numValue = Number(value);
    if (isNaN(numValue)) return;

    if (maxValue !== undefined && numValue > maxValue) {
      numValue = maxValue;
    }

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
