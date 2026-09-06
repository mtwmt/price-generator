/**
 * 雜湊 provider 只接受規範化 JSON 字串，讓前後端可以用同一組向量驗證。
 * 測試可注入 deterministic fake；正式環境應使用標準 SHA-256 provider，
 * 不可用自製快速雜湊取代完整性驗證。
 */
export interface ContentHashProvider {
  hash(canonicalJson: string): Promise<string>;
}

/** 使用 Web Crypto 的標準 SHA-256 實作；不接觸 token 或其他帳號資料。 */
export class WebCryptoSha256HashProvider implements ContentHashProvider {
  async hash(canonicalJson: string): Promise<string> {
    if (typeof globalThis.crypto?.subtle?.digest !== 'function') {
      throw new Error('目前執行環境沒有可用的 Web Crypto SHA-256');
    }

    const bytes = new TextEncoder().encode(canonicalJson);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
  }
}
