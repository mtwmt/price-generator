import { Injectable, computed, inject, signal } from '@angular/core';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { normalizeQuotationLifecycle } from '@app/features/quotation/utils/quotation-lifecycle';
import { AuthService } from '@app/core/services/auth.service';
import {
  CLOUD_SCHEMA_VERSION,
  WebCryptoSha256HashProvider,
  createCloudQuotationRevision,
  createQuotationCloudSummary,
  decideQuotationStorageRoute,
  verifyCloudQuotationEnvelope,
  type QuotationStorageRoute,
  type CloudQuotationRevision,
  type CloudQuotationRevisionInput,
} from './index';
import {
  buildCloudHistoryEntries,
  type CloudQuotationHistoryEntry,
  type DriveRevisionMetadata,
} from './cloud-history';
import {
  DriveAuthorizationRequiredError,
  DriveOperationNotSentError,
  DriveServiceUnavailableError,
  DriveCloudApiService,
  type DriveOperationResponse,
} from './drive-cloud-api.service';
import {
  decideCloudSyncInitialization,
  readSavedCloudSyncPreference,
  writeCloudSyncEnabledPreference,
} from './cloud-sync-preference';
import { canonicalizeJsonValue } from './cloud-json';
import { createLocalMigrationOperation } from './cloud-local-migration';
import { classifyDriveFailure } from './cloud-failures';
import { readCloudLifecycleMetadata } from './cloud-lifecycle-metadata';

export type CloudSyncStatus =
  | 'local'
  | 'connecting'
  | 'syncing'
  | 'synced'
  | 'error'
  | 'reconnect';

function newIdentifier(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/.test(value)
  );
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    Number.isFinite(new Date(value).getTime()) &&
    new Date(value).toISOString() === value
  );
}

function readMetadata(value: unknown): DriveRevisionMetadata | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return null;
  const record = value as Record<string, unknown>;
  if (
    !isIdentifier(record['fileId']) ||
    typeof record['name'] !== 'string' ||
    !isIdentifier(record['quotationId']) ||
    !isIdentifier(record['revisionId']) ||
    !Array.isArray(record['parentRevisionIds']) ||
    !record['parentRevisionIds'].every(isIdentifier) ||
    !isIsoDate(record['createdAt'])
  ) {
    return null;
  }
  const kind = record['kind'];
  if (
    kind !== 'create' &&
    kind !== 'update' &&
    kind !== 'delete' &&
    kind !== 'restore'
  )
    return null;
  return {
    fileId: record['fileId'],
    name: record['name'],
    quotationId: record['quotationId'],
    revisionId: record['revisionId'],
    parentRevisionIds: Object.freeze([...record['parentRevisionIds']]),
    kind,
    createdAt: record['createdAt'],
    ...readCloudLifecycleMetadata(record),
  };
}

function assertOperationReceipt(
  receipt: DriveOperationResponse,
  input: {
    operationId: string;
    quotationId: string;
    revisionId: string;
  }
): void {
  if (
    receipt.operationId !== input.operationId ||
    receipt.quotationId !== input.quotationId ||
    receipt.revisionId !== input.revisionId ||
    !isIdentifier(receipt.driveFileId)
  ) {
    throw new Error('雲端儲存回應與本次操作不一致');
  }
}

export interface LocalHistorySyncResult {
  readonly uploaded: number;
  readonly skipped: number;
}

/** Synchronously reserved, immutable target/content/identity, before hashing or I/O. */
export interface CloudSaveIntent {
  readonly repository: 'cloud';
  readonly input: CloudQuotationRevisionInput<QuotationData>;
}

interface CloudSaveState {
  readonly version: number;
  readonly key: string;
  readonly fingerprint: string;
  outcome: 'ready' | 'not-sent' | 'unknown' | 'saved';
  revision?: CloudQuotationRevision<QuotationData>;
  flight?: Promise<CloudQuotationHistoryEntry>;
  result?: CloudQuotationHistoryEntry;
}

