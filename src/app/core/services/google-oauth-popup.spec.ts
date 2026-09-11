/** @jest-environment jsdom */
import {
  GoogleOAuthPopup,
  GoogleOAuthPopupError,
} from './google-oauth-popup';

function createCrypto(): Crypto {
  let seed = 0;
  return {
    getRandomValues: <T extends ArrayBufferView>(values: T): T => {
      const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
      for (let index = 0; index < bytes.length; index += 1) bytes[index] = ++seed;
      return values;
    },
    subtle: {
      digest: async (): Promise<ArrayBuffer> => new Uint8Array(32).fill(9).buffer,
    },
  } as unknown as Crypto;
}

function flush(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

describe('GoogleOAuthPopup', () => {
  let popup: Window;
  let close: jest.Mock;
  const originalTextEncoder = globalThis.TextEncoder;

  beforeEach(() => {
    jest.useFakeTimers();
    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      value: class {
        encode(value: string): Uint8Array {
          return new Uint8Array([...value].map((character) => character.charCodeAt(0)));
        }
      },
    });
    window.history.replaceState({}, '', '/price-generator/');
    close = jest.fn(() => {
      Object.defineProperty(popup, 'closed', { configurable: true, value: true });
    });
    popup = {
      closed: false,
      close,
      location: { href: 'about:blank' },
    } as unknown as Window;
    jest.spyOn(window, 'open').mockReturnValue(popup);
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      value: originalTextEncoder,
    });
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('只在使用者觸發時開 popup，URL 採 S256 PKCE 且不強迫 consent', async () => {
    const helper = new GoogleOAuthPopup({ targetWindow: window, crypto: createCrypto() });
    const authorization = helper.authorize('client-id');
    expect(window.open).toHaveBeenCalledWith(
      'about:blank',
      'price-google-oauth',
      expect.stringContaining('popup'),
    );
    await flush();

    const url = new URL((popup.location as unknown as { href: string }).href);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('prompt')).toBe('select_account');
    expect(url.searchParams.has('consent')).toBe(false);
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/drive.appdata');

    const state = url.searchParams.get('state')!;
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: popup as unknown as MessageEventSource,
      data: { type: 'price-google-oauth', state, code: 'authorization-code' },
    }));

    await expect(authorization).resolves.toMatchObject({
      code: 'authorization-code',
      redirectUri: `${window.location.origin}/price-generator/assets/google-auth-callback.html`,
    });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('拒絕偽造來源與重複訊息，只消耗第一個有效 callback', async () => {
    const helper = new GoogleOAuthPopup({ targetWindow: window, crypto: createCrypto() });
    const authorization = helper.authorize('client-id');
    await flush();
    const state = new URL((popup.location as unknown as { href: string }).href).searchParams.get('state')!;

    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://attacker.example',
      source: popup as unknown as MessageEventSource,
      data: { type: 'price-google-oauth', state, code: 'forged' },
    }));
    await flush();
    expect(close).not.toHaveBeenCalled();

    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: popup as unknown as MessageEventSource,
      data: { type: 'price-google-oauth', state, code: 'first-code' },
    }));
    window.dispatchEvent(new MessageEvent('message', {
      origin: window.location.origin,
      source: popup as unknown as MessageEventSource,
      data: { type: 'price-google-oauth', state, code: 'second-code' },
    }));

    await expect(authorization).resolves.toMatchObject({ code: 'first-code' });
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('被封鎖或關閉的視窗會釋放流程以供重試', async () => {
    jest.spyOn(window, 'open').mockReturnValueOnce(null);
    const blocked = new GoogleOAuthPopup({ targetWindow: window, crypto: createCrypto() });
    await expect(blocked.authorize('client-id')).rejects.toMatchObject({ code: 'popup_blocked' });

    jest.spyOn(window, 'open').mockReturnValue(popup);
    const helper = new GoogleOAuthPopup({ targetWindow: window, crypto: createCrypto() });
    const authorization = helper.authorize('client-id');
    const rejection = authorization.catch((error: unknown) => error);
    await flush();
    Object.defineProperty(popup, 'closed', { configurable: true, value: true });
    jest.advanceTimersByTime(250);
    await expect(rejection).resolves.toMatchObject({ code: 'cancelled' });
  });

  it('逾時會移除 listener、關閉 popup，且不接受後續 callback', async () => {
    const helper = new GoogleOAuthPopup({
      targetWindow: window,
      crypto: createCrypto(),
      timeoutMs: 10,
    });
    const authorization = helper.authorize('client-id');
    const rejection = authorization.catch((error: unknown) => error);
    await flush();
    jest.advanceTimersByTime(10);
    await expect(rejection).resolves.toBeInstanceOf(GoogleOAuthPopupError);
    expect(close).toHaveBeenCalledTimes(1);
  });
});
