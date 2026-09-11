import { Injectable, inject } from '@angular/core';
import { AuthService } from '@app/core/services/auth.service';
import { environment } from '../../../../environments/environment';
import type { CloudQuotationRevision } from './cloud-contracts';
import {
  DriveAuthorizationApiService,
  DriveAuthorizationBrokerError,
  type DriveAuthorizationBrokerFailure,
  type DriveAuthorizationGrant,
} from './drive-authorization-api.service';

export type DriveConnectionState =
  'connected' | 'disconnected' | 'reauthorization_required';

export interface DriveRevisionPageResponse {
  readonly files: readonly unknown[];
  readonly nextPageToken: string | null;
}

export interface DriveOperationResponse {
  readonly operationId: string;
  readonly quotationId: string;
  readonly revisionId: string;
  readonly driveFileId: string;
  readonly status: 'accepted' | 'replayed';
  readonly idempotent: boolean;
}

interface GoogleCodeResponse {
  readonly code?: string;
  readonly error?: string;
}

interface GoogleCodeClient {
  requestCode(): void;
}

interface GoogleIdentityApi {
  readonly accounts: {
    readonly oauth2: {
      initCodeClient(config: {
        readonly client_id: string;
        readonly scope: string;
        readonly ux_mode: 'popup';
        readonly hint?: string;
        readonly include_granted_scopes?: boolean;
        callback: (response: GoogleCodeResponse) => void;
        error_callback?: (error: { readonly type?: string }) => void;
      }): GoogleCodeClient;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
const DRIVE_SCOPE = 'openid email https://www.googleapis.com/auth/drive.appdata';
const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const DRIVE_APP_PROPERTY = 'price-quotation';
const MAX_REVISION_BYTES = 8 * 1024 * 1024;
const MULTIPART_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const TOKEN_EARLY_REFRESH_MS = 30_000;
const INTERACTIVE_AUTHORIZATION_TIMEOUT_MS = 60_000;
const GIS_LOAD_TIMEOUT_MS = 15_000;

export class DriveAuthorizationRequiredError extends Error {
  constructor(message = 'Google Drive 授權已失效，請重新連結') {
    super(message);
    this.name = 'DriveAuthorizationRequiredError';
  }
}

/** 可由同步協調層依 code 顯示安全且具體的雲端服務錯誤。 */
export class DriveServiceUnavailableError extends Error {
  constructor(
    readonly code:
      | Extract<DriveAuthorizationBrokerFailure, 'configuration' | 'temporarily_unavailable' | 'forbidden' | 'network' | 'invalid_response'>,
    readonly status: number | null,
    readonly safeMessage: string
  ) {
    super(safeMessage);
    this.name = 'DriveServiceUnavailableError';
  }
}

class DriveApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'DriveApiError';
  }
}

interface DriveFile {
  readonly appProperties?: Record<string, unknown>;
  readonly id?: unknown;
  readonly name?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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

function asStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (!entries.every(([, entry]) => typeof entry === 'string')) return null;
  return Object.fromEntries(entries) as Record<string, string>;
}

function quoteDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function truncateUtf8(value: string, maxBytes: number): string {
  const encoder = new TextEncoder();
  if (encoder.encode(value).byteLength <= maxBytes) return value;

  let result = '';
  for (const character of value) {
    if (encoder.encode(result + character).byteLength > maxBytes) break;
    result += character;
  }
  return result;
}

function quotationFileName(revision: CloudQuotationRevision<unknown>): string {
  const summary = revision.summary as unknown as Record<string, unknown>;
  const date =
    typeof summary['startDate'] === 'string' ? summary['startDate'].trim() : '';
  const customer =
    typeof summary['customerCompany'] === 'string'
      ? summary['customerCompany'].trim()
      : '';
  const title = `${date || revision.createdAt.slice(0, 10)} ${
    customer || '未命名報價單'
  }`
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return truncateUtf8(
    `報價單 ${title || '未命名報價單'} ${revision.revisionId}.json`,
    500
  );
}

function createMetadata(revision: CloudQuotationRevision<unknown>) {
  return {
    name: quotationFileName(revision),
    mimeType: 'application/json',
    parents: ['appDataFolder'],
    appProperties: {
      app: DRIVE_APP_PROPERTY,
      ownerSub: revision.ownerSub,
      schemaVersion: String(revision.schemaVersion),
      quotationId: revision.quotationId,
      revisionId: revision.revisionId,
      operationId: revision.operationId,
      kind: revision.kind,
      createdAt: revision.createdAt,
      contentHash: revision.contentHash,
      parentRevisionIds: JSON.stringify(revision.parentRevisionIds),
    },
  };
}

function parseRevisionMetadata(
  file: DriveFile
): Record<string, unknown> | null {
  if (!isIdentifier(file.id) || typeof file.name !== 'string') return null;
  const properties = asStringRecord(file.appProperties);
  if (
    !properties ||
    properties['app'] !== DRIVE_APP_PROPERTY ||
    !isIdentifier(properties['quotationId']) ||
    !isIdentifier(properties['revisionId']) ||
    !isIsoDate(properties['createdAt'])
  ) {
    return null;
  }
  const parentRevisionIds = safeParentRevisionIds(
    properties['parentRevisionIds']
  );
  if (!parentRevisionIds) return null;
  const kind = properties['kind'];
  if (
    kind !== 'create' &&
    kind !== 'update' &&
    kind !== 'delete' &&
    kind !== 'restore'
  ) {
    return null;
  }
  return {
    fileId: file.id,
    name: file.name,
    quotationId: properties['quotationId'],
    revisionId: properties['revisionId'],
    parentRevisionIds,
    kind,
    createdAt: properties['createdAt'],
  };
}

function safeParentRevisionIds(
  value: string | undefined
): readonly string[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every(isIdentifier)) return null;
    return Object.freeze([...parsed]);
  } catch {
    return null;
  }
}

