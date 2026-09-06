import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';

export type DriveConnectionState =
  'connected' | 'disconnected' | 'reauthorization_required';

export interface DriveStatusResponse {
  readonly connected: boolean;
  readonly status: DriveConnectionState;
  readonly scopes: readonly string[];
  /** 與 Worker 端一致的 Google subject，只會回傳給已驗證的當前會員。 */
  readonly ownerSub: string;
}

export interface DriveConnectResponse {
  readonly authorizationUrl: string;
  readonly expiresAt: number;
}

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

/** 僅處理 HTTP 傳輸；Bearer 與 platform header 由既有 interceptor 附加。 */
@Injectable({ providedIn: 'root' })
export class DriveCloudApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.portalApiUrl}/api`;

  getStatus(): Promise<DriveStatusResponse> {
    return firstValueFrom(
      this.http.get<DriveStatusResponse>(`${this.apiUrl}/drive/status`)
    );
  }

  beginConnect(): Promise<DriveConnectResponse> {
    return firstValueFrom(
      this.http.post<DriveConnectResponse>(`${this.apiUrl}/drive/connect`, {})
    );
  }

  listRevisions(pageToken?: string): Promise<DriveRevisionPageResponse> {
    const params: Record<string, string> = { pageSize: '100' };
    if (pageToken) params['pageToken'] = pageToken;
    return firstValueFrom(
      this.http.get<DriveRevisionPageResponse>(
        `${this.apiUrl}/cloud/quotation-revisions`,
        { params }
      )
    );
  }

  getRevision(fileId: string): Promise<unknown> {
    return firstValueFrom(
      this.http.get<unknown>(
        `${this.apiUrl}/cloud/quotation-revisions/${encodeURIComponent(fileId)}`
      )
    );
  }

  createOperation(operation: unknown): Promise<DriveOperationResponse> {
    return firstValueFrom(
      this.http.post<DriveOperationResponse>(
        `${this.apiUrl}/cloud/quotation-operations`,
        operation
      )
    );
  }
}
