/**
 * @jest-environment jsdom
 */
import DOMPurify from 'dompurify';

/**
 * 直接測試 DOMPurify 消毒邏輯（與 SafeHtmlPipe 使用相同設定）
 * Jest 環境無法載入 Angular 模組，因此直接測試核心 sanitize 邏輯。
 */

const ALLOWED_TAGS = [
  'strong', 'em', 'code', 'br', 'p',
  'pre', 'blockquote', 'ul', 'ol', 'li',
  'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

function sanitize(value: string | null | undefined): string {
  if (!value) return '';
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

describe('SafeHtml sanitize 邏輯', () => {
  it('應保留合法的 Markdown HTML 標籤', () => {
    const input = '<p>Hello <strong>World</strong> <em>italic</em></p>';
    expect(sanitize(input)).toBe(input);
  });

  it('應保留 code 和 pre 標籤', () => {
    const input = '<pre><code>const x = 1;</code></pre>';
    const result = sanitize(input);
    expect(result).toContain('<pre>');
    expect(result).toContain('<code>');
  });

  it('應保留 br 換行標籤', () => {
    const input = '<p>line1<br>line2</p>';
    const result = sanitize(input);
    expect(result).toContain('<br>');
  });

  it('應移除 img 標籤（不在白名單）', () => {
    const input = '<p>Text</p><img src="test.jpg">';
    const result = sanitize(input);
    expect(result).not.toContain('<img');
  });

  it('應移除 img onerror XSS 攻擊', () => {
    const input = '<img src=x onerror="alert(\'XSS\')">';
    const result = sanitize(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert');
  });

  it('應移除 script 標籤', () => {
    const input = '<script>alert("XSS")</script><p>Safe</p>';
    const result = sanitize(input);
    expect(result).not.toContain('<script');
    expect(result).toContain('<p>Safe</p>');
  });

  it('應移除 iframe 標籤', () => {
    const input = '<iframe src="evil.com"></iframe>';
    const result = sanitize(input);
    expect(result).not.toContain('<iframe');
  });

  it('應移除 svg onload 攻擊', () => {
    const input = '<svg onload="alert(1)">';
    const result = sanitize(input);
    expect(result).not.toContain('onload');
    expect(result).not.toContain('<svg');
  });

  it('應允許合法的連結', () => {
    const input = '<a href="https://example.com" target="_blank" rel="noopener">Link</a>';
    const result = sanitize(input);
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain('target="_blank"');
  });

  it('應移除 javascript: URI', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitize(input);
    expect(result).not.toContain('javascript:');
  });

  it('應處理 null 和 undefined', () => {
    expect(sanitize(null)).toBe('');
    expect(sanitize(undefined)).toBe('');
    expect(sanitize('')).toBe('');
  });

  it('應移除 data 屬性', () => {
    const input = '<p data-evil="payload">Text</p>';
    const result = sanitize(input);
    expect(result).not.toContain('data-evil');
    expect(result).toContain('<p>Text</p>');
  });

  it('應移除 style 屬性', () => {
    const input = '<p style="background:url(javascript:alert(1))">Text</p>';
    const result = sanitize(input);
    expect(result).not.toContain('style');
  });
});
