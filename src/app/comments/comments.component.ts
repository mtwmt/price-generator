import { Component, Inject, OnInit, Renderer2, DOCUMENT } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-comments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './comments.component.html',
})
export class CommentsComponent implements OnInit {
  constructor(
    @Inject(DOCUMENT) private document: Document,
    private renderer: Renderer2
  ) {}

  ngOnInit(): void {
    const script = this.renderer.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.setAttribute('data-repo', 'mtwmt/price-generator');
    script.setAttribute('data-repo-id', 'R_kgDOHCIN9w');
    script.setAttribute('data-category', 'General');
    script.setAttribute('data-category-id', 'DIC_kwDOHCIN984Cwrni');
    script.setAttribute('data-mapping', 'pathname');
    script.setAttribute('data-strict', '0');
    script.setAttribute('data-reactions-enabled', '1');
    script.setAttribute('data-emit-metadata', '1');
    script.setAttribute('data-input-position', 'top');
    script.setAttribute('data-theme', 'light');
    script.setAttribute('data-lang', 'zh-TW');
    script.setAttribute('crossorigin', 'anonymous');
    script.setAttribute('async', '');
    this.renderer.appendChild(this.document.querySelector('#comments'), script);
  }
}
