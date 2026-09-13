import { Injectable, inject } from '@angular/core';
import {
  StorageReadResult,
  StorageService,
} from '@app/shared/services/storage.service';
import { LoggerService } from '@app/shared/services/logger.service';
import { ToastService } from '@app/shared/services/toast.service';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { prependHistoryCopy } from './quotation-history-copy';
import { createQuotationId, normalizeQuotationLifecycle } from '../utils/quotation-lifecycle';

export const QUOTATION_HISTORY_SCHEMA_VERSION = 2;

export type QuotationStorageRecoveryStatus =
  | 'healthy'
  | 'missing'
  | 'parse-failed'
  | 'invalid-root'
  | 'future-schema'
  | 'contains-quarantined-records'
  | 'access-denied';

export interface QuotationStorageRecoveryInfo {
  readonly status: QuotationStorageRecoveryStatus;
  readonly scopeKey: string;
  readonly writeProtected: boolean;
  readonly quarantinedRecordCount: number;
  /** 原始 localStorage JSON；僅供使用者主動下載備份，不應顯示在畫面上。 */
  readonly rawSource?: string;
}

/** 可直接交由 UI 建立 Blob 下載的備份內容。 */
export interface QuotationStorageRecoveryBackup {
  readonly fileName: string;
  readonly mimeType: 'application/json';
  readonly content: string;
}

export interface LegacyHistoryClaimResult {
  readonly success: boolean;
  readonly claimed: number;
  readonly reason?: 'source-missing' | 'target-full' | 'selection-invalid' | 'write-failed';
}

export interface RecoveryRestoreResult {
  readonly success: boolean;
  readonly reason?: 'target-not-recoverable' | 'invalid-backup' | 'write-failed';
}

/**
 * 可讀取、但含有需由使用者修正的欄位的歷史紀錄。
 * 此欄位不會在下一次寫入時回存，避免把 UI 診斷狀態混入使用者資料。
 */
export type RecoveredQuotationData = QuotationData & {
  readonly storageRecovery?: {
    readonly needsRepair: true;
    readonly issues: readonly string[];
  };
};

interface QuotationHistoryEnvelope {
  readonly schemaVersion: typeof QUOTATION_HISTORY_SCHEMA_VERSION;
  readonly records: unknown[];
  readonly quarantinedRecords?: QuarantinedRecord[];
  /** 舊共用來源認領到此 scope 的不可變來源識別，供安全重跑去重。 */
  readonly legacyClaims?: LegacyClaimRecord[];
}

interface QuarantinedRecord {
  readonly reason: string;
  readonly raw: unknown;
}

interface LegacyClaimRecord {
  readonly sourceKey: string;
  readonly sourceFingerprint: string;
  readonly claimedAt: string;
}

interface HistoryLoadResult {
  readonly history: RecoveredQuotationData[];
  /** 與 history 同序的來源內容指紋；只用於 legacy claim 的不可變來源識別。 */
  readonly sourceRecordFingerprints: string[];
  readonly quarantinedRecords: QuarantinedRecord[];
  readonly legacyClaims: LegacyClaimRecord[];
  readonly recovery: QuotationStorageRecoveryInfo;
  /** 舊陣列有壞紀錄時，必須先額外保留完整原始來源才可轉為 v2。 */
  readonly needsSourceBackup: boolean;
}

/**
 * 報價單歷史記錄管理服務。
 *
 * A3b 可將每個操作的 scopeKey 換成帳號／訪客專屬 key；本服務不在此階段決定帳號歸屬。
 */
@Injectable({
  providedIn: 'root',
})
export class QuotationStorageService {
  private readonly storage = inject(StorageService);
  private readonly logger = inject(LoggerService);
  private readonly toastService = inject(ToastService);

  private readonly STORAGE_KEY = 'quotation';
  private readonly MAX_HISTORY_ITEMS = 5;

  /**
   * 取得可辨識的歷史記錄。無效紀錄會隔離而非讓頁面初始化失敗。
   */
  getHistory(scopeKey = this.STORAGE_KEY): RecoveredQuotationData[] {
    return this.loadHistory(scopeKey).history;
  }

  /** 取得目前來源的復原狀態，供歷史 UI 顯示「下載備份／處理資料」入口。 */
  getRecoveryInfo(scopeKey = this.STORAGE_KEY): QuotationStorageRecoveryInfo {
    return this.loadHistory(scopeKey).recovery;
  }

