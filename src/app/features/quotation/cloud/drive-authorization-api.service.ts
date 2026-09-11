import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type DriveAuthorizationBrokerFailure =
  | 'not_connected'
  | 'reauthorization_required'
  | 'account_mismatch'
  | 'scope_not_granted'
  | 'configuration'
  | 'temporarily_unavailable'
  | 'forbidden'
  | 'network'
  | 'invalid_response';

/** 後端授權 broker 的可安全顯示錯誤；不包含伺服器原始訊息。 */
export class DriveAuthorizationBrokerError extends Error {
  constructor(
    readonly failure: DriveAuthorizationBrokerFailure,
    readonly status: number | null,
    readonly safeMessage: string
  ) {
    super(safeMessage);
    this.name = 'DriveAuthorizationBrokerError';
  }

  get requiresReauthorization(): boolean {
    return (
      this.failure === 'not_connected' ||
      this.failure === 'reauthorization_required' ||
      this.failure === 'account_mismatch' ||
      this.failure === 'scope_not_granted'
    );
  }
}

export interface DriveAuthorizationGrant {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly email: string;
  readonly ownerId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseGrant(value: unknown): DriveAuthorizationGrant {
  if (
    !isRecord(value) ||
    typeof value['accessToken'] !== 'string' ||
    !value['accessToken'].trim() ||
    typeof value['expiresIn'] !== 'number' ||
    !Number.isFinite(value['expiresIn']) ||
    value['expiresIn'] <= 0 ||
    typeof value['email'] !== 'string' ||
    !value['email'].trim() ||
    typeof value['ownerId'] !== 'string' ||
    !value['ownerId'].trim()
  ) {
    throw new DriveAuthorizationBrokerError(
      'invalid_response',
      200,
      '雲端授權服務回應無效，請稍後再試'
    );
  }
  return {
    accessToken: value['accessToken'],
    expiresIn: value['expiresIn'],
    email: value['email'],
    ownerId: value['ownerId'],
  };
}

function toBrokerError(error: unknown): DriveAuthorizationBrokerError {
  if (error instanceof DriveAuthorizationBrokerError) return error;
  if (!(error instanceof HttpErrorResponse)) {
    return new DriveAuthorizationBrokerError(
      'network',
      null,
      '雲端授權服務暫時無法連線，請稍後再試'
    );
  }
  const errorCode = isRecord(error.error) ? error.error['error'] : undefined;
  if (
    error.status === 409 &&
    (errorCode === 'drive_not_connected' ||
      errorCode === 'drive_reauthorization_required' ||
      errorCode === 'drive_account_mismatch')
  ) {
    const failure =
      errorCode === 'drive_not_connected'
        ? 'not_connected'
        : errorCode === 'drive_account_mismatch'
          ? 'account_mismatch'
          : 'reauthorization_required';
    return new DriveAuthorizationBrokerError(
      failure,
      error.status,
      'Google Drive 授權已失效，請重新連結'
    );
  }
  if (error.status === 503 && errorCode === 'drive_configuration_error') {
    return new DriveAuthorizationBrokerError(
      'configuration',
      error.status,
      '雲端服務尚未設定完成，請稍後再試'
    );
  }
  if (error.status === 503 && errorCode === 'drive_temporarily_unavailable') {
    return new DriveAuthorizationBrokerError(
      'temporarily_unavailable',
      error.status,
      '雲端授權服務暫時無法使用，請稍後再試'
    );
  }
  if (error.status === 403 && errorCode === 'drive_forbidden') {
    return new DriveAuthorizationBrokerError(
      'forbidden',
      error.status,
      '目前帳號無法使用雲端同步'
    );
  }
  if (error.status === 403 && errorCode === 'drive_scope_not_granted') {
    return new DriveAuthorizationBrokerError(
      'scope_not_granted',
      error.status,
      '請允許 Google Drive 存取權限後重新連線'
    );
  }
  return new DriveAuthorizationBrokerError(
    error.status === 0 ? 'network' : 'temporarily_unavailable',
    error.status || null,
    '雲端授權服務暫時無法使用，請稍後再試'
  );
}

@Injectable({ providedIn: 'root' })
export class DriveAuthorizationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.portalApiUrl}/api/drive-auth`;
  private readonly options = {
    headers: new HttpHeaders({ 'X-Requested-With': 'XMLHttpRequest' }),
  };

  async connect(code: string): Promise<DriveAuthorizationGrant> {
    if (!code.trim()) {
      throw new DriveAuthorizationBrokerError(
        'invalid_response',
        null,
        'Google Drive 授權流程失敗，請重新連結'
      );
    }
    return this.post('/connect', { code });
  }

  async token(): Promise<DriveAuthorizationGrant> {
    return this.post('/token', {});
  }

  private async post(path: string, body: Record<string, string>): Promise<DriveAuthorizationGrant> {
    try {
      return parseGrant(
        await firstValueFrom(this.http.post<unknown>(`${this.baseUrl}${path}`, body, this.options))
      );
    } catch (error) {
      throw toBrokerError(error);
    }
  }
}
