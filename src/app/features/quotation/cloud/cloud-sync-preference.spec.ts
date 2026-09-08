import {
  CLOUD_SYNC_ENABLED_PREFERENCE_KEY,
  decideCloudSyncInitialization,
  readCloudSyncEnabledPreference,
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
  it('預設關閉並使用獨立於報價資料的 localStorage key', () => {
    const storage = createStorage();

    expect(readCloudSyncEnabledPreference(storage)).toBe(false);
    expect(CLOUD_SYNC_ENABLED_PREFERENCE_KEY).toBe(
      'price-generator:cloud-sync-enabled'
    );
  });

  it('切換開啟與關閉時保存偏好', () => {
    const storage = createStorage();

    writeCloudSyncEnabledPreference(true, storage);
    expect(readCloudSyncEnabledPreference(storage)).toBe(true);
    writeCloudSyncEnabledPreference(false, storage);
    expect(readCloudSyncEnabledPreference(storage)).toBe(false);
  });

  it('只有已登入且符合資格、並開啟偏好的會員才自動恢復 Drive 授權', () => {
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

  it('首次授權不是初始化流程的一部分，初始化只會決定恢復或中斷連線', () => {
    expect(
      decideCloudSyncInitialization({
        isAuthenticated: true,
        isEligible: true,
        isSyncEnabled: true,
      })
    ).not.toBe('disconnect');
  });
});
