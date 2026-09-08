import { Injectable, computed, inject, signal } from '@angular/core';
import { QuotationData } from '@app/features/quotation/models/quotation.model';
import { AuthService } from '@app/core/services/auth.service';
import {
  CLOUD_SCHEMA_VERSION,
  WebCryptoSha256HashProvider,
  createCloudQuotationDraft,
  createCloudQuotationRevision,
  createCloudSaveOperation,
  createQuotationCloudSummary,
  decideQuotationStorageRoute,
  verifyCloudQuotationEnvelope,
  type QuotationStorageRoute,
} from './index';
import {
  buildCloudHistoryEntries,
  type CloudQuotationHistoryEntry,
  type DriveRevisionMetadata,
} from './cloud-history';
import {
  DriveAuthorizationRequiredError,
  DriveCloudApiService,
  type DriveOperationResponse,
} from './drive-cloud-api.service';
import {
  decideCloudSyncInitialization,
  readCloudSyncEnabledPreference,
  writeCloudSyncEnabledPreference,
} from './cloud-sync-preference';
import { canonicalizeJsonValue } from './cloud-json';
import { createLocalMigrationOperation } from './cloud-local-migration';

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
  private operationVersion = 0;
  private revisionMetadata: readonly DriveRevisionMetadata[] = [];

  readonly route = signal<QuotationStorageRoute>(
    decideQuotationStorageRoute({
      isPremium: false,
      isAdmin: false,
      isCloudSyncEnabled: false,
      driveConnection: 'not-connected',
    })
  );
  readonly history = signal<readonly CloudQuotationHistoryEntry[]>([]);
  readonly isAvailable = signal(true);
  readonly isEligible = computed(
    () => this.auth.isPremium() || this.auth.isAdmin()
  );
  readonly isSyncEnabled = signal(readCloudSyncEnabledPreference());
  readonly isCloudStorage = computed(
    () => this.route().repository === 'cloud-sync'
  );

  async initialize(): Promise<void> {
    const operationVersion = ++this.operationVersion;
    this.history.set([]);
    this.ownerSub = null;
    if (
      decideCloudSyncInitialization({
        isAuthenticated: this.auth.isAuthenticated(),
        isEligible: this.isEligible(),
        isSyncEnabled: this.isSyncEnabled(),
      }) === 'disconnect'
    ) {
      this.api.disconnect();
      this.setNotConnectedRoute();
      return;
    }

    if (!this.api.isConfigured()) {
      this.isAvailable.set(false);
      this.setNotConnectedRoute();
      return;
    }

    // 先保留本機模式；若 Google 仍保留既有授權，則無提示恢復 Drive token。
    this.setNotConnectedRoute();

    try {
      const restored = await this.api.restoreConnection(
        this.requireAuthenticatedEmail()
      );
      if (!restored || !this.isCurrentOperation(operationVersion)) return;

      this.ownerSub = this.requireAuthenticatedOwner();
      this.route.set(
        decideQuotationStorageRoute({
          isPremium: this.auth.isPremium(),
          isAdmin: this.auth.isAdmin(),
          isCloudSyncEnabled: this.isSyncEnabled(),
          driveConnection: 'connected',
        })
      );
      await this.reloadHistory(operationVersion);
    } catch (error) {
      if (!this.isCurrentOperation(operationVersion)) return;

      // 自動恢復失敗不阻斷網站登入；使用者仍可按「連結 Google Drive」完成互動授權。
      this.setNotConnectedRoute();
    }
  }

  async beginConnect(): Promise<void> {
    if (!this.auth.isAuthenticated() || !this.isEligible()) return;

    this.setSyncEnabledPreference(true);
    const operationVersion = ++this.operationVersion;
    this.ownerSub = this.requireAuthenticatedOwner();
    try {
      await this.api.beginConnect(this.requireAuthenticatedEmail());
      if (!this.isCurrentOperation(operationVersion)) return;
      this.route.set(
        decideQuotationStorageRoute({
          isPremium: this.auth.isPremium(),
          isAdmin: this.auth.isAdmin(),
          isCloudSyncEnabled: this.isSyncEnabled(),
          driveConnection: 'connected',
        })
      );
      await this.reloadHistory(operationVersion);
    } catch (error) {
      if (!this.isCurrentOperation(operationVersion)) return;
      this.handleDriveError(error);
      throw error;
    }
  }

  disconnect(): void {
    ++this.operationVersion;
    this.api.disconnect();
    this.ownerSub = null;
    this.history.set([]);
    this.route.set(this.notConnectedRoute());
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

    await this.initialize();
  }

  async reloadHistory(operationVersion = this.operationVersion): Promise<void> {
    try {
      const ownerSub = this.requireConnectedOwner();
      const revisions: DriveRevisionMetadata[] = [];
      const seenTokens = new Set<string>();
      let pageToken: string | undefined;
      do {
        const page = await this.api.listRevisions(ownerSub, pageToken);
        if (!this.isCurrentOperation(operationVersion)) return;
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
      if (
        this.requireConnectedOwner() !== ownerSub ||
        this.requireAuthenticatedOwner() !== ownerSub
      ) {
        throw new Error('雲端同步帳號已變更');
      }
      this.revisionMetadata = revisions;
      this.history.set(buildCloudHistoryEntries(revisions));
    } catch (error) {
      if (!this.isCurrentOperation(operationVersion)) return;
      this.handleDriveError(error);
      throw error;
    }
  }

  async load(entry: CloudQuotationHistoryEntry): Promise<QuotationData> {
    const operationVersion = this.operationVersion;
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
      const data = revision.payload as unknown as QuotationData;
      this.history.update((entries) =>
        entries.map((item) =>
          item.revisionId === entry.revisionId ? { ...item, data } : item
        )
      );
      return data;
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.handleDriveError(error);
      }
      throw error;
    }
  }

  async save(
    data: QuotationData,
    existing?: CloudQuotationHistoryEntry
  ): Promise<CloudQuotationHistoryEntry> {
    const operationVersion = this.operationVersion;
    try {
      const ownerSub = this.requireConnectedOwner();
      const quotationId = existing?.quotationId ?? newIdentifier();
      const draft = createCloudQuotationDraft({
        ownerSub,
        quotationId,
        baseRevisionIds: existing?.headRevisionIds ?? [],
        payload: data,
        summary: createQuotationCloudSummary(data),
      });
      const operation = await createCloudSaveOperation(
        {
          draft,
          operationId: newIdentifier(),
          revisionId: newIdentifier(),
          kind: existing ? 'update' : 'create',
          createdAt: new Date().toISOString(),
        },
        this.hashProvider
      );
      this.assertCurrentOperation(operationVersion);
      const receipt = await this.api.createOperation(operation.revision);
      assertOperationReceipt(receipt, operation.revision);
      this.assertCurrentOperation(operationVersion);

      const entry: CloudQuotationHistoryEntry = {
        fileId: receipt.driveFileId,
        quotationId,
        revisionId: operation.revision.revisionId,
        headRevisionIds: Object.freeze([operation.revision.revisionId]),
        data,
      };
      this.history.update((entries) =>
        existing
          ? entries.map((item) =>
              item.quotationId === quotationId ? entry : item
            )
          : [entry, ...entries]
      );
      return entry;
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.handleDriveError(error);
      }
      throw error;
    }
  }

  /** 將本機歷史批次上傳到雲端；相同內容重複執行時會由固定 operationId 去重。 */
  async syncLocalHistory(
    localHistory: readonly QuotationData[]
  ): Promise<LocalHistorySyncResult> {
    const operationVersion = this.operationVersion;
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
      await this.reloadHistory(operationVersion);
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

      await this.reloadHistory(operationVersion);
      assertCurrent();
      return {
        uploaded,
        skipped: localHistory.length - uploaded,
      };
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.handleDriveError(error);
      }
      throw error;
    }
  }

  async delete(entry: CloudQuotationHistoryEntry): Promise<void> {
    const operationVersion = this.operationVersion;
    try {
      const ownerSub = this.requireConnectedOwner();
      const data = await this.load(entry);
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
    } catch (error) {
      if (this.isCurrentOperation(operationVersion)) {
        this.handleDriveError(error);
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

  private handleDriveError(error: unknown): void {
    if (!(error instanceof DriveAuthorizationRequiredError)) return;
    this.ownerSub = null;
    this.history.set([]);
    this.route.set(
      decideQuotationStorageRoute({
        isPremium: this.auth.isPremium(),
        isAdmin: this.auth.isAdmin(),
        isCloudSyncEnabled: this.isSyncEnabled(),
        driveConnection: 'reconnect-required',
      })
    );
  }

  private requireConnectedOwner(): string {
    if (!this.isCloudStorage() || !this.ownerSub)
      throw new Error('Google Drive 尚未連結');
    return this.ownerSub;
  }

  private isCurrentOperation(operationVersion: number): boolean {
    return operationVersion === this.operationVersion;
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
    this.isSyncEnabled.set(enabled);
    writeCloudSyncEnabledPreference(enabled);
  }
}
