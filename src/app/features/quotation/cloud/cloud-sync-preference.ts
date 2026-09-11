export const CLOUD_SYNC_ENABLED_PREFERENCE_KEY =
  'price-generator:cloud-sync-enabled';

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface CloudSyncInitializationInput {
  readonly isAuthenticated: boolean;
  readonly isEligible: boolean;
  readonly isSyncEnabled: boolean | null;
}

export type CloudSyncInitializationAction = 'disconnect' | 'restore';

function getLocalStorage(): KeyValueStorage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function cloudSyncEnabledPreferenceKeyForOwner(
  ownerId: string
): string {
  return `${CLOUD_SYNC_ENABLED_PREFERENCE_KEY}:${encodeURIComponent(ownerId)}`;
}

function preferenceKeyForOwner(ownerId?: string | null): string | null {
  const normalized = ownerId?.trim();
  return normalized ? cloudSyncEnabledPreferenceKeyForOwner(normalized) : null;
}

function parseSavedPreference(value: string | null | undefined): boolean | null {
  return value === 'true' ? true : value === 'false' ? false : null;
}

export function readCloudSyncEnabledPreference(
  ownerId?: string | null,
  storage = getLocalStorage()
): boolean {
  return readSavedCloudSyncPreference(ownerId, storage) === true;
}

/** null 代表尚未選擇；可查詢既有雲端授權，但不能自動要求首次授權。 */
export function readSavedCloudSyncPreference(
  ownerId?: string | null,
  storage = getLocalStorage()
): boolean | null {
  try {
    const scopedKey = preferenceKeyForOwner(ownerId);
    if (!scopedKey) {
      return parseSavedPreference(
        storage?.getItem(CLOUD_SYNC_ENABLED_PREFERENCE_KEY)
      );
    }
    const scoped = parseSavedPreference(storage?.getItem(scopedKey));
    if (scoped !== null) return scoped;

    // 舊版未依會員隔離。保留曾開啟的相容性；舊版 false 不可阻擋其他會員探測。
    return storage?.getItem(CLOUD_SYNC_ENABLED_PREFERENCE_KEY) === 'true'
      ? true
      : null;
  } catch {
    return null;
  }
}

export function writeCloudSyncEnabledPreference(
  enabled: boolean,
  ownerId?: string | null,
  storage = getLocalStorage()
): void {
  try {
    storage?.setItem(
      preferenceKeyForOwner(ownerId) ?? CLOUD_SYNC_ENABLED_PREFERENCE_KEY,
      String(enabled)
    );
  } catch {
    // 瀏覽器禁止 localStorage 時，僅維持本次頁面中的偏好。
  }
}

export function decideCloudSyncInitialization(
  input: CloudSyncInitializationInput
): CloudSyncInitializationAction {
  return input.isAuthenticated && input.isEligible && input.isSyncEnabled !== false
    ? 'restore'
    : 'disconnect';
}
