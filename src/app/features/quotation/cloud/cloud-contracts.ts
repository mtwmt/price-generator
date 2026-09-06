import { QuotationData } from '@app/features/quotation/models/quotation.model';

export const CLOUD_SCHEMA_VERSION = 1 as const;
export type CloudSchemaVersion = typeof CLOUD_SCHEMA_VERSION;

export type CloudQuotationKind = 'create' | 'update' | 'delete' | 'restore';

/** 清單摘要刻意不含 base64 圖片，避免列舉時下載完整內容。 */
export interface CloudQuotationSummary {
  readonly customerCompany: string;
  readonly quoterName: string;
  readonly startDate: string;
  readonly endDate?: string;
  readonly serviceItemCount: number;
  readonly excludingTax: number;
  readonly includingTax: number;
}

/** 修訂封套的共同欄位；contentHash 由雜湊 provider 產生，不由呼叫端自行填值。 */
export interface CloudRevisionContent<TPayload = QuotationData | null> {
  readonly schemaVersion: CloudSchemaVersion;
  readonly quotationId: string;
  readonly revisionId: string;
  readonly parentRevisionIds: readonly string[];
  readonly operationId: string;
  readonly ownerSub: string;
  readonly kind: CloudQuotationKind;
  readonly payload: TPayload;
  readonly summary: CloudQuotationSummary;
  readonly createdAt: string;
}

export interface CloudQuotationRevision<
  TPayload = QuotationData | null,
> extends CloudRevisionContent<TPayload> {
  readonly contentHash: string;
  /**
   * Drive 實體檔案識別僅是傳輸 metadata，不能參與內容雜湊或冪等內容比較。
   * 同一次操作重試可能產生多個實體檔案，仍須折疊成同一邏輯修訂。
   */
  readonly driveFileId?: string;
}

declare const VERIFIED_CLOUD_REVISION: unique symbol;

/**
 * 只有 create 或完整 validate-and-verify 流程可產生此品牌。
 * 執行期仍由 cloud-domain 的 provenance guard 驗證，不能只靠型別斷言。
 */
export type VerifiedCloudQuotationRevision<TPayload = QuotationData | null> =
  CloudQuotationRevision<TPayload> & {
    readonly [VERIFIED_CLOUD_REVISION]: true;
  };

/** 建立修訂時的輸入；schemaVersion 明確傳入，未知版本不得寫入。 */
export type CloudQuotationRevisionInput<TPayload = QuotationData | null> =
  CloudRevisionContent<TPayload>;

/** contentHash 排除自身，避免雜湊輸入遞迴。 */
export interface CloudRevisionHashDocument {
  readonly schemaVersion: CloudSchemaVersion;
  readonly quotationId: string;
  readonly revisionId: string;
  readonly parentRevisionIds: readonly string[];
  readonly operationId: string;
  readonly ownerSub: string;
  readonly kind: CloudQuotationKind;
  readonly payload: import('./cloud-json').JsonValue;
  readonly summary: CloudQuotationSummary;
  readonly createdAt: string;
}

/** 後續 IndexedDB／Worker 可實作的唯讀契約；持久化 sink 刻意不放在公開型別。 */
export interface CloudQuotationRevisionReader<TPayload = QuotationData | null> {
  findByOperation(
    ownerSub: string,
    operationId: string
  ): Promise<CloudQuotationRevision<TPayload> | null>;
  findByRevision(
    ownerSub: string,
    revisionId: string
  ): Promise<CloudQuotationRevision<TPayload> | null>;
}

/**
 * 純同步核心唯一的公開 revision 寫入 API。
 * 實作必須在此方法內做 runtime provenance guard，再觸及內部 persistence sink。
 */
export interface CloudQuotationRevisionWriter {
  appendRevision(value: unknown): Promise<void>;
}

/** 後續傳輸層可回報接受或冪等重播，不在本切片實作外部同步。 */
export interface CloudQuotationOperationReceipt {
  readonly operationId: string;
  readonly revisionId: string;
  readonly status: 'accepted' | 'replayed';
}

/**
 * 編輯開始時鎖定的本機草稿。baseRevisionIds 只會由明確儲存建立的後繼草稿推進，
 * 不可因讀到較新的遠端修訂而自動改寫。
 */
export interface CloudQuotationDraft<TPayload = QuotationData> {
  readonly ownerSub: string;
  readonly quotationId: string;
  readonly baseRevisionIds: readonly string[];
  readonly payload: TPayload;
  readonly summary: CloudQuotationSummary;
}

/**
 * 本機待送操作。retryAttempt 只代表傳輸嘗試次數，revision 的固定內容永遠不變。
 */
export interface CloudQuotationOperation<TPayload = QuotationData> {
  readonly revision: CloudQuotationRevision<TPayload>;
  readonly retryAttempt: number;
}

/**
 * 未來 IndexedDB adapter 的最小契約；本切片不實作瀏覽器資料庫。
 * saveDraftAndOperation 必須由 adapter 以單一資料庫交易提交，避免草稿與待送操作分離。
 */
export interface CloudSyncLocalStore<TPayload = QuotationData> {
  loadDraft(
    ownerSub: string,
    quotationId: string
  ): Promise<CloudQuotationDraft<TPayload> | null>;
  saveDraftAndOperation(
    draft: CloudQuotationDraft<TPayload>,
    operation: CloudQuotationOperation<TPayload>
  ): Promise<void>;
  listPendingOperations(
    ownerSub: string
  ): Promise<readonly CloudQuotationOperation<TPayload>[]>;
  markOperationSynced(ownerSub: string, operationId: string): Promise<void>;
}
