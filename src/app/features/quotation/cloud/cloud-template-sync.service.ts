import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { AuthService } from '@app/core/services/auth.service';
import { QuotationTemplatesService } from '../services/quotation-templates.service';
import { CloudQuotationSyncService } from './cloud-quotation-sync.service';
import { DriveAuthorizationRequiredError, DriveCloudApiService } from './drive-cloud-api.service';
import { TemplateOperation, mergeTemplateOperations } from './template-sync-domain';

export type TemplateSyncStatus = 'local' | 'waiting' | 'syncing' | 'synced' | 'error' | 'reconnect' | 'conflict';

/** Shares the quotation connection, but owns its queue, failures and immutable log. */
@Injectable({ providedIn: 'root' })
export class CloudTemplateSyncService {
  private readonly api = inject(DriveCloudApiService);
  private readonly auth = inject(AuthService);
  private readonly quotations = inject(CloudQuotationSyncService);
  private readonly templates = inject(QuotationTemplatesService);
  private readonly destroyRef = inject(DestroyRef);
  readonly status = signal<TemplateSyncStatus>('local');
  readonly error = signal<string | null>(null);
  private owner: string | null = null;
  private enabled = false;
  private connected = false;
  private generation = 0;
  private flight: Promise<void> | null = null;
  private allFlight: Promise<void> | null = null;
  private repeat = false;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retryDelay = 5000;
  private lastFocus = 0;