  /**
   * 產生可下載的原始備份內容。不會自行觸發下載或將資料送離瀏覽器。
   */
  createRecoveryBackup(
    scopeKey = this.STORAGE_KEY
  ): QuotationStorageRecoveryBackup | null {
    const recovery = this.loadHistory(scopeKey).recovery;
    if (!recovery.rawSource) return null;

    return {
      fileName: `${this.safeFileName(scopeKey)}-recovery-backup.json`,
      mimeType: 'application/json',
      content: recovery.rawSource,
    };
  }

  /**
   * 還原使用者剛剛選取的備份原文。為防止上傳檔誤覆蓋健康的歷史，只有
   * 目前 key 不存在或正處於寫入保護的復原狀態才允許還原。
   */
  restoreRecoveryBackup(
    rawSource: string,
    scopeKey = this.STORAGE_KEY
  ): RecoveryRestoreResult {
    if (typeof rawSource !== 'string' || rawSource.length === 0) {
      return { success: false, reason: 'invalid-backup' };
    }
    const existing = this.loadHistory(scopeKey);
    if (existing.recovery.status !== 'missing' && !existing.recovery.writeProtected) {
      return { success: false, reason: 'target-not-recoverable' };
    }
    const result = this.storage.setRawDetailed(scopeKey, rawSource);
    return result.success
      ? { success: true }
      : { success: false, reason: 'write-failed' };
  }

  /** 儲存報價單到歷史記錄，新記錄會插入到最前面。 */
  saveToHistory(
    quotation: QuotationData,
    scopeKey = this.STORAGE_KEY
  ): boolean {
    const load = this.loadHistory(scopeKey);
    const prepared = this.prepareRecord(quotation);
    if (!prepared) {
      this.logger.warn('Refused to save structurally invalid quotation data');
      this.storageFailureNotice('目前報價資料結構不完整，未覆寫既有本機紀錄');
      return false;
    }

    return this.persistHistory(
      scopeKey,
      load,
      this.limitHistorySize([prepared, ...load.history])
    );
  }

  /** 複製既有報價為新紀錄，並在筆數上限內保留被複製的原紀錄。 */
  saveCopyToHistory(
    quotation: QuotationData,
    sourceIndex: number,
    scopeKey = this.STORAGE_KEY
  ): boolean {
    const load = this.loadHistory(scopeKey);
    const prepared = this.prepareRecord(quotation);
    if (!prepared) {
      this.storageFailureNotice('目前報價資料結構不完整，未覆寫既有本機紀錄');
      return false;
    }

    return this.persistHistory(
      scopeKey,
      load,
      prependHistoryCopy(
        load.history,
        prepared,
        sourceIndex,
        this.MAX_HISTORY_ITEMS
      )
    );
  }

  /** 更新指定索引的歷史記錄。 */
  updateHistory(
    index: number,
    quotation: QuotationData,
    scopeKey = this.STORAGE_KEY
  ): boolean {
    const load = this.loadHistory(scopeKey);
    if (index < 0 || index >= load.history.length) {
      this.logger.warn(`Invalid history index: ${index}`);
      return false;
    }

    const prepared = this.prepareRecord(quotation);
    if (!prepared) {
      this.storageFailureNotice('目前報價資料結構不完整，未覆寫既有本機紀錄');
      return false;
    }

    const newHistory = [...load.history];
    newHistory[index] = prepared;
    return this.persistHistory(scopeKey, load, newHistory);
  }

  /** Resolve against fresh storage by identity, never by a possibly sorted UI index.
   * The full saved baseline is a concurrency guard (including legacy hash-ID collisions).
   */
  updateHistoryById(
    quotationId: string,
    quotation: QuotationData,
    expected: QuotationData,
    scopeKey = this.STORAGE_KEY
  ): boolean {
    const load = this.loadHistory(scopeKey);
    const matches = load.history.map((record, index) => ({ record, index }))
      .filter(({ record }) => record.quotationId === quotationId);
    if (matches.length !== 1 || quotation.quotationId !== quotationId ||
        expected.quotationId !== quotationId ||
        this.stableStringify(normalizeQuotationLifecycle(matches[0].record)) !==
        this.stableStringify(normalizeQuotationLifecycle(expected))) {
      this.storageFailureNotice('原本的報價紀錄已變更或無法定位；未新增或覆寫任何紀錄，請重新載入確認');
      return false;
    }
    const prepared = this.prepareRecord(quotation);
    if (!prepared) return false;
    const history = [...load.history];
    history[matches[0].index] = prepared;
    return this.persistHistory(scopeKey, load, history);
  }

