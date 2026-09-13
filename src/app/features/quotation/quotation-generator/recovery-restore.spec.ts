import { restoreRecoveryFileForCurrentScope } from './recovery-restore';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('恢復檔案 scope / operation 防護', () => {
  it('A 帳號選檔後切至 B，不會把 A 的讀取結果寫進 B', async () => {
    const reading = deferred<string>();
    let scope = 'quotation:user:A';
    let operation = 0;
    const restore = jest.fn(() => true);
    const pending = restoreRecoveryFileForCurrentScope({
      file: { text: () => reading.promise } as File, scope,
      beginOperation: () => ++operation, isCurrentOperation: (version) => version === operation,
      getCurrentScope: () => scope, restore,
    });
    scope = 'quotation:user:B';
    reading.resolve('A backup');
    await expect(pending).resolves.toBe('stale');
    expect(restore).not.toHaveBeenCalled();
  });

  it('登出或後續操作使 pending read 失效，不會覆寫 visitor scope', async () => {
    const reading = deferred<string>();
    let scope = 'quotation:user:A';
    let operation = 0;
    const restore = jest.fn(() => true);
    const pending = restoreRecoveryFileForCurrentScope({
      file: { text: () => reading.promise } as File, scope,
      beginOperation: () => ++operation, isCurrentOperation: (version) => version === operation,
      getCurrentScope: () => scope, restore,
    });
    scope = 'quotation:visitor';
    operation += 1;
    reading.resolve('old backup');
    await expect(pending).resolves.toBe('stale');
    expect(restore).not.toHaveBeenCalled();
  });

  it('讀檔失敗只回報 read-failed，從不呼叫寫入', async () => {
    const restore = jest.fn(() => true);
    await expect(restoreRecoveryFileForCurrentScope({
      file: { text: async () => { throw new Error('broken file'); } } as unknown as File,
      scope: 'quotation:user:A', beginOperation: () => 1, isCurrentOperation: () => true,
      getCurrentScope: () => 'quotation:user:A', restore,
    })).resolves.toBe('read-failed');
    expect(restore).not.toHaveBeenCalled();
  });
});
