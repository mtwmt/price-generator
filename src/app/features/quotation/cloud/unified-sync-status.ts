import type { CloudSyncStatus } from './cloud-quotation-sync.service';
import type { TemplateSyncStatus } from './cloud-template-sync.service';

export type UnifiedCloudSyncStatus = CloudSyncStatus | 'waiting' | 'conflict';

/** One user-visible result: success requires every synchronized resource. */
export function combineCloudSyncStatus(
  quotations: CloudSyncStatus,
  templates: TemplateSyncStatus,
  enabled: boolean
): UnifiedCloudSyncStatus {
  if (!enabled) return quotations;
  if (quotations === 'reconnect') return 'reconnect';
  // Templates await the shared connection; that alone is not expired consent.
  if (quotations === 'connecting') return 'connecting';
  if (templates === 'reconnect') return 'reconnect';
  if (quotations === 'error' || templates === 'error') return 'error';
  if (quotations === 'syncing' || templates === 'syncing') return 'syncing';
  if (templates === 'conflict') return 'conflict';
  return quotations === 'synced' && templates === 'synced' ? 'synced' : 'waiting';
}