function isSameOperation(
  file: DriveFile,
  revision: CloudQuotationRevision<unknown>
): boolean {
  const properties = asStringRecord(file.appProperties);
  return (
    properties?.['app'] === DRIVE_APP_PROPERTY &&
    properties['ownerSub'] === revision.ownerSub &&
    properties['operationId'] === revision.operationId &&
    properties['quotationId'] === revision.quotationId &&
    properties['revisionId'] === revision.revisionId &&
    properties['contentHash'] === revision.contentHash &&
    properties['kind'] === revision.kind &&
    properties['createdAt'] === revision.createdAt &&
    properties['parentRevisionIds'] ===
      JSON.stringify(revision.parentRevisionIds)
  );
}

/**
 * 瀏覽器直接透過 Drive REST API 存取 appDataFolder。短效 access token 只保留在
 * 記憶體；後端只保存加密的續期憑證，broker 完全不接收報價單內容。
 */
@Injectable({ providedIn: 'root' })
export class DriveCloudApiService {
  private readonly authorizationApi = inject(DriveAuthorizationApiService);
  private readonly auth = inject(AuthService);
  private gisPromise: Promise<void> | null = null;
  private interactiveRequest: Promise<void> | null = null;
  private refreshRequest: Promise<string> | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private connectedEmail: string | null = null;
  private connectedOwnerId: string | null = null;
  private authorizationVersion = 0;

  isConfigured(): boolean {
    return /\.apps\.googleusercontent\.com$/.test(environment.googleClientId);
  }