function freezeIntent<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeIntent);
    Object.freeze(value);
  }
  return value;
}

/**
 * 贊助會員的雲端同步協調層。完整內容只在選取或儲存時讀寫；列表只讀 Drive metadata，
 * 因而不會因報價單筆數增加而下載全部 payload。
 */
@Injectable({ providedIn: 'root' })
export class CloudQuotationSyncService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(DriveCloudApiService);
  private readonly hashProvider = new WebCryptoSha256HashProvider();
  private ownerSub: string | null = null;
  private readonly sessionOwner = signal<string | null>(null);
  private operationVersion = 0;
  private statusOperationVersion = 0;
  private revisionMetadata: readonly DriveRevisionMetadata[] = [];
  /** 傳輸結果遺失時，下一次相同儲存必須重送同一 immutable revision。 */
  private readonly pendingSaveOperations = new Map<string, CloudSaveIntent>();
  private readonly saveStates = new WeakMap<CloudSaveIntent, CloudSaveState>();

  readonly route = signal<QuotationStorageRoute>(
    decideQuotationStorageRoute({
      isPremium: false,
      isAdmin: false,
      isCloudSyncEnabled: false,
      driveConnection: 'not-connected',
    })
  );
  readonly history = signal<readonly CloudQuotationHistoryEntry[]>([]);
  readonly hasIncompleteHistoryMetadata = computed(() => this.history().some(({ data }) =>
    data.quotationNumber === undefined || data.status === undefined
  ));
  readonly isAvailable = signal(true);
  readonly isEligible = computed(
    () => this.auth.isPremium() || this.auth.isAdmin()
  );
  private syncEnabledPreference: boolean | null = null;
  readonly isSyncEnabled = signal(this.syncEnabledPreference === true);
  readonly isCloudStorage = computed(
    () => this.route().repository === 'cloud-sync'
  );
  /** Authorization availability may lapse without changing the editor's repository. */
  readonly isCloudRepository = computed(() =>
    this.isSyncEnabled() && this.isEligible() && this.auth.isAuthenticated() &&
    this.sessionOwner() !== null && this.sessionOwner() === this.auth.userId()
  );
  readonly syncStatus = signal<CloudSyncStatus>('local');
  readonly lastSyncedAt = signal<number | null>(null);
  readonly syncError = signal<string | null>(null);

  async initialize(): Promise<void> {
    const resume = this.isCloudRepository();
    const operationVersion = resume ? this.operationVersion : ++this.operationVersion;
    if (!resume) {
      this.history.set([]);
      this.sessionOwner.set(null);
      this.ownerSub = null;
      this.pendingSaveOperations.clear();
    }
    if (this.auth.isAuthenticated() && this.isEligible()) {
      this.readSyncEnabledPreferenceForCurrentOwner();
    }
    if (
      decideCloudSyncInitialization({
        isAuthenticated: this.auth.isAuthenticated(),
        isEligible: this.isEligible(),
        isSyncEnabled: this.syncEnabledPreference,
      }) === 'disconnect'
    ) {
      this.api.disconnect();
      this.sessionOwner.set(null);
      this.setNotConnectedRoute();
      this.setLocalStatus();
      return;
    }

    if (!this.api.isConfigured()) {
      this.isAvailable.set(false);
      this.setNotConnectedRoute();
      this.setLocalStatus();
      return;
    }

    // 只嘗試無提示恢復既有授權；首次授權仍須由使用者點擊連線按鈕啟動。
    // 不可先 disconnect，否則會清除同一頁面仍有效的記憶體 token。
    const statusOperationVersion = this.beginStatus('connecting');
    this.ownerSub = this.requireAuthenticatedOwner();
    this.setNotConnectedRoute();

    try {
      const restored = await this.api.restoreConnection(
        this.requireAuthenticatedEmail()
      );
      if (
        !this.isCurrentOperation(operationVersion) ||
        !this.isCurrentStatusOperation(statusOperationVersion)
      ) {
        return;
      }

      if (!restored) {
        if (!this.isSyncEnabled()) {
          this.setNotConnectedRoute();
          this.setLocalStatus(statusOperationVersion);
          return;
        }
        this.setReconnectRequiredRoute();
        this.syncStatus.set('reconnect');
        this.syncError.set(null);
        return;
      }

      this.ownerSub = this.requireAuthenticatedOwner();
      this.sessionOwner.set(this.ownerSub);
      this.setSyncEnabledPreference(true);
      this.route.set(
        decideQuotationStorageRoute({
          isPremium: this.auth.isPremium(),
          isAdmin: this.auth.isAdmin(),
          isCloudSyncEnabled: this.isSyncEnabled(),
          driveConnection: 'connected',
        })
      );
      await this.reloadHistoryForOperation(operationVersion);
    } catch (error) {
      if (!this.isCurrentOperation(operationVersion)) return;
      this.handleDriveError(error, statusOperationVersion);
    }
  }

  async beginConnect(): Promise<void> {
    if (!this.auth.isAuthenticated() || !this.isEligible()) return;

    const resume = this.isCloudRepository();
    this.setSyncEnabledPreference(true);
    const operationVersion = resume ? this.operationVersion : ++this.operationVersion;
    if (!resume) {
      this.pendingSaveOperations.clear();
      this.history.set([]);
      this.sessionOwner.set(null);
    }
    const statusOperationVersion = this.beginStatus('connecting');
    this.ownerSub = this.requireAuthenticatedOwner();
    try {
      await this.api.beginConnect(this.requireAuthenticatedEmail());
      if (!this.isCurrentOperation(operationVersion) ||
          !this.isCurrentStatusOperation(statusOperationVersion)) return;
      this.sessionOwner.set(this.ownerSub);
      this.route.set(
        decideQuotationStorageRoute({
          isPremium: this.auth.isPremium(),
          isAdmin: this.auth.isAdmin(),
          isCloudSyncEnabled: this.isSyncEnabled(),
          driveConnection: 'connected',
        })
      );
      await this.reloadHistoryForOperation(operationVersion);
    } catch (error) {
      if (!this.isCurrentOperation(operationVersion)) return;
      this.handleDriveError(error, statusOperationVersion);
      throw error;
    }
  }

  disconnect(): void {
    ++this.operationVersion;
    this.pendingSaveOperations.clear();
    this.api.disconnect();
    this.ownerSub = null;
    this.sessionOwner.set(null);
    this.history.set([]);
    this.route.set(this.notConnectedRoute());
    this.setLocalStatus();
  }

  async setSyncEnabled(enabled: boolean): Promise<void> {
    if (enabled && !this.isEligible()) {
      this.disconnect();
      return;
    }

    this.setSyncEnabledPreference(enabled);
    if (!enabled) {
      this.disconnect();
      return;
    }

    // 切換鈕只恢復既有授權；popup 必須由畫面上的「連結」按鈕同步觸發，
    // 避免 await 後被瀏覽器視為非使用者手勢而封鎖。
    await this.initialize();
  }

  async reloadHistory(): Promise<void> {
    await this.reloadHistoryForOperation(this.operationVersion);
  }

  private async reloadHistoryForOperation(
    operationVersion: number,
    statusOperationVersion = this.beginStatus('syncing'),
    completeOnSuccess = true
  ): Promise<void> {
    try {
      const ownerSub = this.requireConnectedOwner();
      const revisions: DriveRevisionMetadata[] = [];
      const seenTokens = new Set<string>();
      let pageToken: string | undefined;
      do {
        const page = await this.api.listRevisions(ownerSub, pageToken);
        if (!this.isCurrentOperation(operationVersion)) return;
        if (!this.isCurrentStatusOperation(statusOperationVersion)) return;
        for (const value of page.files) {
          const metadata = readMetadata(value);
          if (metadata) revisions.push(metadata);
        }
        const next = page.nextPageToken;
        if (next !== null && (!next || seenTokens.has(next))) {
          throw new Error('雲端歷史分頁游標無效');
        }
        if (next) seenTokens.add(next);
        pageToken = next ?? undefined;
      } while (pageToken);
      if (!this.isCurrentOperation(operationVersion)) return;
      if (!this.isCurrentStatusOperation(statusOperationVersion)) return;
      if (
        this.requireConnectedOwner() !== ownerSub ||
        this.requireAuthenticatedOwner() !== ownerSub
      ) {
        throw new Error('雲端同步帳號已變更');
      }
      this.revisionMetadata = revisions;
      this.history.set(buildCloudHistoryEntries(revisions));
      if (completeOnSuccess) this.completeStatus(statusOperationVersion);
    } catch (error) {
      if (!this.isCurrentOperation(operationVersion)) return;
      this.handleDriveError(error, statusOperationVersion);
      throw error;
    }
  }

  async load(entry: CloudQuotationHistoryEntry): Promise<QuotationData> {
    return this.loadForOperation(
      entry,
      this.operationVersion,
      this.beginStatus('syncing')
    );
  }

  private async loadForOperation(
    entry: CloudQuotationHistoryEntry,
    operationVersion: number,
    statusOperationVersion: number,
    completeOnSuccess = true
  ): Promise<QuotationData> {
    try {
      const ownerSub = this.requireConnectedOwner();
      const revision = await verifyCloudQuotationEnvelope(
        await this.api.getRevision(entry.fileId),
        this.hashProvider
      );
      this.assertCurrentOperation(operationVersion);
      if (
        revision.ownerSub !== ownerSub ||
        revision.quotationId !== entry.quotationId ||
        revision.revisionId !== entry.revisionId ||
        revision.payload === null
      ) {
        throw new Error('雲端報價單內容與清單 metadata 不一致');
      }
      // v1 hash 驗證時保留原 payload；只有在應用程式讀取層補入封套 ID，
      // 避免把新增欄位誤納入舊 schema 的 canonical hash。
      const data = normalizeQuotationLifecycle(
        revision.schemaVersion === 1
          ? { ...(revision.payload as unknown as QuotationData), quotationId: revision.quotationId }
          : (revision.payload as unknown as QuotationData)
      );
      this.history.update((entries) =>
        entries.map((item) =>
          item.revisionId === entry.revisionId ? { ...item, data } : item
        )
      );
      if (completeOnSuccess) this.completeStatus(statusOperationVersion);
      return data;
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.handleDriveError(error, statusOperationVersion);
      }
      throw error;
    }
  }

  /** 相同文件尚未確定結果時，不准用不同 payload/parent 開另一個操作。 */
  prepareSave(data: QuotationData, existing?: CloudQuotationHistoryEntry): CloudSaveIntent {
    const ownerSub = this.requireConnectedOwner();
    if (ownerSub !== this.requireAuthenticatedOwner()) throw new Error('雲端同步帳號已變更');
    const key = `${ownerSub}:${existing?.quotationId || data.quotationId || 'new'}`;
    const fingerprint = canonicalizeJsonValue({
      payload: { ...data, quotationId: existing?.quotationId || data.quotationId || null },
      parents: [...(existing?.headRevisionIds ?? [])].sort(),
    });
    const pending = this.pendingSaveOperations.get(key);
    if (pending) {
      if (this.saveStates.get(pending)?.fingerprint !== fingerprint) {
        throw new Error('上次儲存結果尚未確認，請先確認原提交');
      }
      return pending;
    }
    const quotationId = existing?.quotationId || data.quotationId || newIdentifier();
    const payload: QuotationData = JSON.parse(canonicalizeJsonValue(
      normalizeQuotationLifecycle({ ...data, quotationId })
    ));
    const intent: CloudSaveIntent = freezeIntent({
      repository: 'cloud',
      input: {
        schemaVersion: CLOUD_SCHEMA_VERSION,
        ownerSub, quotationId, payload,
        parentRevisionIds: [...(existing?.headRevisionIds ?? [])],
        summary: createQuotationCloudSummary(payload),
        kind: existing ? 'update' : 'create',
        operationId: newIdentifier(), revisionId: newIdentifier(),
        createdAt: new Date().toISOString(),
      },
    });
    // Reservation is synchronous; not even SHA work starts before this is registered.
    this.pendingSaveOperations.set(key, intent);
    this.saveStates.set(intent, {
      version: this.operationVersion, key, fingerprint, outcome: 'ready',
    });
    return intent;
  }

  saveOutcome(intent: CloudSaveIntent): CloudSaveState['outcome'] {
    return this.saveStates.get(intent)?.outcome ?? 'not-sent';
  }

  /** Only an unsent reservation may be cancelled by the duplicate-number dialog. */
  cancelPreparedSave(intent: CloudSaveIntent): void {
    const state = this.saveStates.get(intent);
    if (!state || state.outcome !== 'ready' || state.flight) return;
    state.outcome = 'not-sent';
    if (this.pendingSaveOperations.get(state.key) === intent) this.pendingSaveOperations.delete(state.key);
  }

  save(data: QuotationData, existing?: CloudQuotationHistoryEntry): Promise<CloudQuotationHistoryEntry> {
    try {
      return this.submitSave(this.prepareSave(data, existing));
    } catch (error) {
      return Promise.reject(error);
    }
  }

  submitSave(intent: CloudSaveIntent): Promise<CloudQuotationHistoryEntry> {
    const state = this.saveStates.get(intent);
    if (!state) return Promise.reject(new Error('未知的儲存操作'));
    if (state.flight) return state.flight;
    const assertCurrent = () => {
      this.assertCurrentOperation(state.version);
      if (intent.input.ownerSub !== this.requireAuthenticatedOwner() ||
          intent.input.ownerSub !== this.requireConnectedOwner()) {
        throw new Error('雲端同步帳號已變更');
      }
    };
    try { assertCurrent(); } catch (error) { return Promise.reject(error); }
    if (state.result) return Promise.resolve(state.result);
    const statusVersion = this.beginStatus('syncing');
    // Shared promise is installed before its microtask can start hashing.
    const flight = Promise.resolve().then(async () => {
      let transportStarted = false;
      try {
        assertCurrent();
        state.revision ??= await createCloudQuotationRevision(intent.input, this.hashProvider);
        assertCurrent();
        transportStarted = true;
        const receipt = await this.api.createOperation(state.revision);
        assertOperationReceipt(receipt, state.revision);
        assertCurrent();
        const entry: CloudQuotationHistoryEntry = {
          fileId: receipt.driveFileId,
          quotationId: state.revision.quotationId,
          revisionId: state.revision.revisionId,
          headRevisionIds: Object.freeze([state.revision.revisionId]),
          data: state.revision.payload,
        };
        this.history.update((entries) => [
          entry, ...entries.filter((item) => item.quotationId !== entry.quotationId),
        ]);
        state.result = entry;
        state.outcome = 'saved';
        if (this.pendingSaveOperations.get(state.key) === intent) this.pendingSaveOperations.delete(state.key);
        this.completeStatus(statusVersion);
        return entry;
      } catch (error) {
        // Before transport, failure is known not to have persisted. Once sent,
        // conservatively keep the immutable operation until a verified receipt.
        const definitelyNotSent = error instanceof DriveOperationNotSentError;
        state.outcome = state.outcome === 'unknown' || (transportStarted && !definitelyNotSent) ? 'unknown' : 'not-sent';
        if (state.outcome === 'not-sent' && this.pendingSaveOperations.get(state.key) === intent) {
          this.pendingSaveOperations.delete(state.key);
        }
        if (this.isCurrentOperation(state.version)) this.handleDriveError(
          definitelyNotSent ? error.originalError : error, statusVersion
        );
        throw error;
      } finally {
        state.flight = undefined;
      }
    });
    state.flight = flight;
    return flight;
  }
  /** 將本機歷史批次上傳到雲端；相同內容重複執行時會由固定 operationId 去重。 */
  async syncLocalHistory(
    localHistory: readonly QuotationData[]
  ): Promise<LocalHistorySyncResult> {
    const operationVersion = this.operationVersion;
    const statusOperationVersion = this.beginStatus('syncing');
    try {
      const ownerSub = this.requireConnectedOwner();
      const assertCurrent = () => {
        this.assertCurrentOperation(operationVersion);
        if (
          this.requireConnectedOwner() !== ownerSub ||
          this.requireAuthenticatedOwner() !== ownerSub
        ) {
          throw new Error('雲端同步帳號已變更');
        }
      };
      assertCurrent();
      await this.reloadHistoryForOperation(
        operationVersion,
        statusOperationVersion,
        false
      );
      assertCurrent();
      const revisions = this.revisionMetadata;
      const uniqueHistory = new Map<string, QuotationData>();

      for (const data of localHistory) {
        const dataHash = await this.hashProvider.hash(
          canonicalizeJsonValue(data)
        );
        if (!uniqueHistory.has(dataHash)) uniqueHistory.set(dataHash, data);
      }

      let uploaded = 0;
      for (const [dataHash, data] of uniqueHistory) {
        assertCurrent();
        const operation = await createLocalMigrationOperation(
          ownerSub,
          data,
          dataHash,
          revisions,
          this.hashProvider
        );
        assertCurrent();
        if (!operation) continue;
        const receipt = await this.api.createOperation(operation.revision);
        assertOperationReceipt(receipt, operation.revision);
        assertCurrent();
        if (receipt.status === 'accepted') uploaded += 1;
      }

      await this.reloadHistoryForOperation(
        operationVersion,
        statusOperationVersion,
        false
      );
      assertCurrent();
      this.completeStatus(statusOperationVersion);
      return {
        uploaded,
        skipped: localHistory.length - uploaded,
      };
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.handleDriveError(error, statusOperationVersion);
      }
      throw error;
    }
  }

  async delete(entry: CloudQuotationHistoryEntry): Promise<void> {
    const operationVersion = this.operationVersion;
    const statusOperationVersion = this.beginStatus('syncing');
    try {
      const ownerSub = this.requireConnectedOwner();
      const data = await this.loadForOperation(
        entry,
        operationVersion,
        statusOperationVersion,
        false
      );
      const revision = await createCloudQuotationRevision(
        {
          schemaVersion: CLOUD_SCHEMA_VERSION,
          quotationId: entry.quotationId,
          revisionId: newIdentifier(),
          parentRevisionIds: entry.headRevisionIds,
          operationId: newIdentifier(),
          ownerSub,
          kind: 'delete',
          payload: null,
          summary: createQuotationCloudSummary(data),
          createdAt: new Date().toISOString(),
        },
        this.hashProvider
      );
      this.assertCurrentOperation(operationVersion);
      const receipt = await this.api.createOperation(revision);
      assertOperationReceipt(receipt, revision);
      this.assertCurrentOperation(operationVersion);
      this.history.update((entries) =>
        entries.filter((item) => item.quotationId !== entry.quotationId)
      );
      this.completeStatus(statusOperationVersion);
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.handleDriveError(error, statusOperationVersion);
      }
      throw error;
    }
  }

  private requireAuthenticatedOwner(): string {
    const ownerSub = this.auth.userId();
    if (!isIdentifier(ownerSub)) throw new Error('會員帳號識別無效');
    return ownerSub;
  }

  private requireAuthenticatedEmail(): string {
    const email = this.auth.userEmail()?.trim();
    if (!email) throw new Error('會員 Google 帳號電子郵件無效');
    return email;
  }

  private setNotConnectedRoute(): void {
    this.route.set(this.notConnectedRoute());
  }

  private setReconnectRequiredRoute(): void {
    this.route.set(
      decideQuotationStorageRoute({
        isPremium: this.auth.isPremium(),
        isAdmin: this.auth.isAdmin(),
        isCloudSyncEnabled: this.isSyncEnabled(),
        driveConnection: 'reconnect-required',
      })
    );
  }

  private handleDriveError(
    error: unknown,
    statusOperationVersion: number
  ): void {
    if (!this.isCurrentStatusOperation(statusOperationVersion)) return;

    if (error instanceof DriveServiceUnavailableError) {
      if (error.code === 'forbidden') {
        this.api.disconnect();
        this.ownerSub = null;
        this.sessionOwner.set(null);
        this.history.set([]);
        this.setNotConnectedRoute();
      }
      this.syncStatus.set('error');
      this.syncError.set(error.safeMessage);
      return;
    }

    const classification = classifyDriveFailure(error);
    const requiresReconnect =
      error instanceof DriveAuthorizationRequiredError ||
      classification.requiresReconnect;

    if (requiresReconnect) {
      this.setReconnectRequiredRoute();
    }

    if (requiresReconnect) {
      this.syncStatus.set('reconnect');
      this.syncError.set(
        error instanceof DriveAuthorizationRequiredError &&
        error.message === '請允許 Google Drive 存取權限後重新連線'
          ? error.message
          : 'Google Drive 授權已失效，請重新連線'
      );
      return;
    }

    this.syncStatus.set('error');
    this.syncError.set(
      classification.category === 'membership'
        ? '目前帳號無法使用雲端同步'
        : classification.retryable
          ? '雲端同步暫時無法完成，請稍後重試'
          : '雲端同步失敗，請稍後再試'
    );
  }

  private beginStatus(status: 'connecting' | 'syncing'): number {
    const statusOperationVersion = ++this.statusOperationVersion;
    this.syncStatus.set(status);
    this.syncError.set(null);
    return statusOperationVersion;
  }

  private completeStatus(statusOperationVersion: number): void {
    if (!this.isCurrentStatusOperation(statusOperationVersion)) return;
    this.syncStatus.set('synced');
    this.syncError.set(null);
    this.lastSyncedAt.set(Date.now());
  }

  private setLocalStatus(statusOperationVersion?: number): void {
    if (statusOperationVersion === undefined) {
      ++this.statusOperationVersion;
    } else if (!this.isCurrentStatusOperation(statusOperationVersion)) {
      return;
    }
    this.syncStatus.set('local');
    this.syncError.set(null);
  }

  private isCurrentStatusOperation(statusOperationVersion: number): boolean {
    return statusOperationVersion === this.statusOperationVersion;
  }

  private requireConnectedOwner(): string {
    if (!this.isCloudStorage() || !this.ownerSub)
      throw new Error('Google Drive 尚未連結');
    if (!this.auth.isAuthenticated() || this.ownerSub !== this.auth.userId())
      throw new Error('雲端同步帳號已變更');
    return this.ownerSub;
  }

  private isCurrentOperation(operationVersion: number): boolean {
    return operationVersion === this.operationVersion &&
      (this.ownerSub === null || (this.auth.isAuthenticated() && this.ownerSub === this.auth.userId()));
  }

  private assertCurrentOperation(operationVersion: number): void {
    if (!this.isCurrentOperation(operationVersion)) {
      throw new DriveAuthorizationRequiredError(
        'Google Drive 同步狀態已變更，請重新儲存'
      );
    }
  }

  private notConnectedRoute(): QuotationStorageRoute {
    return decideQuotationStorageRoute({
      isPremium: this.auth.isPremium(),
      isAdmin: this.auth.isAdmin(),
      isCloudSyncEnabled: this.isSyncEnabled(),
      driveConnection: 'not-connected',
    });
  }

  private setSyncEnabledPreference(enabled: boolean): void {
    this.syncEnabledPreference = enabled;
    this.isSyncEnabled.set(enabled);
    writeCloudSyncEnabledPreference(enabled, this.auth.userId());
  }

  private readSyncEnabledPreferenceForCurrentOwner(): void {
    this.syncEnabledPreference = readSavedCloudSyncPreference(
      this.requireAuthenticatedOwner()
    );
    this.isSyncEnabled.set(this.syncEnabledPreference === true);
  }
}
