import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  TAX_RATES,
  CUSTOM_TAX_NAME,
} from '@app/features/quotation/models/quotation.constants';

/**
 * 計價設定區塊元件
 * 包含折扣設定、稅別設定、金額統計
 */
@Component({
  selector: 'app-pricing-section',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule],
  templateUrl: './pricing-section.component.html',
})
export class PricingSection {
  // Constants for template
  readonly taxRates = TAX_RATES;
  readonly customTaxName = CUSTOM_TAX_NAME;

  // Inputs
  readonly form = input.required<FormGroup>();

  // Outputs
  readonly taxRateChange = output<Event>();
  readonly normalizePercentageValue = output<void>();
  readonly normalizeDiscountAmount = output<void>();

  /**
   * 稅率變更
   */
  onTaxRateChange(event: Event): void {
    this.taxRateChange.emit(event);
  }

  /**
   * 標準化稅率百分比
   */
  normalizePercentage(): void {
    this.normalizePercentageValue.emit();
  }

  /**
   * 標準化折扣值
   */
  normalizeDiscountValue(): void {
    this.normalizeDiscountAmount.emit();
  }
}
