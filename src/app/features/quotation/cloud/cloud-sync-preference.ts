export const CLOUD_SYNC_ENABLED_PREFERENCE_KEY =
  'price-generator:cloud-sync-enabled';

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CloudSyncInitializationInput {
  readonly isAuthenticated: boolean;
  readonly isEligible: boolean;
  readonly isSyncEnabled: boolean;
}

export type CloudSyncInitializationAction = 'disconnect' | 'reconnect';

function getLocalStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readCloudSyncEnabledPreference(
  storage = getLocalStorage()
): boolean {
  try {
    return storage?.getItem(CLOUD_SYNC_ENABLED_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeCloudSyncEnabledPreference(
  enabled: boolean,
  storage = getLocalStorage()
): void {
  try {
    storage?.setItem(CLOUD_SYNC_ENABLED_PREFERENCE_KEY, String(enabled));
  } catch {
    // 瀏覽器禁止 localStorage 時，僅維持本次頁面中的偏好。
  }
}

export function decideCloudSyncInitialization(
  input: CloudSyncInitializationInput
): CloudSyncInitializationAction {
  return input.isAuthenticated && input.isEligible && input.isSyncEnabled
    ? 'reconnect'
    : 'disconnect';
}