  constructor() {
    if (typeof window === 'undefined') return;
    const online = () => { void this.retryAll(); };
    const focus = () => {
      if (Date.now() - this.lastFocus < 30_000) return;
      this.lastFocus = Date.now();
      void this.retryAll();
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== `quotation:templates:${this.templates.currentScope()}:v2`) return;
      void this.templates.refresh().then(() => this.notifyChanged()).catch(() => undefined);
    };
    window.addEventListener('online', online);
    window.addEventListener('focus', focus);
    window.addEventListener('storage', storage);
    this.destroyRef.onDestroy(() => {
      ++this.generation;
      this.enabled = false;
      this.clearRetry();
      window.removeEventListener('online', online);
      window.removeEventListener('focus', focus);
      window.removeEventListener('storage', storage);
    });
  }

  configure(owner: string | null, enabled: boolean, connected: boolean): void {
    if (this.owner === owner && this.enabled === enabled && this.connected === connected) return;
    ++this.generation;
    this.owner = owner;
    this.enabled = enabled;
    this.connected = connected;
    this.flight = null;
    this.allFlight = null;
    this.repeat = false;
    this.clearRetry();
    this.error.set(null);
    this.status.set(!enabled ? 'local' : connected ? 'waiting' : 'reconnect');
    if (enabled && connected) void this.retry();
  }

  notifyChanged(): void {
    if (!this.enabled || !this.connected) return;
    // Remote cache/receipt writes also emit revisions. Only pending work needs
    // another round, so a successful empty merge cannot form an effect loop.
    if (this.templates.snapshot().pendingIds.length) {
      if (this.flight) this.repeat = true;
      else void this.retry();
    } else if (!this.flight && (this.status() === 'synced' || this.status() === 'conflict')) {
      this.status.set(this.templates.getConflicts().length ? 'conflict' : 'synced');
    }
  }

  /** Connection recovery/focus refresh all cloud data through the same entry. */
  retryAll(): Promise<void> {
    if (!this.owner || !this.enabled || !this.connected ||
        this.auth.userId() !== this.owner || !this.quotations.isEligible() ||
        !this.quotations.isSyncEnabled() || !this.quotations.isCloudStorage() ||
        this.templates.currentScope() !== `user:${this.owner}`) return Promise.resolve();
    if (this.allFlight) return this.allFlight;
    const work = Promise.allSettled([this.quotations.reloadHistory(), this.retry()]).then(() => undefined);
    this.allFlight = work;
    void work.finally(() => {
      if (this.allFlight === work) this.allFlight = null;
    });
    return work;
  }

  retry(): Promise<void> {
    if (!this.owner || !this.enabled || !this.connected) return Promise.resolve();
    if (this.flight) return this.flight;
    const owner = this.owner;
    const generation = this.generation;
    const current = () => generation === this.generation && this.owner === owner &&
      this.enabled && this.connected && this.auth.userId() === owner &&
      this.quotations.isEligible() && this.quotations.isSyncEnabled() &&
      this.quotations.isCloudStorage() && this.templates.currentScope() === `user:${owner}`;
    this.clearRetry();
    const work = this.run(owner, current);
    this.flight = work;
    void work.finally(() => {
      if (this.flight !== work) return;
      this.flight = null;
      if (this.repeat && current() && this.status() !== 'error' && this.status() !== 'reconnect') {
        this.repeat = false;
        void this.retry();
      }
    });
    return work;
  }

  private async run(owner: string, current: () => boolean): Promise<void> {
    try {
      if (!current()) return;
      this.status.set('syncing');
      this.error.set(null);
      await this.templates.refresh();
      if (!current()) return;
      const remote: TemplateOperation[] = [];
      const tokens = new Set<string>();
      let pageToken: string | undefined;
      do {
        if (!current()) return;
        const page = await this.api.listTemplateOperations(owner, pageToken, current);
        if (!current()) return;
        for (const { fileId } of page.files) {
          if (!current()) return;
          const operation = await this.api.getTemplateOperation(owner, fileId, current);
          if (!current()) return;
          remote.push(operation);
        }
        if (page.nextPageToken !== null && (!page.nextPageToken || tokens.has(page.nextPageToken))) {
          throw new Error('常用資料雲端分頁格式錯誤');
        }
        pageToken = page.nextPageToken ?? undefined;
        if (pageToken) tokens.add(pageToken);
      } while (pageToken);
      if (!current()) return;
      // Validate the complete graph before committing any downloaded branch.
      mergeTemplateOperations([...this.templates.snapshot().operations, ...remote], owner);
      await this.templates.mergeRemote(remote, current);
      if (!current()) return;
      const snapshot = this.templates.snapshot();
      const pending = new Set(snapshot.pendingIds);
      const remoteIds = new Set(remote.map(operation => operation.operationId));
      // Parents first, even if canonical local storage ordering differs.
      const ordered: TemplateOperation[] = [];
      const visited = new Set<string>();
      const byRevision = new Map(snapshot.operations.map(op => [op.revisionId, op]));
      const visit = (op: TemplateOperation): void => {
        if (visited.has(op.revisionId)) return;
        visited.add(op.revisionId);
        for (const parent of op.parentRevisionIds) {
          const prior = byRevision.get(parent);
          if (prior) visit(prior);
        }
        // A reconnected/cleared Drive may no longer contain acknowledged local
        // operations. The durable log is also the repair source in that case.
        if (pending.has(op.operationId) || !remoteIds.has(op.operationId)) ordered.push(op);
      };
      snapshot.operations.forEach(visit);
      for (const operation of ordered) {
        if (!current()) return;
        await this.api.createTemplateOperation(operation, current);
        if (!current()) return;
        await this.templates.acknowledge(operation.operationId, current);
        if (!current()) return;
      }
      this.retryDelay = 5000;
      const hasPending = this.templates.snapshot().pendingIds.length > 0;
      this.status.set(this.templates.getConflicts().length ? 'conflict' : hasPending ? 'waiting' : 'synced');
      this.repeat = hasPending;
    } catch (error) {
      if (!current()) return;
      const reconnect = error instanceof DriveAuthorizationRequiredError;
      this.status.set(reconnect ? 'reconnect' : 'error');
      this.error.set(reconnect ? '請重新連結 Google Drive；常用資料仍保留在本機。' :
        '常用資料同步失敗，已保留本機資料與待送紀錄。' +
        (error instanceof Error ? ` ${error.message}` : ''));
      if (!reconnect) {
        this.retryTimer = setTimeout(() => { if (current()) void this.retry(); }, this.retryDelay);
        this.retryDelay = Math.min(this.retryDelay * 2, 60_000);
      }
    }
  }

  private clearRetry(): void {
    if (this.retryTimer !== undefined) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
  }
}
