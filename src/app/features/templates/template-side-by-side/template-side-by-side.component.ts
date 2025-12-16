import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-template-side-by-side',
  imports: [CommonModule],
  templateUrl: './template-side-by-side.component.html',
})
export class TemplateSideBySide {
  form = input.required<FormGroup>();
  customerLogo = input<string>('');
  quoterLogo = input<string>('');
  stamp = input<string>('');
  isPremium = input<boolean>(false);

  serviceItems = computed(() => {
    return this.form().get('serviceItems') as FormArray;
  });
}
