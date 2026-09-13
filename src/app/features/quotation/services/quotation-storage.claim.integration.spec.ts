/** @jest-environment jsdom */
const dependencies = new Map<unknown, unknown>();

jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target,
  inject: (token: unknown) => dependencies.get(token),
}));
jest.mock('@app/shared/services/logger.service', () => ({
  LoggerService: class LoggerService {},
}), { virtual: true });
jest.mock('@app/shared/services/storage.service', () => ({
  StorageService: class StorageService {},
}), { virtual: true });
jest.mock('@app/shared/services/toast.service', () => ({
  ToastService: class ToastService {},
}), { virtual: true });

import { LoggerService } from '@app/shared/services/logger.service';
import { StorageService } from '@app/shared/services/storage.service';
import { ToastService } from '@app/shared/services/toast.service';
import type { QuotationData } from '@app/features/quotation/models/quotation.model';
import { QuotationStorageService } from './quotation-storage.service';

const quotation = (customerCompany: string): QuotationData => ({
  customerCompany,
  quoterName: 'A3b 合成報價者',
  quoterEmail: 'a3b@example.test',
  startDate: '2026-09-12',
  serviceItems: [{ item: '合成服務', price: 100, count: 1, amount: 100 }],
  excludingTax: 100,
  tax: 5,
  includingTax: 105,
  isSign: false,
});

describe('QuotationStorageService A3b claim failure integration', () => {
  let service: QuotationStorageService;

  beforeEach(() => {
    localStorage.clear();
    dependencies.clear();
    dependencies.set(LoggerService, { error: jest.fn(), warn: jest.fn() });
    dependencies.set(ToastService, { error: jest.fn(), warning: jest.fn() });
    dependencies.set(StorageService, {
      readJson: (key: string) => {
        try {
          const raw = localStorage.getItem(key);
          if (raw === null) return { status: 'missing' as const };
          try {
            return { status: 'ok' as const, raw, value: JSON.parse(raw) as unknown };
          } catch (error) {
            return { status: 'parse-failed' as const, raw, error };
          }
        } catch (error) {
          return { status: 'access-denied' as const, error };
        }
      },
      setDetailed: (key: string, value: unknown) => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
          return { success: true };
        } catch (error) {
          return { success: false, reason: 'write-failed' as const, error };
        }
      },
    });
    service = new QuotationStorageService();
  });

  it('target 寫入失敗時保留來源與既有資料，恢復後可安全重跑且不重複', () => {
    const legacyRaw = JSON.stringify([quotation('legacy source')]);
    const targetRaw = JSON.stringify({ schemaVersion: 2, records: [quotation('existing target')] });
    localStorage.setItem('quotation', legacyRaw);
    localStorage.setItem('quotation:user-a', targetRaw);

    const originalSetItem = Storage.prototype.setItem;
    let failTargetOnce = true;
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      if (key === 'quotation:user-a' && failTargetOnce) {
        failTargetOnce = false;
        throw new DOMException('synthetic quota', 'QuotaExceededError');
      }
      return originalSetItem.call(localStorage, key, value);
    });

    expect(service.claimLegacyHistory('quotation:user-a', [0])).toEqual({
      success: false,
      claimed: 0,
      reason: 'write-failed',
    });
    expect(localStorage.getItem('quotation')).toBe(legacyRaw);
    expect(localStorage.getItem('quotation:user-a')).toBe(targetRaw);

    expect(service.claimLegacyHistory('quotation:user-a', [0])).toEqual({ success: true, claimed: 1 });
    const afterRetry = localStorage.getItem('quotation:user-a');
    expect(service.claimLegacyHistory('quotation:user-a', [0])).toEqual({ success: true, claimed: 0 });
    expect(localStorage.getItem('quotation:user-a')).toBe(afterRetry);
    expect(localStorage.getItem('quotation')).toBe(legacyRaw);
    expect(service.getHistory('quotation:user-a')).toHaveLength(2);

    setItem.mockRestore();
  });
});