  /** 從歷史記錄中刪除指定項目。 */
  deleteFromHistory(index: number, scopeKey = this.STORAGE_KEY): boolean {
    const load = this.loadHistory(scopeKey);
    if (index < 0 || index >= load.history.length) {
      this.logger.warn(`Invalid history index: ${index}`);
      return false;
    }

    const newHistory = [...load.history];
    newHistory.splice(index, 1);
    return this.persistHistory(scopeKey, load, newHistory);
  }

  /** 清空可辨識的歷史記錄；資料損壞或未知版本時不會覆寫來源。 */
  clearHistory(scopeKey = this.STORAGE_KEY): boolean {
    return this.persistHistory(scopeKey, this.loadHistory(scopeKey), []);
  }

  getHistoryCount(scopeKey = this.STORAGE_KEY): number {
    return this.getHistory(scopeKey).length;
  }

  hasHistory(scopeKey = this.STORAGE_KEY): boolean {
    return this.getHistoryCount(scopeKey) > 0;
  }

  /** 舊共用 key 只能在使用者明確操作時讀取，絕不因登入自動顯示或同步。 */
  getLegacyHistory(): RecoveredQuotationData[] {
    return this.getHistory(this.STORAGE_KEY);
  }

  /**
   * 將使用者選擇的舊資料複製到目前 scope。原 key 不會清除，避免遷移失敗或重試造成資料遺失。
   * 超過一般 5 筆上限時拒絕，交由 UI 讓使用者縮小選擇，不採靜默截斷。
   */
  claimLegacyHistory(
    scopeKey: string,
    selectedIndexes: readonly number[]
  ): LegacyHistoryClaimResult {
    if (scopeKey === this.STORAGE_KEY || selectedIndexes.length === 0) {
      return { success: false, claimed: 0, reason: 'selection-invalid' };
    }
    const source = this.loadHistory(this.STORAGE_KEY);
    if (source.recovery.status === 'missing') {
      return { success: false, claimed: 0, reason: 'source-missing' };
    }
    const indexes = [...new Set(selectedIndexes)];
    if (indexes.some((index) => index < 0 || index >= source.history.length)) {
      return { success: false, claimed: 0, reason: 'selection-invalid' };
    }
    const target = this.loadHistory(scopeKey);
    const selected = indexes.map((index) => ({
      entry: source.history[index],
      // Legacy array record's content becomes the migration source ID. This value is
      // recorded once and is deliberately independent of target-side quotationId or edits.
      sourceFingerprint: source.sourceRecordFingerprints[index],
    }));
    const claimedSourceFingerprints = new Set(
      target.legacyClaims
        .filter((claim) => claim.sourceKey === this.STORAGE_KEY)
        .map((claim) => claim.sourceFingerprint)
    );
    const toCopy = selected.filter(
      (candidate) =>
        !!candidate.sourceFingerprint &&
        !claimedSourceFingerprints.has(candidate.sourceFingerprint)
    );
    // Must happen after dedupe: a full target can safely retry an all-claimed selection.
    if (target.history.length + toCopy.length > this.MAX_HISTORY_ITEMS) {
      return { success: false, claimed: 0, reason: 'target-full' };
    }
    if (toCopy.length === 0) return { success: true, claimed: 0 };
    const claims = [
      ...target.legacyClaims,
      ...toCopy.map((candidate) => ({
        sourceKey: this.STORAGE_KEY,
        sourceFingerprint: candidate.sourceFingerprint as string,
        claimedAt: new Date().toISOString(),
      })),
    ];
    const success = this.persistHistory(
      scopeKey,
      target,
      [...toCopy.map((candidate) => ({ ...candidate.entry, quotationId: createQuotationId() })), ...target.history],
      claims
    );
    return success
      ? { success: true, claimed: toCopy.length }
      : { success: false, claimed: 0, reason: 'write-failed' };
  }

