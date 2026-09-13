import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { LucideCalendar1, LucideReceiptText } from '@lucide/angular';

@Component({
  selector: 'app-quotation-info-section',
  standalone: true,
  imports: [ReactiveFormsModule, LucideCalendar1, LucideReceiptText],
  templateUrl: './quotation-info-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotationInfoSection implements AfterViewInit {
  readonly form = input.required<FormGroup>();
  readonly advancedMode = input(false);
  readonly quotationNumberChange = output<string>();
  readonly datePickersReady = output<{
    startDateEl: ElementRef<HTMLInputElement>;
    endDateEl: ElementRef<HTMLInputElement>;
  }>();

  readonly startDateInput = viewChild<ElementRef<HTMLInputElement>>('startDate');
  readonly endDateInput = viewChild<ElementRef<HTMLInputElement>>('endDate');

  ngAfterViewInit(): void {
    const startDateEl = this.startDateInput();
    const endDateEl = this.endDateInput();
    if (startDateEl && endDateEl) this.datePickersReady.emit({ startDateEl, endDateEl });
  }
}
