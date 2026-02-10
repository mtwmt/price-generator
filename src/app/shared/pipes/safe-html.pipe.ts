import { Pipe, PipeTransform } from '@angular/core';
import DOMPurify from 'dompurify';

/**
 * SafeHtml Pipe — 使用 DOMPurify 消毒 HTML，防止 XSS 攻擊。
 * 僅允許白名單內的標籤和屬性。
 *
 * 用法: <div [innerHTML]="htmlContent | safeHtml"></div>
 */
@Pipe({
  name: 'safeHtml',
  standalone: true,
})
export class SafeHtmlPipe implements PipeTransform {
  private static readonly ALLOWED_TAGS = [
    'strong', 'em', 'code', 'br', 'p',
    'pre', 'blockquote', 'ul', 'ol', 'li',
    'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  ];

  private static readonly ALLOWED_ATTR = ['href', 'target', 'rel'];

  transform(value: string | null | undefined): string {
    if (!value) return '';

    return DOMPurify.sanitize(value, {
      ALLOWED_TAGS: SafeHtmlPipe.ALLOWED_TAGS,
      ALLOWED_ATTR: SafeHtmlPipe.ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    });
  }
}
