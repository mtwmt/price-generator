import { combineCloudSyncStatus } from './unified-sync-status';

describe('combineCloudSyncStatus', () => {
  it.each([
    ['reconnect', 'synced', true, 'reconnect'],
    ['synced', 'error', true, 'error'],
    ['connecting', 'error', true, 'connecting'],
    ['connecting', 'reconnect', true, 'connecting'],
    ['connecting', 'synced', true, 'connecting'],
    ['syncing', 'conflict', true, 'syncing'],
    ['synced', 'conflict', true, 'conflict'],
    ['synced', 'waiting', true, 'waiting'],
    ['synced', 'synced', true, 'synced'],
    ['local', 'synced', false, 'local'],
  ] as const)('%s + %s (enabled %s) → %s', (quotation, template, enabled, expected) => {
    expect(combineCloudSyncStatus(quotation, template, enabled)).toBe(expected);
  });
});
