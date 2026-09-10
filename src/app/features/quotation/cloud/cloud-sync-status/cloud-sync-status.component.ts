import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import type { CloudSyncStatus } from '../cloud-quotation-sync.service';

export interface CloudSyncStatusPresentation {
  readonly text: string;
  readonly canReconnect: boolean;
}

export function presentCloudSyncStatus(
  status: CloudSyncStatus,
  lastSyncedAt: number | null
): CloudSyncStatusPresentation {
  switch (status) {
    case 'connecting':
      return { text: '連線中', canReconnect: false };
    case 'syncing':
      return { text: '同步中', canReconnect: false };
    case 'synced':
      return {
        text: lastSyncedAt
          ? `已同步 ${new Intl.DateTimeFormat('zh-TW', {
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(lastSyncedAt)}`
          : '已同步',
        canReconnect: false,
      };
    case 'error':
      return { text: '同步失敗', canReconnect: false };
    case 'reconnect':
      return { text: '需要重新連線', canReconnect: true };
    default:
      return { text: '本機儲存', canReconnect: false };
  }
}

@Component({
  selector: 'app-cloud-sync-status',
  standalone: true,
  templateUrl: './cloud-sync-status.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CloudSyncStatusComponent {
  readonly status = input.required<CloudSyncStatus>();
  readonly lastSyncedAt = input<number | null>(null);
  readonly errorMessage = input<string | null>(null);
  readonly reconnect = output<void>();

  readonly presentation = computed(() =>
    presentCloudSyncStatus(this.status(), this.lastSyncedAt())
  );

  requestReconnect(): void {
    this.reconnect.emit();
  }
}
