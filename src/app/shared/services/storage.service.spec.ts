/** @jest-environment jsdom */
const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
}));
jest.mock('./logger.service', () => ({ LoggerService: class LoggerService {} }));
jest.mock('./toast.service', () => ({ ToastService: class ToastService {} }));

import { LoggerService } from './logger.service';
import { StorageService } from './storage.service';
import { ToastService } from './toast.service';

describe('StorageService', () => {
  let service: StorageService;
  let logger: { error: jest.Mock };
  let toast: { error: jest.Mock; warning: jest.Mock };

  beforeEach(() => {
    localStorage.clear();
    dependencies.clear();
    logger = { error: jest.fn() };
    toast = { error: jest.fn(), warning: jest.fn() };
    dependencies.set(LoggerService, logger);
    dependencies.set(ToastService, toast);
    service = new StorageService();
  });

  it('將不存在、格式損壞與存取遭拒分開回報，保留原始 JSON', () => {
    expect(service.readJson('missing')).toEqual({ status: 'missing' });

    localStorage.setItem('broken', '{not json');
    const broken = service.readJson('broken');
    expect(broken.status).toBe('parse-failed');
    expect(broken.raw).toBe('{not json');
    expect(service.get('broken', [])).toEqual([]);
    expect(toast.warning).toHaveBeenCalledWith('本機資料格式損壞，已保留原始內容供復原');

    const getItem = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(service.readJson('denied').status).toBe('access-denied');
    getItem.mockRestore();
  });

  it('容量與權限錯誤回傳真實失敗原因，且不顯示清空瀏覽器的引導', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    setItem.mockImplementationOnce(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(service.setDetailed('quotation', { value: 1 })).toMatchObject({
      success: false,
      reason: 'quota-exceeded',
    });
    expect(toast.error).toHaveBeenCalledWith(
      '儲存空間已滿；請先下載備份，再清理不需要的報價紀錄'
    );

    setItem.mockImplementationOnce(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    expect(service.set('quotation', { value: 2 })).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      '瀏覽器拒絕存取本機儲存空間，未覆寫既有資料'
    );
    setItem.mockRestore();
  });

  it('復原入口可逐字寫回使用者選取的原文，不嘗試 parse 或 stringify', () => {
    const raw = '{這是刻意無法解析的備份';
    expect(service.setRawDetailed('quotation:visitor', raw)).toEqual({ success: true });
    expect(localStorage.getItem('quotation:visitor')).toBe(raw);
  });
});
