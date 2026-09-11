import {
  CLOUD_SYNC_ENABLED_PREFERENCE_KEY,
  cloudSyncEnabledPreferenceKeyForOwner,
  decideCloudSyncInitialization,
  readCloudSyncEnabledPreference,
  readSavedCloudSyncPreference,
  writeCloudSyncEnabledPreference,
} from './cloud-sync-preference';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: () => null,
    get length() {
      return values.size;
    },
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('雲端同步偏好', () => {
  it('區分未設定與明確關閉，僅未設定時允許查詢既有授權', () => {
    const storage = createStorage();
    expect(readSavedCloudSyncPreference(undefined, storage)).toBeNull();
    expect(decideCloudSyncInitialization({
      isAuthenticated: true, isEligible: true, isSyncEnabled: null,
    })).toBe('restore');
    writeCloudSyncEnabledPreference(false, undefined, storage);
    expect(readSavedCloudSyncPreference(undefined, storage)).toBe(false);
    expect(decideCloudSyncInitialization({
      isAuthenticated: true, isEligible: true, isSyncEnabled: false,
    })).toBe('disconnect');
  });
  it('預設關閉並使用獨立於報價資料的 localStorage key', () => {
    const storage = createStorage();

    expect(readCloudSyncEnabledPreference(undefined, storage)).toBe(false);
    expect(CLOUD_SYNC_ENABLED_PREFERENCE_KEY).toBe(
      'price-generator:cloud-sync-enabled'
    );
  });

  it('切換開啟與關閉時保存偏好', () => {
    const storage = createStorage();

    writeCloudSyncEnabledPreference(true, undefined, storage);
    expect(readCloudSyncEnabledPreference(undefined, storage)).toBe(true);
    writeCloudSyncEnabledPreference(false, undefined, storage);
    expect(readCloudSyncEnabledPreference(undefined, storage)).toBe(false);
  });

  it('以會員 uid 隔離偏好，A 的 false 不會阻止 B 探測既有授權', () => {
    const storage = createStorage();
    writeCloudSyncEnabledPreference(false, 'member-a', storage);

    expect(readSavedCloudSyncPreference('member-a', storage)).toBe(false);
    expect(readSavedCloudSyncPreference('member-b', storage)).toBeNull();
    expect(cloudSyncEnabledPreferenceKeyForOwner('member-a')).not.toBe(
      cloudSyncEnabledPreferenceKeyForOwner('member-b')
    );
  });

  it('舊版 true 保持相容，舊版 false 不套用到未知會員', () => {
    const storage = createStorage();
    writeCloudSyncEnabledPreference(true, undefined, storage);
    expect(readSavedCloudSyncPreference('member-a', storage)).toBe(true);

    writeCloudSyncEnabledPreference(false, undefined, storage);
    expect(readSavedCloudSyncPreference('member-b', storage)).toBeNull();
  });

  it('已登入且符合資格、並開啟偏好的會員在初始化時嘗試恢復既有授權', () => {
    expect(
      decideCloudSyncInitialization({
        isAuthenticated: true,
        isEligible: true,
        isSyncEnabled: true,
      })
    ).toBe('restore');

    expect(
      decideCloudSyncInitialization({
        isAuthenticated: true,
        isEligible: true,
        isSyncEnabled: false,
      })
    ).toBe('disconnect');
  });

  it('非資格會員一律維持本機模式，不讀取 Drive', () => {
    expect(
      decideCloudSyncInitialization({
        isAuthenticated: true,
        isEligible: false,
        isSyncEnabled: true,
      })
    ).toBe('disconnect');
  });

  it('初始化不會啟動互動式授權，只會決定恢復或中斷連線', () => {
    expect(
      decideCloudSyncInitialization({
        isAuthenticated: true,
        isEligible: true,
        isSyncEnabled: true,
      })
    ).toBe('restore');
  });
});
