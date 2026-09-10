jest.mock('@angular/core', () => {
  const input = Object.assign(
    <T>(initial: T) => () => initial,
    { required: <T>() => () => undefined as T }
  );
  return {
    ChangeDetectionStrategy: { OnPush: 'OnPush' },
    Component: () => (target: unknown) => target,
    computed: <T>(compute: () => T) => compute,
    input,
    output: () => ({ emit: jest.fn() }),
  };
});

import {
  CloudSyncStatusComponent,
  presentCloudSyncStatus,
} from './cloud-sync-status.component';

describe('CloudSyncStatusComponent 顯示規則', () => {
  it.each([
    ['local', '本機儲存', false],
    ['connecting', '連線中', false],
    ['syncing', '同步中', false],
    ['error', '同步失敗', false],
    ['reconnect', '需要重新連線', true],
  ] as const)('狀態 %s 顯示安全短文', (status, text, canReconnect) => {
    expect(presentCloudSyncStatus(status, null)).toEqual({ text, canReconnect });
  });

  it('已同步顯示本地格式時間', () => {
    const presentation = presentCloudSyncStatus(
      'synced',
      new Date('2026-09-11T08:30:00.000Z').getTime()
    );

    expect(presentation.text).toContain('已同步');
    expect(presentation.text).not.toContain('T08:30:00.000Z');
    expect(presentation.canReconnect).toBe(false);
  });

  it('重新連線操作只 emit，交由父層處理授權流程', () => {
    const component = new CloudSyncStatusComponent();

    component.requestReconnect();

    expect(component.reconnect.emit).toHaveBeenCalledTimes(1);
  });
});
