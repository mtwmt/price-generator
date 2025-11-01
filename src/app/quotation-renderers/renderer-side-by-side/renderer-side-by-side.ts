import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-renderer-side-by-side',
  imports: [CommonModule],
  templateUrl: './renderer-side-by-side.html',
})
export class RendererSideBySide {
  form = input.required<FormGroup>();
  customerLogo = input<string>('');
  quoterLogo = input<string>('');
  stamp = input<string>('');

  serviceItems = computed(() => {
    return this.form().get('serviceItems') as FormArray;
  });
}
