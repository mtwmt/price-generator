/** 容器層的非同步備份讀取防護：切換帳號、登出或後續操作後都不得寫入舊 scope。 */
export async function restoreRecoveryFileForCurrentScope(input: {
  file: File;
  scope: string;
  beginOperation: () => number;
  isCurrentOperation: (version: number) => boolean;
  getCurrentScope: () => string;
  restore: (rawSource: string, scope: string) => boolean;
}): Promise<'restored' | 'stale' | 'read-failed' | 'invalid'> {
  const version = input.beginOperation();
  let rawSource: string;
  try {
    rawSource = await input.file.text();
  } catch {
    return input.isCurrentOperation(version) && input.scope === input.getCurrentScope()
      ? 'read-failed'
      : 'stale';
  }
  if (!input.isCurrentOperation(version) || input.scope !== input.getCurrentScope()) return 'stale';
  return input.restore(rawSource, input.scope) ? 'restored' : 'invalid';
}