  private loadHistory(scopeKey: string): HistoryLoadResult {
    const read = this.storage.readJson<unknown>(scopeKey);
    if (read.status === 'missing') {
      return this.emptyLoad(scopeKey, 'missing');
    }
    if (read.status === 'access-denied') {
      this.logger.error(`Unable to access quotation storage (key: ${scopeKey})`, read.error);
      return this.failedLoad(scopeKey, 'access-denied', read);
    }
    if (read.status === 'parse-failed') {
      this.logger.warn(`Quotation storage contains invalid JSON (key: ${scopeKey})`);
      return this.failedLoad(scopeKey, 'parse-failed', read);
    }

    return this.parseHistoryValue(scopeKey, read);
  }

  private parseHistoryValue(
    scopeKey: string,
    read: StorageReadResult<unknown>
  ): HistoryLoadResult {
    const value = read.value;
    if (Array.isArray(value)) {
      return this.parseRecords(scopeKey, value, read.raw, true);
    }

    if (!this.isPlainObject(value)) {
      return this.failedLoad(scopeKey, 'invalid-root', read);
    }

    const version = value['schemaVersion'];
    if (typeof version === 'number' && version > QUOTATION_HISTORY_SCHEMA_VERSION) {
      return this.failedLoad(scopeKey, 'future-schema', read);
    }
    if (version !== QUOTATION_HISTORY_SCHEMA_VERSION || !Array.isArray(value['records'])) {
      return this.failedLoad(scopeKey, 'invalid-root', read);
    }

    const parsed = this.parseRecords(scopeKey, value['records'], read.raw, false);
    const existingQuarantine = this.parseQuarantinedRecords(value['quarantinedRecords']);
    const quarantinedRecords = [...existingQuarantine, ...parsed.quarantinedRecords];
    const status: QuotationStorageRecoveryStatus = quarantinedRecords.length > 0
      ? 'contains-quarantined-records'
      : 'healthy';

    return {
      ...parsed,
      quarantinedRecords,
      legacyClaims: this.parseLegacyClaims(value['legacyClaims']),
      recovery: {
        status,
        scopeKey,
        writeProtected: false,
        quarantinedRecordCount: quarantinedRecords.length,
        rawSource: read.raw,
      },
      needsSourceBackup: parsed.needsSourceBackup,
    };
  }

  private parseRecords(
    scopeKey: string,
    records: unknown[],
    rawSource: string | undefined,
    legacyArray: boolean
  ): HistoryLoadResult {
    const history: RecoveredQuotationData[] = [];
    const quarantinedRecords: QuarantinedRecord[] = [];
    const sourceRecordFingerprints: string[] = [];
    // Deterministic read-only identities for old data: no storage write on read,
    // stable across re-reads/reloads of the same source, unique even for identical rows.
    // A source edit/reorder invalidates these provisional IDs rather than targeting a
    // different row. Explicit successful writes persist them for future stable reads.
    let sourceIdentity: string | undefined;
    const usedIds = new Set(records.filter((record) => this.isPlainObject(record))
      .map((record) => record['quotationId']).filter((id): id is string => typeof id === 'string' && !!id.trim()));
    let hasMissingIds = false;

    records.forEach((record, index) => {
      const prepared = this.prepareRecord(record);
      if (prepared) {
        if (typeof prepared.quotationId !== 'string' || !prepared.quotationId.trim()) {
          hasMissingIds = true;
          sourceIdentity ??= `${this.stableHash(scopeKey)}-${this.stableHash(this.stableStringify(records))}`;
          let id = `legacy-${sourceIdentity}-${index}`;
          while (usedIds.has(id)) id += '-legacy';
          prepared.quotationId = id;
          usedIds.add(id);
        }
        history.push(prepared);
        sourceRecordFingerprints.push(this.legacySourceFingerprint(record));
      } else {
        quarantinedRecords.push({
          reason: `紀錄 ${index + 1} 的必要結構無法辨識`,
          raw: record,
        });
      }
    });

    const status: QuotationStorageRecoveryStatus = quarantinedRecords.length > 0
      ? 'contains-quarantined-records'
      : 'healthy';
    return {
      history,
      sourceRecordFingerprints,
      quarantinedRecords,
      legacyClaims: [],
      recovery: {
        status,
        scopeKey,
        writeProtected: false,
        quarantinedRecordCount: quarantinedRecords.length,
        rawSource,
      },
      needsSourceBackup: hasMissingIds || (legacyArray && quarantinedRecords.length > 0),
    };
  }

  private emptyLoad(scopeKey: string, status: 'missing'): HistoryLoadResult {
    return {
      history: [],
      sourceRecordFingerprints: [],
      quarantinedRecords: [],
      legacyClaims: [],
      recovery: {
        status,
        scopeKey,
        writeProtected: false,
        quarantinedRecordCount: 0,
      },
      needsSourceBackup: false,
    };
  }