  async beginConnect(expectedEmail: string): Promise<void> {
    const email = this.normalizeExpectedEmail(expectedEmail);
    // GIS 一次只能安全管理一個 popup；重複點擊沿用同一個流程。
    if (this.interactiveRequest) return this.interactiveRequest;
    this.disconnect();
    const authorizationVersion = this.authorizationVersion;
    const ownerId = this.currentOwnerId();
    const request = this.requestAuthorizationCode(
      email,
      ownerId,
      authorizationVersion
    );
    this.interactiveRequest = request;
    void request.finally(() => {
      if (this.interactiveRequest === request) this.interactiveRequest = null;
    }).catch(() => undefined);
    return request;
  }

  /**
   * token 僅存在記憶體。重新整理後向受保護的 broker 取短效 token，
   * 不會呼叫 GIS 或開啟授權視窗。
   */
  async restoreConnection(expectedEmail: string): Promise<boolean> {
    const email = this.normalizeExpectedEmail(expectedEmail);
    const ownerId = this.currentOwnerId();
    if (
      this.connectedEmail === email &&
      this.connectedOwnerId === ownerId &&
      this.hasValidAccessToken()
    ) {
      return true;
    }
    const authorizationVersion = this.authorizationVersion;
    try {
      const grant = await this.authorizationApi.token();
      this.acceptGrant(grant, email, ownerId, authorizationVersion);
      return true;
    } catch (error) {
      if (this.isReauthorizationError(error)) {
        this.assertCurrentSession(ownerId, authorizationVersion);
        this.clearConnection();
        if (
          error instanceof DriveAuthorizationBrokerError &&
          error.failure === 'scope_not_granted'
        ) {
          throw new DriveAuthorizationRequiredError(error.safeMessage);
        }
        return false;
      }
      if (
        error instanceof DriveAuthorizationBrokerError &&
        error.failure === 'forbidden'
      ) {
        this.assertCurrentSession(ownerId, authorizationVersion);
        this.clearAccessToken();
      }
      throw this.toSafeBrokerError(error);
    }
  }

  disconnect(): void {
    ++this.authorizationVersion;
    this.refreshRequest = null;
    this.clearConnection();
  }

  async listRevisions(
    ownerSub: string,
    pageToken?: string
  ): Promise<DriveRevisionPageResponse> {
    const url = new URL(`${DRIVE_API_BASE}/files`);
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set('pageSize', '100');
    url.searchParams.set(
      'fields',
      'nextPageToken,files(id,name,appProperties)'
    );
    url.searchParams.set(
      'q',
      `trashed = false and appProperties has { key='app' and value='${quoteDriveQueryValue(
        DRIVE_APP_PROPERTY
      )}' } and appProperties has { key='ownerSub' and value='${quoteDriveQueryValue(
        ownerSub
      )}' }`
    );
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await this.fetchAuthorized(url);
    const body = await this.readJson(response);
    if (!isRecord(body) || !Array.isArray(body['files'])) {
      throw new DriveApiError(response.status, 'Google Drive 清單回應無效');
    }
    const nextPageToken = body['nextPageToken'];
    if (nextPageToken !== undefined && typeof nextPageToken !== 'string') {
      throw new DriveApiError(response.status, 'Google Drive 分頁游標無效');
    }
    return {
      files: body['files']
        .filter(isRecord)
        .map(parseRevisionMetadata)
        .filter(
          (metadata): metadata is Record<string, unknown> => metadata !== null
        ),
      nextPageToken: nextPageToken ?? null,
    };
  }

  async getRevision(fileId: string): Promise<unknown> {
    if (!isIdentifier(fileId)) throw new Error('Google Drive 檔案識別無效');
    const url = new URL(
      `${DRIVE_API_BASE}/files/${encodeURIComponent(fileId)}`
    );
    url.searchParams.set('alt', 'media');
    const response = await this.fetchAuthorized(url);
    return await this.readRevisionJson(response);
  }

