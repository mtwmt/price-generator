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
import {
  QUOTATION_HISTORY_SCHEMA_VERSION,
  QuotationStorageService,
} from './quotation-storage.service';

const quotation = (name = '合成客戶'): QuotationData => ({
  customerCompany: name,
  quoterName: '測試報價者',
  quoterEmail: 'quote@example.test',
  startDate: '2026-09-12',
  serviceItems: [{ item: '合成服務', price: 100, count: 1, amount: 100 }],
  excludingTax: 100,
  tax: 5,
  includingTax: 105,
  isSign: false,
});

describe('QuotationStorageService A3a 復原邊界', () => {
  let service: QuotationStorageService;
  let logger: { error: jest.Mock; warn: jest.Mock };
  let toast: { error: jest.Mock; warning: jest.Mock };

  beforeEach(() => {
    localStorage.clear();
    dependencies.clear();
    logger = { error: jest.fn(), warn: jest.fn() };
    toast = { error: jest.fn(), warning: jest.fn() };
    dependencies.set(LoggerService, logger);
    dependencies.set(ToastService, toast);
    const storage = {
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
      setRawDetailed: (key: string, raw: string) => {
        try {
          localStorage.setItem(key, raw);
          return { success: true };
        } catch (error) {
          return { success: false, reason: 'write-failed' as const, error };
        }
      },
    };
    dependencies.set(StorageService, storage);
    service = new QuotationStorageService();
  });

  it.each([
    ['null', 'null'],
    ['object', '{}'],
    ['string', '"not a history"'],
  ])('對 %s 根節點不會讓讀取崩潰，也不允許覆寫來源', (_name, raw) => {
    localStorage.setItem('quotation', raw);

    expect(service.getHistory()).toEqual([]);
    expect(service.getRecoveryInfo()).toMatchObject({
      status: 'invalid-root',
      writeProtected: true,
    });
    expect(service.saveToHistory(quotation())).toBe(false);
    expect(localStorage.getItem('quotation')).toBe(raw);
    expect(service.createRecoveryBackup()).toMatchObject({ content: raw });
  });

  it('破損 JSON 與未知未來 schema 保留原文且禁止降版寫入', () => {
    localStorage.setItem('quotation', '{broken');
    expect(service.getHistory()).toEqual([]);
    expect(service.getRecoveryInfo().status).toBe('parse-failed');
    expect(service.saveToHistory(quotation())).toBe(false);
    expect(localStorage.getItem('quotation')).toBe('{broken');

    const future = JSON.stringify({ schemaVersion: 99, records: [quotation()] });
    localStorage.setItem('quotation', future);
    expect(service.getRecoveryInfo().status).toBe('future-schema');
    expect(service.clearHistory()).toBe(false);
    expect(localStorage.getItem('quotation')).toBe(future);
  });

  it('讀取舊陣列與舊稅別格式，並在正常寫入時包裝為 v2', () => {
    localStorage.setItem('quotation', JSON.stringify([{
      ...quotation(),
      taxes: [
        { name: '營業稅', percentage: 5, amount: 5 },
        { name: '附加稅', percentage: 1, amount: 1 },
      ],
    }]));

    const history = service.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ taxName: '營業稅', percentage: 5, tax: 6 });
    expect(service.saveToHistory(quotation('新客戶'))).toBe(true);

    expect(JSON.parse(localStorage.getItem('quotation') as string)).toMatchObject({
      schemaVersion: QUOTATION_HISTORY_SCHEMA_VERSION,
      records: expect.arrayContaining([expect.objectContaining({ customerCompany: '新客戶' })]),
    });
  });

  it('混合有效和損壞紀錄時隔離損壞來源，先備份整個舊陣列再寫 v2', () => {
    const source = JSON.stringify([quotation('可辨識'), null, { serviceItems: [{}] }]);
    localStorage.setItem('quotation', source);

    expect(service.getHistory().map((item) => item.customerCompany)).toEqual(['可辨識']);
    expect(service.getRecoveryInfo()).toMatchObject({
      status: 'contains-quarantined-records',
      quarantinedRecordCount: 2,
    });
    expect(service.saveToHistory(quotation('新增'))).toBe(true);

    const persisted = JSON.parse(localStorage.getItem('quotation') as string);
    expect(persisted).toMatchObject({
      schemaVersion: QUOTATION_HISTORY_SCHEMA_VERSION,
      quarantinedRecords: [
        expect.objectContaining({ raw: null }),
        expect.objectContaining({ raw: { serviceItems: [{}] } }),
      ],
    });
    const backupKey = Object.keys(localStorage).find((key) =>
      key.startsWith('quotation:recovery-backup:')
    );
    expect(backupKey).toBeDefined();
    expect(JSON.parse(localStorage.getItem(backupKey as string) as string)).toMatchObject({ sourceRaw: source });
  });

  it('備份寫入失敗時不會覆寫混合損壞的舊來源', () => {
    const source = JSON.stringify([quotation(), null]);
    localStorage.setItem('quotation', source);
    const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key.includes(':recovery-backup:')) {
        throw new DOMException('full', 'QuotaExceededError');
      }
    });

    expect(service.saveToHistory(quotation('新增'))).toBe(false);
    expect(localStorage.getItem('quotation')).toBe(source);
    setItem.mockRestore();
  });

  it('可辨識但金額異常的紀錄會保留並標示待修正', () => {
    localStorage.setItem('quotation', JSON.stringify([{
      ...quotation(),
      includingTax: 'not-a-number',
      serviceItems: [{ item: '待修正服務', price: Number.NaN, count: 1, amount: 0 }],
    }]));

    const recovered = service.getHistory()[0];
    expect(recovered.storageRecovery).toEqual({
      needsRepair: true,
      issues: expect.arrayContaining([
        '服務項目 1 的單價不是有限數值',
        '含稅金額不是有限數值',
      ]),
    });
  });

  it('可使用 scope key，讓後續帳號隔離不必回到共用 quotation key', () => {
    expect(service.saveToHistory(quotation('A'), 'quotation:user-a')).toBe(true);
    expect(service.saveToHistory(quotation('B'), 'quotation:user-b')).toBe(true);
    expect(service.getHistory('quotation:user-a')[0].customerCompany).toBe('A');
    expect(service.getHistory('quotation:user-b')[0].customerCompany).toBe('B');
    expect(localStorage.getItem('quotation')).toBeNull();
  });

  it('認領無 ID 舊資料後即使載入、補 ID 並儲存，重跑也不會重複匯入', () => {
    const legacy = quotation('沒有 ID 的舊報價');
    localStorage.setItem('quotation', JSON.stringify([legacy]));

    expect(service.claimLegacyHistory('quotation:user-a', [0])).toEqual({
      success: true,
      claimed: 1,
    });
    const claimed = service.getHistory('quotation:user-a')[0];
    // 模擬 lifecycle 在下一次儲存時為已認領資料補上穩定 ID。
    expect(service.updateHistory(0, { ...claimed, quotationId: 'q-now-has-an-id' }, 'quotation:user-a')).toBe(true);

    expect(service.claimLegacyHistory('quotation:user-a', [0])).toEqual({
      success: true,
      claimed: 0,
    });
    expect(service.getHistory('quotation:user-a')).toHaveLength(1);
    const envelope = JSON.parse(localStorage.getItem('quotation:user-a') as string);
    expect(envelope.legacyClaims).toEqual([
      expect.objectContaining({ sourceKey: 'quotation', sourceFingerprint: expect.any(String) }),
    ]);
  });

  it('目標已滿五筆時，去重後的重跑仍可成功且不寫入第六筆', () => {
    const legacy = quotation('已認領來源');
    localStorage.setItem('quotation', JSON.stringify([legacy]));
    expect(service.claimLegacyHistory('quotation:user-a', [0])).toMatchObject({ success: true, claimed: 1 });

    for (let index = 0; index < 4; index += 1) {
      expect(service.saveToHistory(quotation(`既有 ${index}`), 'quotation:user-a')).toBe(true);
    }
    expect(service.getHistory('quotation:user-a')).toHaveLength(5);
    const before = localStorage.getItem('quotation:user-a');

    expect(service.claimLegacyHistory('quotation:user-a', [0])).toEqual({ success: true, claimed: 0 });
    expect(service.getHistory('quotation:user-a')).toHaveLength(5);
    expect(localStorage.getItem('quotation:user-a')).toBe(before);
  });

  it('無 ID 舊資料唯讀產生穩定 scope 身分，相同內容的兩筆也不合併', () => {
    const raw = JSON.stringify([quotation('相同'), quotation('相同'), quotation('另一筆')]);
    localStorage.setItem('quotation:visitor', raw);
    localStorage.setItem('quotation:user-a', raw);
    const write = jest.spyOn(Storage.prototype, 'setItem');
    const first = service.getHistory('quotation:visitor');
    expect(new Set(first.map((item) => item.quotationId)).size).toBe(3);
    expect(new QuotationStorageService().getHistory('quotation:visitor')).toEqual(first);
    expect(service.getHistory('quotation:user-a')[0].quotationId).not.toBe(first[0].quotationId);
    expect(write).not.toHaveBeenCalled(); expect(localStorage.getItem('quotation:visitor')).toBe(raw);
    write.mockRestore();
  });

  it('缺 ID 舊資料更新前備份失敗不寫入，修復空間後以相同身分重試成功並保留來源 bytes', () => {
    const scope = 'quotation:visitor'; const raw = JSON.stringify([quotation('舊資料')]);
    localStorage.setItem(scope, raw); const original = service.getHistory(scope)[0];
    const next = { ...original, customerCompany: '修改後' };
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(service.updateHistoryById(original.quotationId!, next, original, scope)).toBe(false);
    expect(localStorage.getItem(scope)).toBe(raw); write.mockRestore();
    expect(service.getHistory(scope)[0].quotationId).toBe(original.quotationId);
    expect(service.updateHistoryById(original.quotationId!, next, original, scope)).toBe(true);
    expect(service.getHistory(scope)).toHaveLength(1);
    expect(service.getHistory(scope)[0].quotationId).toBe(original.quotationId);
    const backupKey = Object.keys(localStorage).find((key) => key.startsWith(`${scope}:recovery-backup:`));
    expect(JSON.parse(localStorage.getItem(backupKey!)!).sourceRaw).toBe(raw);
  });

  it('持久 ID 更新在 storage 重排後仍定位原紀錄；來源內容變更或重複 ID 則拒絕', () => {
    const scope = 'quotation:visitor';
    service.saveToHistory(quotation('A'), scope); service.saveToHistory(quotation('B'), scope);
    const original = service.getHistory(scope)[0];
    const envelope = JSON.parse(localStorage.getItem(scope)!);
    envelope.records.reverse(); localStorage.setItem(scope, JSON.stringify(envelope));
    expect(service.updateHistoryById(original.quotationId!, { ...original, customerCompany: 'B更新' }, original, scope)).toBe(true);
    expect(service.getHistory(scope).map((item) => item.customerCompany)).toEqual(['A', 'B更新']);
    const before = localStorage.getItem(scope);
    expect(service.updateHistoryById(original.quotationId!, original, original, scope)).toBe(false);
    expect(localStorage.getItem(scope)).toBe(before);
    const latest = service.getHistory(scope)[1];
    localStorage.setItem(scope, JSON.stringify([latest, latest])); const duplicateRaw = localStorage.getItem(scope);
    expect(service.updateHistoryById(latest.quotationId!, latest, latest, scope)).toBe(false);
    expect(localStorage.getItem(scope)).toBe(duplicateRaw);
  });

  it('認領寫入失敗不改 target/source/ledger，重試才持久建立 ID 與認領紀錄', () => {
    const raw = JSON.stringify([quotation('舊來源')]); localStorage.setItem('quotation', raw);
    service.saveToHistory(quotation('target'), 'quotation:visitor');
    const before = localStorage.getItem('quotation:visitor');
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full'); });
    expect(service.claimLegacyHistory('quotation:visitor', [0])).toMatchObject({ success: false, reason: 'write-failed' });
    expect(localStorage.getItem('quotation:visitor')).toBe(before); expect(localStorage.getItem('quotation')).toBe(raw);
    write.mockRestore();
    expect(service.claimLegacyHistory('quotation:visitor', [0])).toMatchObject({ success: true, claimed: 1 });
    expect(service.getHistory('quotation:visitor').every((item) => !!item.quotationId)).toBe(true);
    expect(localStorage.getItem('quotation')).toBe(raw);
  });

  it('只允許將使用者選取的原始備份還原到缺失或受保護來源，不覆蓋健康資料', () => {
    const broken = '{backup is intentionally invalid';
    expect(service.restoreRecoveryBackup(broken, 'quotation:user-a')).toEqual({ success: true });
    expect(localStorage.getItem('quotation:user-a')).toBe(broken);
    expect(service.getRecoveryInfo('quotation:user-a').status).toBe('parse-failed');

    expect(service.restoreRecoveryBackup(JSON.stringify([quotation('不該覆蓋')]), 'quotation:user-a')).toEqual({
      success: true,
    });
    // 受保護來源可以讓使用者用已下載的正確備份取代。
    expect(service.getHistory('quotation:user-a')).toHaveLength(1);
    expect(service.restoreRecoveryBackup(JSON.stringify([quotation('健康')]), 'quotation:user-a')).toEqual({
      success: false,
      reason: 'target-not-recoverable',
    });
  });
});
