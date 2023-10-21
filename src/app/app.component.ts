import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PriceGeneratorComponent } from './price-generator/price-generator.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, PriceGeneratorComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  title = 'price';
}