  async createOperation(
    revision: CloudQuotationRevision<unknown>
  ): Promise<DriveOperationResponse> {
    this.assertRevision(revision);
    const existing = await this.findByOperation(
      revision.ownerSub,
      revision.operationId
    );
    if (existing) {
      if (!isSameOperation(existing, revision) || !isIdentifier(existing.id)) {
        throw new Error('Google Drive 已有同名操作，但內容不一致');
      }
      return this.toOperationReceipt(existing.id, revision, 'replayed');
    }

    const content = JSON.stringify(revision);
    const bytes = new TextEncoder().encode(content).byteLength;
    if (bytes > MAX_REVISION_BYTES) {
      throw new Error('報價單內容超過 8 MB，無法儲存到 Google Drive');
    }
    const metadata = createMetadata(revision);
    const file =
      bytes <= MULTIPART_UPLOAD_MAX_BYTES
        ? await this.multipartUpload(metadata, content)
        : await this.resumableUpload(metadata, content, bytes);
    if (!isIdentifier(file.id)) {
      throw new Error('Google Drive 未回傳新檔案識別');
    }
    return this.toOperationReceipt(file.id, revision, 'accepted');
  }

  private async findByOperation(
    ownerSub: string,
    operationId: string
  ): Promise<DriveFile | null> {
    const url = new URL(`${DRIVE_API_BASE}/files`);
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set('pageSize', '2');
    url.searchParams.set('fields', 'files(id,name,appProperties)');
    url.searchParams.set(
      'q',
      `trashed = false and appProperties has { key='app' and value='${quoteDriveQueryValue(
        DRIVE_APP_PROPERTY
      )}' } and appProperties has { key='ownerSub' and value='${quoteDriveQueryValue(
        ownerSub
      )}' } and appProperties has { key='operationId' and value='${quoteDriveQueryValue(
        operationId
      )}' }`
    );
    const response = await this.fetchAuthorized(url);
    const body = await this.readJson(response);
    if (!isRecord(body) || !Array.isArray(body['files'])) {
      throw new DriveApiError(response.status, 'Google Drive 操作查詢回應無效');
    }
    if (body['files'].length > 1) {
      throw new Error('Google Drive 偵測到重複操作');
    }
    const file = body['files'][0];
    return isRecord(file) ? (file as DriveFile) : null;
  }

