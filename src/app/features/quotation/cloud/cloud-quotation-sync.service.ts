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
  DriveCloudApiService,
  type DriveConnectionState,
  type DriveOperationResponse,
} from './drive-cloud-api.service';

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

  readonly route = signal<QuotationStorageRoute>(
    decideQuotationStorageRoute({
      isPremium: false,
      driveConnection: 'not-connected',
    })
  );
  readonly history = signal<readonly CloudQuotationHistoryEntry[]>([]);
  readonly isAvailable = signal(true);
  readonly isCloudStorage = computed(
    () => this.route().repository === 'cloud-sync'
  );

  async initialize(): Promise<void> {
    this.history.set([]);
    this.ownerSub = null;
    if (!this.auth.isAuthenticated() || !this.auth.isPremium()) {
      this.route.set(
        decideQuotationStorageRoute({
          isPremium: false,
          driveConnection: 'not-connected',
        })
      );
      return;
    }

    try {
      const status = await this.api.getStatus();
      if (!isIdentifier(status.ownerSub)) throw new Error('雲端帳號識別無效');
      this.ownerSub = status.ownerSub;
      this.isAvailable.set(true);
      this.route.set(
        decideQuotationStorageRoute({
          isPremium: true,
          driveConnection: status.connected
            ? 'connected'
            : this.toRouteConnection(status.status),
        })
      );
      if (status.connected) await this.reloadHistory();
    } catch {
      // 尚未配置 Worker secret 時保持既有 localStorage；不顯示一個必定失敗的連線按鈕。
      this.isAvailable.set(false);
      this.route.set(
        decideQuotationStorageRoute({
          isPremium: true,
          driveConnection: 'not-connected',
        })
      );
    }
  }

  async beginConnect(): Promise<void> {
    const result = await this.api.beginConnect();
    const url = new URL(result.authorizationUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') {
      throw new Error('Google 授權網址無效');
    }
    window.location.assign(url.toString());
  }

  async reloadHistory(): Promise<void> {
    this.requireConnectedOwner();
    const revisions: DriveRevisionMetadata[] = [];
    const seenTokens = new Set<string>();
    let pageToken: string | undefined;
    do {
      const page = await this.api.listRevisions(pageToken);
      for (const value of page.files) {
        const metadata = readMetadata(value);
        if (metadata) revisions.push(metadata);
      }
      const next = page.nextPageToken;
      if (next !== null && (!next || seenTokens.has(next)))
        throw new Error('雲端歷史分頁游標無效');
      if (next) seenTokens.add(next);
      pageToken = next ?? undefined;
    } while (pageToken);
    this.history.set(buildCloudHistoryEntries(revisions));
  }

  async load(entry: CloudQuotationHistoryEntry): Promise<QuotationData> {
    const ownerSub = this.requireConnectedOwner();
    const revision = await verifyCloudQuotationEnvelope(
      await this.api.getRevision(entry.fileId),
      this.hashProvider
    );
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
  }

  async save(
    data: QuotationData,
    existing?: CloudQuotationHistoryEntry
  ): Promise<CloudQuotationHistoryEntry> {
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
    const receipt = await this.api.createOperation(operation.revision);
    assertOperationReceipt(receipt, operation.revision);

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
  }

  async delete(entry: CloudQuotationHistoryEntry): Promise<void> {
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
    const receipt = await this.api.createOperation(revision);
    assertOperationReceipt(receipt, revision);
    this.history.update((entries) =>
      entries.filter((item) => item.quotationId !== entry.quotationId)
    );
  }

  private toRouteConnection(
    status: DriveConnectionState
  ): 'not-connected' | 'reconnect-required' {
    return status === 'reauthorization_required'
      ? 'reconnect-required'
      : 'not-connected';
  }

  private requireConnectedOwner(): string {
    if (!this.isCloudStorage() || !this.ownerSub)
      throw new Error('Google Drive 尚未連結');
    return this.ownerSub;
  }
}