  private failedLoad(
    scopeKey: string,
    status: Exclude<QuotationStorageRecoveryStatus, 'healthy' | 'missing' | 'contains-quarantined-records'>,
    read: StorageReadResult<unknown>
  ): HistoryLoadResult {
    return {
      history: [],
      sourceRecordFingerprints: [],
      quarantinedRecords: [],
      legacyClaims: [],
      recovery: {
        status,
        scopeKey,
        writeProtected: true,
        quarantinedRecordCount: 0,
        rawSource: read.raw,
      },
      needsSourceBackup: false,
    };
  }

  private persistHistory(
    scopeKey: string,
    load: HistoryLoadResult,
    history: readonly RecoveredQuotationData[],
    legacyClaims = load.legacyClaims
  ): boolean {
    if (load.recovery.writeProtected) {
      this.storageFailureNotice('偵測到未復原的本機資料，請先下載備份後再處理');
      return false;
    }

    if (load.needsSourceBackup && !this.createDurableSourceBackup(scopeKey, load)) {
      this.storageFailureNotice('無法安全備份受損來源，未覆寫既有本機資料');
      return false;
    }

    const records = history.map((record) => ({
      ...this.removeRecoveryMarker(record),
      quotationId: typeof record.quotationId === 'string' && record.quotationId.trim()
        ? record.quotationId : createQuotationId(),
    }));
    const value: QuotationHistoryEnvelope = {
      schemaVersion: QUOTATION_HISTORY_SCHEMA_VERSION,
      records,
      ...(load.quarantinedRecords.length > 0
        ? { quarantinedRecords: load.quarantinedRecords }
        : {}),
      ...(legacyClaims.length > 0 ? { legacyClaims } : {}),
    };
    return this.storage.setDetailed(scopeKey, value).success;
  }

  /**
   * 把完整舊來源寫入獨立、不可覆寫的備份 key，再允許以 schema v2 包裝資料。
   * 若容量或權限不足，呼叫端必須留在原來源，讓使用者先下載備份。
   */
  private createDurableSourceBackup(
    scopeKey: string,
    load: HistoryLoadResult
  ): boolean {
    const sourceRaw = load.recovery.rawSource;
    if (!sourceRaw) return false;

    const backupKey = `${scopeKey}:recovery-backup:${this.stableHash(sourceRaw)}`;
    const existing = this.storage.readJson<unknown>(backupKey);
    if (existing.status === 'ok') {
      return this.isMatchingBackup(existing.value, sourceRaw);
    }
    if (existing.status !== 'missing') return false;

    return this.storage.setDetailed(backupKey, {
      schemaVersion: 1,
      sourceKey: scopeKey,
      createdAt: new Date().toISOString(),
      sourceRaw,
    }).success;
  }

  private isMatchingBackup(value: unknown, sourceRaw: string): boolean {
    return this.isPlainObject(value) && value['sourceRaw'] === sourceRaw;
  }

  private prepareRecord(value: unknown): RecoveredQuotationData | null {
    if (!this.isPlainObject(value) || !Array.isArray(value['serviceItems'])) {
      return null;
    }

    const issues: string[] = [];
    const record = this.migrateLegacyTaxes(value, issues);
    const serviceItems = record['serviceItems'];
    if (!Array.isArray(serviceItems)) return null;

    serviceItems.forEach((item, index) => {
      if (!this.isPlainObject(item) || typeof item['item'] !== 'string') {
        issues.push(`服務項目 ${index + 1} 缺少名稱或格式錯誤`);
        return;
      }
      this.collectNumericIssue(item, 'price', `服務項目 ${index + 1} 的單價`, issues);
      this.collectNumericIssue(item, 'count', `服務項目 ${index + 1} 的數量`, issues);
      this.collectNumericIssue(item, 'amount', `服務項目 ${index + 1} 的金額`, issues);
    });

    if (issues.some((issue) => issue.includes('缺少名稱或格式錯誤'))) {
      return null;
    }

    [
      ['excludingTax', '未稅金額'],
      ['discountValue', '折扣值'],
      ['discountAmount', '折扣金額'],
      ['afterDiscount', '折扣後金額'],
      ['percentage', '稅率'],
      ['tax', '稅額'],
      ['includingTax', '含稅金額'],
    ].forEach(([key, label]) => this.collectNumericIssue(record, key, label, issues));

    const cleaned: Record<string, unknown> = { ...record };
    delete cleaned['storageRecovery'];
    if (issues.length > 0) {
      Object.defineProperty(cleaned, 'storageRecovery', {
        value: { needsRepair: true, issues: Object.freeze([...issues]) },
        enumerable: false,
        writable: false,
      });
    }
    return cleaned as unknown as RecoveredQuotationData;
  }