  private async multipartUpload(
    metadata: ReturnType<typeof createMetadata>,
    content: string
  ): Promise<DriveFile> {
    const boundary = `price-quotation-${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\n`,
      'Content-Type: application/json\r\n\r\n',
      content,
      `\r\n--${boundary}--`,
    ]);
    const url = new URL(DRIVE_UPLOAD_URL);
    url.searchParams.set('uploadType', 'multipart');
    url.searchParams.set('fields', 'id,name,appProperties');
    const response = await this.fetchAuthorized(url, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    const parsed = await this.readJson(response);
    if (!isRecord(parsed)) throw new Error('Google Drive 上傳回應無效');
    return parsed as DriveFile;
  }

  private async resumableUpload(
    metadata: ReturnType<typeof createMetadata>,
    content: string,
    byteLength: number,
    retryAttempt = 0
  ): Promise<DriveFile> {
    const url = new URL(DRIVE_UPLOAD_URL);
    url.searchParams.set('uploadType', 'resumable');
    url.searchParams.set('fields', 'id,name,appProperties');
    const initiated = await this.fetchAuthorized(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': 'application/json',
        'X-Upload-Content-Length': String(byteLength),
      },
      body: JSON.stringify(metadata),
    });
    const sessionUrl = initiated.headers.get('Location');
    if (!sessionUrl) throw new Error('Google Drive 未建立可續傳上傳工作階段');

    const response = await fetch(sessionUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: content,
    });
    if (response.status === 401) {
      this.clearAccessToken();
      if (retryAttempt === 0) {
        await this.getAccessToken();
        // 401 的續傳工作階段不會寫入檔案；重新建立階段後才重送內容。
        return this.resumableUpload(metadata, content, byteLength, 1);
      }
      this.clearConnection();
      throw new DriveAuthorizationRequiredError();
    }
    if (!response.ok) {
      throw new DriveApiError(response.status, 'Google Drive 大型檔案上傳失敗');
    }
    const parsed = await this.readJson(response);
    if (!isRecord(parsed)) throw new Error('Google Drive 上傳回應無效');
    return parsed as DriveFile;
  }

  private toOperationReceipt(
    driveFileId: string,
    revision: CloudQuotationRevision<unknown>,
    status: 'accepted' | 'replayed'
  ): DriveOperationResponse {
    return {
      operationId: revision.operationId,
      quotationId: revision.quotationId,
      revisionId: revision.revisionId,
      driveFileId,
      status,
      idempotent: status === 'replayed',
    };
  }

  private assertRevision(revision: CloudQuotationRevision<unknown>): void {
    if (
      !isIdentifier(revision.ownerSub) ||
      !isIdentifier(revision.quotationId) ||
      !isIdentifier(revision.revisionId) ||
      !isIdentifier(revision.operationId) ||
      !isIsoDate(revision.createdAt)
    ) {
      throw new Error('報價單雲端修訂格式無效');
    }
    const parentBytes = new TextEncoder().encode(
      JSON.stringify(revision.parentRevisionIds)
    ).byteLength;
    if (parentBytes > 100) {
      throw new Error('報價單版本分支過多，請將其中一版另存為新報價單');
    }
  }

  private async fetchAuthorized(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const authorizationVersion = this.authorizationVersion;
    const token = await this.getAccessToken();
    this.assertCurrentAuthorization(authorizationVersion);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(input, { ...init, headers });
    this.assertCurrentAuthorization(authorizationVersion);
    if (response.status === 401) {
      this.clearAccessToken();
      const refreshedToken = await this.getAccessToken();
      this.assertCurrentAuthorization(authorizationVersion);
      const retryHeaders = new Headers(init?.headers);
      retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
      const retry = await fetch(input, { ...init, headers: retryHeaders });
      this.assertCurrentAuthorization(authorizationVersion);
      if (retry.status === 401) {
        this.clearConnection();
        throw new DriveAuthorizationRequiredError();
      }
      if (!retry.ok) {
        throw new DriveApiError(
          retry.status,
          await this.readApiErrorMessage(retry)
        );
      }
      return retry;
    }
    if (!response.ok) {
      throw new DriveApiError(
        response.status,
        await this.readApiErrorMessage(response)
      );
    }
    return response;
  }

  private async readApiErrorMessage(response: Response): Promise<string> {
    const prefix = `Google Drive 請求失敗（HTTP ${response.status}）`;
    try {
      const body = await response.json();
      if (
        isRecord(body) &&
        isRecord(body['error']) &&
        typeof body['error']['message'] === 'string'
      ) {
        return `${prefix}：${body['error']['message']}`;
      }
    } catch {
      // 回應不是 JSON 時保留 HTTP 狀態，避免吞掉原始原因。
    }
    return prefix;
  }

  private async getAccessToken(): Promise<string> {
    if (this.hasValidAccessToken()) {
      return this.accessToken!;
    }
    this.clearAccessToken();
    return this.refreshAccessToken();
  }

  private refreshAccessToken(): Promise<string> {
    if (this.refreshRequest) return this.refreshRequest;
    const authorizationVersion = this.authorizationVersion;
    const expectedEmail = this.connectedEmail;
    const expectedOwnerId = this.connectedOwnerId;
    if (!expectedEmail || !expectedOwnerId) {
      throw new DriveAuthorizationRequiredError();
    }
    const request = this.authorizationApi.token().then(
      (grant) => {
        this.acceptGrant(
          grant,
          expectedEmail,
          expectedOwnerId,
          authorizationVersion
        );
        return this.accessToken!;
      },
      (error) => {
        if (this.isReauthorizationError(error)) {
          this.assertCurrentSession(expectedOwnerId, authorizationVersion);
          this.clearConnection();
          throw new DriveAuthorizationRequiredError();
        }
        if (
          error instanceof DriveAuthorizationBrokerError &&
          error.failure === 'forbidden'
        ) {
          this.assertCurrentSession(expectedOwnerId, authorizationVersion);
          this.clearAccessToken();
        }
        throw this.toSafeBrokerError(error);
      }
    );
    this.refreshRequest = request;
    void request.finally(() => {
      if (this.refreshRequest === request) this.refreshRequest = null;
    }).catch(() => undefined);
    return request;
  }

  private hasValidAccessToken(): boolean {
    return !!this.accessToken &&
      Date.now() + TOKEN_EARLY_REFRESH_MS < this.tokenExpiresAt;
  }

  private async requestAuthorizationCode(
    expectedEmail: string,
    expectedOwnerId: string,
    authorizationVersion: number
  ): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error('Google Drive Client ID 尚未設定');
    }
    await this.loadGis();
    this.assertCurrentSession(expectedOwnerId, authorizationVersion);
    const google = window.google;
    if (!google?.accounts.oauth2) {
      throw new Error('Google Identity Services 未正確載入');
    }
    await new Promise<void>((resolve, reject) => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      };
      const succeed = (): void => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve();
      };
      const client = google.accounts.oauth2.initCodeClient({
        client_id: environment.googleClientId,
        scope: DRIVE_SCOPE,
        ux_mode: 'popup',
        hint: expectedEmail,
        include_granted_scopes: true,
        callback: (response) => {
          if (settled) return;
          if (authorizationVersion !== this.authorizationVersion) {
            fail(
              new DriveAuthorizationRequiredError('Google Drive 連線已取消')
            );
            return;
          }
          if (!response.code) {
            fail(
              new DriveAuthorizationRequiredError(
                'Google Drive 授權已取消，請重新連結'
              )
            );
            return;
          }
          void this.authorizationApi.connect(response.code).then(
            (grant) => {
              try {
                this.acceptGrant(
                  grant,
                  expectedEmail,
                  expectedOwnerId,
                  authorizationVersion
                );
                succeed();
              } catch (error) {
                fail(error instanceof Error ? error : new Error('Google Drive 授權流程失敗'));
              }
            },
            (error) => fail(this.toSafeBrokerError(error))
          );
        },
        error_callback: (error) => {
          if (authorizationVersion !== this.authorizationVersion) {
            fail(
              new DriveAuthorizationRequiredError('Google Drive 連線已取消')
            );
            return;
          }
          fail(
            new DriveAuthorizationRequiredError(
              error.type === 'popup_failed_to_open'
                ? 'Google Drive 授權視窗無法開啟，請允許此網站的彈出視窗'
                : error.type === 'popup_closed'
                  ? 'Google Drive 授權視窗已關閉'
                  : 'Google Drive 授權流程失敗'
            )
          );
        },
      });
      timeoutId = setTimeout(
        () =>
          fail(
            new DriveAuthorizationRequiredError(
              'Google Drive 授權逾時'
            )
          ),
        INTERACTIVE_AUTHORIZATION_TIMEOUT_MS
      );
      client.requestCode();
    });
  }

  private loadGis(): Promise<void> {
    if (window.google?.accounts.oauth2) return Promise.resolve();
    if (this.gisPromise) return this.gisPromise;
    this.gisPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const finish = (callback: () => void): void => {
        if (timeoutId) clearTimeout(timeoutId);
        callback();
      };
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => finish(resolve);
      script.onerror = () =>
        finish(() => reject(new Error('Google Identity Services 載入失敗')));
      timeoutId = setTimeout(
        () => finish(() => reject(new Error('Google Identity Services 載入逾時'))),
        GIS_LOAD_TIMEOUT_MS
      );
      document.head.appendChild(script);
    });
    void this.gisPromise.catch(() => {
      this.gisPromise = null;
    });
    return this.gisPromise;
  }

  private clearAccessToken(): void {
    this.accessToken = null;
    this.tokenExpiresAt = 0;
  }

  private clearConnection(): void {
    this.connectedEmail = null;
    this.connectedOwnerId = null;
    this.clearAccessToken();
  }

  private currentOwnerId(): string {
    const ownerId = this.auth.userId();
    if (!ownerId) {
      throw new DriveAuthorizationRequiredError('會員登入狀態已失效');
    }
    return ownerId;
  }

  private acceptGrant(
    grant: DriveAuthorizationGrant,
    expectedEmail: string,
    expectedOwnerId: string,
    authorizationVersion: number
  ): void {
    this.assertCurrentAuthorization(authorizationVersion);
    if (this.currentOwnerId() !== expectedOwnerId) {
      throw new DriveAuthorizationRequiredError('會員帳號已變更');
    }
    // email 是 GIS 帳號選擇的 hint；會員 uid 才是後端已驗證的安全主鍵。
    // 使用者更換 Google 帳號信箱時，舊授權仍可由同一 uid 安全地續期。
    this.normalizeExpectedEmail(grant.email);
    if (grant.ownerId !== expectedOwnerId) {
      this.clearConnection();
      throw new DriveAuthorizationRequiredError(
        'Google Drive 授權與目前會員不一致，請重新連結'
      );
    }
    this.accessToken = grant.accessToken;
    this.tokenExpiresAt = Date.now() + grant.expiresIn * 1000;
    this.connectedEmail = expectedEmail;
    this.connectedOwnerId = expectedOwnerId;
  }

  private isReauthorizationError(error: unknown): boolean {
    return (
      error instanceof DriveAuthorizationBrokerError &&
      error.requiresReauthorization
    );
  }

  private toSafeBrokerError(error: unknown): Error {
    if (error instanceof DriveAuthorizationRequiredError) return error;
    if (error instanceof DriveAuthorizationBrokerError) {
      if (error.requiresReauthorization) {
        return new DriveAuthorizationRequiredError(error.safeMessage);
      }
      return new DriveServiceUnavailableError(
        error.failure as DriveServiceUnavailableError['code'],
        error.status,
        error.safeMessage
      );
    }
    return new DriveServiceUnavailableError(
      'network',
      null,
      '雲端授權服務暫時無法連線，請稍後再試'
    );
  }

  private normalizeExpectedEmail(email: string): string {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new Error('會員 Google 帳號電子郵件無效');
    }
    return normalized;
  }

  private assertCurrentAuthorization(authorizationVersion: number): void {
    if (authorizationVersion !== this.authorizationVersion) {
      throw new DriveAuthorizationRequiredError('Google Drive 連線已取消');
    }
  }

  private assertCurrentSession(
    expectedOwnerId: string,
    authorizationVersion: number
  ): void {
    this.assertCurrentAuthorization(authorizationVersion);
    if (this.currentOwnerId() !== expectedOwnerId) {
      throw new DriveAuthorizationRequiredError('會員帳號已變更');
    }
  }

  private async readJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new DriveApiError(
        response.status,
        'Google Drive 回應不是有效 JSON'
      );
    }
  }

  /**
   * 清單只取 metadata；實際 payload 則再次套用寫入端相同的 8 MB 上限。
   * 即使使用者自行建立了帶有本應用 appProperties 的大檔，也不讓瀏覽器無限制
   * 讀入記憶體。
   */
  private async readRevisionJson(response: Response): Promise<unknown> {
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_REVISION_BYTES) {
      throw new Error('Google Drive 報價單內容超過 8 MB，無法讀取');
    }
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_REVISION_BYTES) {
      throw new Error('Google Drive 報價單內容超過 8 MB，無法讀取');
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new DriveApiError(
        response.status,
        'Google Drive 報價單不是有效 JSON'
      );
    }
  }
}
