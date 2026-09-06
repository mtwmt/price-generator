import { WebCryptoSha256HashProvider, canonicalizeJsonValue } from './index';

describe('雲端報價單 canonical JSON 與 content hash', () => {
  it('物件鍵順序不同仍產生相同 canonical JSON，陣列順序與數值原義保留', () => {
    const first = {
      serviceItems: [{ price: -500, count: 0 }],
      b: 2,
      a: 1,
    };
    const reordered = {
      a: 1,
      b: 2,
      serviceItems: [{ count: -0, price: -500 }],
    };

    expect(canonicalizeJsonValue(first)).toBe(
      '{"a":1,"b":2,"serviceItems":[{"count":0,"price":-500}]}'
    );
    expect(canonicalizeJsonValue(reordered)).toBe(canonicalizeJsonValue(first));
  });

  it('標準 SHA-256 provider 對固定 canonical JSON 產生固定測試向量', async () => {
    const canonicalJson = canonicalizeJsonValue({ b: 2, a: 1 });
    const provider = new WebCryptoSha256HashProvider();

    await expect(provider.hash(canonicalJson)).resolves.toBe(
      '43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777'
    );
  });
});