  private migrateLegacyTaxes(
    record: Record<string, unknown>,
    issues: string[]
  ): Record<string, unknown> {
    const taxes = record['taxes'];
    if (!Array.isArray(taxes) || taxes.length === 0 || record['taxName']) {
      return { ...record };
    }

    const validTaxes = taxes.filter(
      (tax): tax is Record<string, unknown> =>
        this.isPlainObject(tax) &&
        typeof tax['name'] === 'string' &&
        tax['name'].length > 0
    );
    if (validTaxes.length === 0) {
      issues.push('舊稅別資料無有效稅名');
      return { ...record };
    }

    const firstTax = validTaxes[0];
    const taxAmounts = validTaxes.map((tax, index) => {
      const amount = tax['amount'];
      if (typeof amount !== 'number' || !Number.isFinite(amount)) {
        issues.push(`舊稅別 ${index + 1} 的稅額`);
        return 0;
      }
      return amount;
    });
    const percentage = firstTax['percentage'];
    if (typeof percentage !== 'number' || !Number.isFinite(percentage)) {
      issues.push('舊稅別的稅率');
    }

    if (taxes.length > 1) {
      this.logger.warn(
        'Migrating legacy multi-tax quotation; retaining the first tax label and total tax amount'
      );
    }
    const migrated = { ...record };
    migrated['taxName'] = firstTax['name'];
    migrated['percentage'] =
      typeof percentage === 'number' && Number.isFinite(percentage)
        ? percentage
        : 0;
    migrated['tax'] = taxAmounts.reduce((sum, amount) => sum + amount, 0);
    delete migrated['taxes'];
    delete migrated['customTaxOptions'];
    return migrated;
  }

  private collectNumericIssue(
    value: Record<string, unknown>,
    key: string,
    label: string,
    issues: string[]
  ): void {
    if (
      key in value &&
      (typeof value[key] !== 'number' || !Number.isFinite(value[key]))
    ) {
      issues.push(`${label}不是有限數值`);
    }
  }

  private parseQuarantinedRecords(value: unknown): QuarantinedRecord[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
      (record): record is QuarantinedRecord =>
        this.isPlainObject(record) &&
        typeof record['reason'] === 'string' &&
        'raw' in record
    );
  }

  private parseLegacyClaims(value: unknown): LegacyClaimRecord[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    return value.filter((claim): claim is LegacyClaimRecord => {
      if (
        !this.isPlainObject(claim) ||
        typeof claim['sourceKey'] !== 'string' ||
        typeof claim['sourceFingerprint'] !== 'string' ||
        typeof claim['claimedAt'] !== 'string'
      ) {
        return false;
      }
      const key = `${claim['sourceKey']}\u0000${claim['sourceFingerprint']}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private removeRecoveryMarker(
    record: RecoveredQuotationData
  ): Record<string, unknown> {
    const copy = { ...record } as Record<string, unknown>;
    delete copy['storageRecovery'];
    return copy;
  }

  private limitHistorySize(
    history: readonly RecoveredQuotationData[]
  ): RecoveredQuotationData[] {
    return history.slice(0, this.MAX_HISTORY_ITEMS);
  }

  private storageFailureNotice(message: string): void {
    this.logger.warn(message);
    this.toastService.warning(message);
    // StorageService already communicates quota and access failures. This warning covers
    // recovery policy failures where no localStorage write was attempted.
  }

  private stableHash(value: string): string {
    let hash = 5381;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 33) ^ value.charCodeAt(index);
    }
    return (hash >>> 0).toString(36);
  }

  private legacySourceFingerprint(record: unknown): string {
    return this.stableHash(this.stableStringify(record));
  }

  /** Object key order must not turn the same legacy JSON data into a second claim. */
  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(',')}]`;
    }
    if (this.isPlainObject(value)) {
      return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${this.stableStringify(value[key])}`)
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private safeFileName(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_') || 'quotation';
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
