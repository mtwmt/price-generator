import { Injectable, inject, signal } from '@angular/core';
import {
  CustomerTemplate,
  ServiceItemTemplate,
} from '@app/features/quotation/models/quotation.model';
import { StorageService } from '@app/shared/services/storage.service';
import { WebCryptoSha256HashProvider } from '../cloud/cloud-hash';
import { canonicalizeJsonValue } from '../cloud/cloud-json';
import {
  createTemplateOperation,
  mergeTemplateOperations,
  validateTemplateOperation,
  validateTemplateValue,
  type TemplateEntity,
  type TemplateKind,
  type TemplateOperation,
  type TemplateValue,
} from '../cloud/template-sync-domain';

interface TemplateEnvelope {
  readonly schemaVersion: 2;
  readonly ownerSub: string;
  readonly operations: readonly TemplateOperation[];
  readonly pendingIds: readonly string[];
  readonly migrationComplete: true;
}

interface CacheState {
  readonly envelope: TemplateEnvelope | null;
  readonly entities: readonly TemplateEntity[];
}

type TemplateInput<T> = Omit<T, 'id'> & { id?: string };
const EPOCH = '1970-01-01T00:00:00.000Z';
const EMPTY_CACHE: CacheState = { envelope: null, entities: [] };

/** 常用資料採單一 append-only 封套；所有跨分頁寫入均由 Web Locks 保護。 */
@Injectable({ providedIn: 'root' })
export class QuotationTemplatesService {
  private readonly storage = inject(StorageService);
  private scope = 'visitor';
  private generation = 0;
  private cache: CacheState = EMPTY_CACHE;
  private readonly bases = new WeakMap<object, readonly string[]>();
  private readyPromise: Promise<void>;

  readonly revision = signal(0);
  readonly error = signal<string | null>(null);

  constructor() {
    this.readyPromise = this.loadScope(this.scope, this.generation);
    void this.readyPromise.catch(() => undefined);
  }

  setScope(scope: string): Promise<void> {
    const next = this.normalizeScope(scope);
    if (next === this.scope) return this.readyPromise;
    this.scope = next;
    this.generation += 1;
    this.cache = EMPTY_CACHE;
    this.error.set(null);
    this.revision.update((current) => current + 1);
    this.readyPromise = this.loadScope(this.scope, this.generation);
    void this.readyPromise.catch(() => undefined);
    return this.readyPromise;
  }

  ready(): Promise<void> { return this.readyPromise; }
  currentScope(): string { return this.scope; }

  async refresh(): Promise<void> {
    const scope = this.scope;
    const generation = this.generation;
    this.readyPromise = this.loadScope(scope, generation);
    void this.readyPromise.catch(() => undefined);
    await this.readyPromise;
  }

  getCustomers(query = ''): CustomerTemplate[] {
    return this.filter(this.valuesFor<CustomerTemplate>('customers'), query);
  }

  getServiceItems(query = ''): ServiceItemTemplate[] {
    return this.filter(this.valuesFor<ServiceItemTemplate>('service-items'), query);
  }

  baseFor(value: TemplateValue): readonly string[] {
    return [...(this.bases.get(value) ?? [])];
  }

  async saveCustomer(value: TemplateInput<CustomerTemplate>, parents?: readonly string[]): Promise<boolean> {
    const entry = this.normalizeCustomer(value);
    return entry ? this.save('customers', entry, parents) : false;
  }

  async saveServiceItem(value: TemplateInput<ServiceItemTemplate>, parents?: readonly string[]): Promise<boolean> {
    const entry = this.normalizeServiceItem(value);
    return entry ? this.save('service-items', entry, parents) : false;
  }

  async deleteCustomer(id: string, parents?: readonly string[]): Promise<boolean> {
    return this.remove('customers', id, parents);
  }

  async deleteServiceItem(id: string, parents?: readonly string[]): Promise<boolean> {
    return this.remove('service-items', id, parents);
  }

  getConflicts(): TemplateEntity[] {
    return this.cache.entities.filter((entity) => entity.heads.length > 1)
      .map((entity) => ({ ...entity, heads: [...entity.heads] }));
  }

  async resolveConflict(
    kind: TemplateKind,
    id: string,
    chosenRevisionId: string | null,
    keepBoth = false,
    suppliedParents?: readonly string[]
  ): Promise<boolean> {
    const scope = this.scope;
    const generation = this.generation;
    const entity = this.entityFor(kind, id);
    if (!entity || entity.heads.length < 2) return this.failure('找不到可處理的常用資料衝突');
    const requested = suppliedParents ? [...new Set(suppliedParents)] : entity.heads.map((head) => head.revisionId);
    const heads = entity.heads.filter((head) => requested.includes(head.revisionId));
    if (heads.length < 2 || heads.length !== requested.length) return this.failure('指定的衝突版本已改變，請重新整理');
    const selected = chosenRevisionId ? heads.find((head) => head.revisionId === chosenRevisionId) : undefined;
    if (chosenRevisionId && !selected) return this.failure('指定的衝突版本不存在');

    return this.withScopeLock(scope, generation, async (guard) => {
      const envelope = await this.readCurrentEnvelope(scope, guard);
      if (!envelope || !guard()) return false;
      const latest = mergeTemplateOperations(envelope.operations, this.ownerFor(scope))
        .find((candidate) => candidate.resourceKind === kind && candidate.entityId === id);
      const latestHeads = latest?.heads.filter((head) => requested.includes(head.revisionId)) ?? [];
      // 只處理畫面當時看見的 subset，讓晚到的新 branch 留作後續衝突；但已看見
      // 的 parent 若不再是 head，代表另一個 resolver 已搶先完成，不能再寫 sibling。
      if (latestHeads.length !== requested.length) {
        return this.failure('衝突版本已改變，請重新整理後再處理');
      }
      const latestSelected = chosenRevisionId
        ? latestHeads.find((head) => head.revisionId === chosenRevisionId)
        : undefined;
      if (chosenRevisionId && !latestSelected) return this.failure('指定的衝突版本不存在');
      const created: TemplateOperation[] = [];
      if (keepBoth) {
        for (const head of latestHeads) {
          // 已選取的 put 會保留在原 ID；其餘 put 分支複製為獨立資料。
          if (head.action !== 'put' || head.revisionId === chosenRevisionId) continue;
          const copiedId = this.createId(kind === 'customers' ? 'customer' : 'service');
          const copied = { ...(head.value as TemplateValue), id: copiedId } as TemplateValue;
          created.push(await this.createOperation({
            ownerSub: this.ownerFor(scope), resourceKind: kind, entityId: copiedId,
            parentRevisionIds: [], action: 'put', value: copied,
          }));
          if (!guard()) return false;
        }
      }
      created.push(await this.createOperation({
        ownerSub: this.ownerFor(scope), resourceKind: kind, entityId: id,
        parentRevisionIds: requested, action: latestSelected?.action === 'put' ? 'put' : 'delete',
        value: latestSelected?.action === 'put' ? this.copyValue(latestSelected.value as TemplateValue) : null,
      }));
      if (!guard()) return false;
      return this.persistMutation(scope, generation, envelope, created, guard);
    });
  }

  snapshot(): { operations: readonly TemplateOperation[]; pendingIds: readonly string[] } {
    return {
      operations: this.cache.envelope ? [...this.cache.envelope.operations] : [],
      pendingIds: this.cache.envelope ? [...this.cache.envelope.pendingIds] : [],
    };
  }

  async mergeRemote(operations: readonly TemplateOperation[], isCurrent: () => boolean): Promise<void> {
    const scope = this.scope;
    const generation = this.generation;
    const merged = await this.withScopeLock(scope, generation, async (guard) => {
      const current = () => guard() && isCurrent();
      if (!current()) return;
      const envelope = await this.readCurrentEnvelope(scope, current);
      if (!envelope) { if (current()) throw new Error(this.error() ?? '無法讀取本機常用資料'); return; }
      if (!current()) return;
      let verified: TemplateOperation[];
      try {
        verified = [];
        for (const operation of operations) {
          verified.push(await validateTemplateOperation(operation, this.ownerFor(scope)));
          if (!current()) return;
        }
      } catch (error) {
        if (!current()) return;
        const message = this.errorMessage('遠端常用資料格式無效', error);
        this.fail(message);
        throw new Error(message);
      }
      try { mergeTemplateOperations([...envelope.operations, ...verified], this.ownerFor(scope)); } catch (error) {
        const message = this.errorMessage('無法合併遠端常用資料', error);
        this.fail(message);
        throw new Error(message);
      }
      const known = new Map(envelope.operations.map((operation) => [operation.operationId, operation]));
      // Drive 在回條遺失重送時可列出相同 operation；完整圖已先驗證其內容
      // 一致，封套仍只保存一份，避免自行製造 duplicate operationId。
      const remoteUnique = new Map<string, TemplateOperation>();
      for (const operation of verified) remoteUnique.set(operation.operationId, operation);
      const additions = [...remoteUnique.values()].filter((operation) => !known.has(operation.operationId));
      const next: TemplateEnvelope = additions.length ? { ...envelope, operations: [...envelope.operations, ...additions] } : envelope;
      if (additions.length && !await this.writeAndVerify(scope, next, current)) {
        if (current()) throw new Error(this.error() ?? '本機常用資料寫入失敗');
        return;
      }
      if (current()) this.applyEnvelope(scope, generation, next);
      return true;
    });
    if (merged === false && this.isActive(scope, generation) && isCurrent()) {
      throw new Error(this.error() ?? '無法合併遠端常用資料');
    }
  }

  async acknowledge(operationId: string, isCurrent: () => boolean): Promise<void> {
    const scope = this.scope;
    const generation = this.generation;
    const acknowledged = await this.withScopeLock(scope, generation, async (guard) => {
      const current = () => guard() && isCurrent();
      if (!current()) return;
      const envelope = await this.readCurrentEnvelope(scope, current);
      if (!envelope) { if (current()) throw new Error(this.error() ?? '無法讀取本機常用資料'); return; }
      if (!current()) return;
      const index = envelope.pendingIds.indexOf(operationId);
      if (index < 0) return;
      const pendingIds = [...envelope.pendingIds];
      pendingIds.splice(index, 1);
      const next: TemplateEnvelope = { ...envelope, pendingIds };
      if (!await this.writeAndVerify(scope, next, current)) {
        if (current()) throw new Error(this.error() ?? '本機常用資料寫入失敗');
        return;
      }
      if (!current()) return;
      this.applyEnvelope(scope, generation, next);
      return true;
    });
    if (acknowledged === false && this.isActive(scope, generation) && isCurrent()) {
      throw new Error(this.error() ?? '無法確認常用資料操作');
    }
  }

  private async save(kind: TemplateKind, value: TemplateValue, supplied?: readonly string[]): Promise<boolean> {
    const scope = this.scope;
    const generation = this.generation;
    const parents = this.captureParents(kind, value.id, supplied, value);
    if (!parents) return this.failure('此資料有未解決衝突，請先選擇要保留的版本');
    return this.withScopeLock(scope, generation, async (guard) => {
      const envelope = await this.readCurrentEnvelope(scope, guard);
      if (!envelope || !guard()) return false;
      const operation = await this.createOperation({
        ownerSub: this.ownerFor(scope), resourceKind: kind, entityId: value.id,
        parentRevisionIds: parents, action: 'put', value: this.copyValue(value),
      });
      return guard() ? this.persistMutation(scope, generation, envelope, [operation], guard) : false;
    });
  }

  private async remove(kind: TemplateKind, id: string, supplied?: readonly string[]): Promise<boolean> {
    if (!id.trim()) return false;
    const scope = this.scope;
    const generation = this.generation;
    const parents = this.captureParents(kind, id, supplied);
    if (!parents) return this.failure('此資料有未解決衝突，請先選擇要保留的版本');
    return this.withScopeLock(scope, generation, async (guard) => {
      const envelope = await this.readCurrentEnvelope(scope, guard);
      if (!envelope || !guard()) return false;
      const operation = await this.createOperation({
        ownerSub: this.ownerFor(scope), resourceKind: kind, entityId: id,
        parentRevisionIds: parents, action: 'delete', value: null,
      });
      return guard() ? this.persistMutation(scope, generation, envelope, [operation], guard) : false;
    });
  }

  private async persistMutation(scope: string, generation: number, envelope: TemplateEnvelope, additions: readonly TemplateOperation[], guard: () => boolean): Promise<boolean> {
    const next: TemplateEnvelope = {
      ...envelope,
      operations: [...envelope.operations, ...additions],
      pendingIds: [...envelope.pendingIds, ...additions.map((operation) => operation.operationId)],
    };
    try { mergeTemplateOperations(next.operations, this.ownerFor(scope)); } catch (error) {
      this.fail(this.errorMessage('常用資料版本關係無效', error));
      return false;
    }
    if (!await this.writeAndVerify(scope, next, guard)) return false;
    this.applyEnvelope(scope, generation, next);
    return true;
  }

  private async loadScope(scope: string, generation: number): Promise<void> {
    // 沒有 Web Locks 時仍可安全讀取既有已驗證封套；唯獨不能遷移或寫入，
    // 避免把兩個分頁的 read-modify-write 偽裝成原子操作。
    if (!this.hasWebLocks()) {
      const result = await this.readEnvelope(scope, () => this.isActive(scope, generation));
      if (result.kind === 'valid') { this.applyEnvelope(scope, generation, result.envelope); return; }
      if (result.kind === 'invalid') { this.fail(result.message); throw new Error(result.message); }
      this.fail('此瀏覽器不支援安全的本機資料鎖定，未寫入常用資料');
      return;
    }
    const loaded = await this.withScopeLock(scope, generation, async (guard) => {
      const result = await this.readEnvelope(scope, guard);
      if (!guard()) return;
      if (result.kind === 'valid') { this.applyEnvelope(scope, generation, result.envelope); return; }
      if (result.kind === 'invalid') { this.fail(result.message); throw new Error(result.message); }
      const migrated = await this.migrateLegacy(scope, guard);
      if (!migrated && guard()) throw new Error(this.error() ?? '本機常用資料初始化失敗');
      if (migrated && guard()) this.applyEnvelope(scope, generation, migrated);
      return true;
    });
    if (loaded === false && this.isActive(scope, generation)) {
      throw new Error(this.error() ?? '本機常用資料初始化失敗');
    }
  }

  private async migrateLegacy(scope: string, guard: () => boolean): Promise<TemplateEnvelope | null> {
    const customers = this.readLegacy<CustomerTemplate>(scope, 'customers', (value): value is CustomerTemplate => validateTemplateValue('customers', value));
    const services = this.readLegacy<ServiceItemTemplate>(scope, 'service-items', (value): value is ServiceItemTemplate => validateTemplateValue('service-items', value));
    if (!customers.ok) { this.fail(customers.message); return null; }
    if (!services.ok) { this.fail(services.message); return null; }
    const ownerSub = this.ownerFor(scope);
    const operations: TemplateOperation[] = [];
    try {
      for (const [kind, entries] of [['customers', customers.entries] as const, ['service-items', services.entries] as const]) {
        for (const entry of entries) {
          const identity = await this.legacyIdentity(scope, kind, entry);
          if (!guard()) return null;
          operations.push(await createTemplateOperation({
            ownerSub, resourceKind: kind, entityId: entry.id, revisionId: `legacy-r-${identity}`,
            operationId: `legacy-o-${identity}`, parentRevisionIds: [], action: 'put', value: this.copyValue(entry), createdAt: EPOCH,
          }));
        }
      }
      mergeTemplateOperations(operations, ownerSub);
    } catch (error) {
      if (guard()) this.fail(this.errorMessage('舊版常用資料無法安全遷移', error));
      return null;
    }
    const envelope: TemplateEnvelope = { schemaVersion: 2, ownerSub, operations, pendingIds: operations.map((operation) => operation.operationId), migrationComplete: true };
    return await this.writeAndVerify(scope, envelope, guard) ? envelope : null;
  }

  private readLegacy<T extends TemplateValue>(scope: string, kind: TemplateKind, valid: (value: unknown) => value is T): { ok: true; entries: readonly T[] } | { ok: false; message: string } {
    const result = this.storage.readJson<unknown>(this.legacyKey(scope, kind));
    if (result.status === 'missing') return { ok: true, entries: [] };
    const record = result.status === 'ok' && result.value && typeof result.value === 'object' ? result.value as { schemaVersion?: unknown; entries?: unknown } : null;
    if (!record || record.schemaVersion !== 1 || !Array.isArray(record.entries) || !record.entries.every(valid)) return { ok: false, message: `舊版${this.kindName(kind)}資料格式無效，已保留來源` };
    const ids = record.entries.map((entry) => entry.id);
    if (new Set(ids).size !== ids.length) return { ok: false, message: `舊版${this.kindName(kind)}資料含重複識別，已保留來源` };
    return { ok: true, entries: record.entries.map((entry) => this.copyValue(entry)) };
  }

  private async readCurrentEnvelope(scope: string, guard: () => boolean): Promise<TemplateEnvelope | null> {
    const result = await this.readEnvelope(scope, guard);
    if (result.kind === 'valid') return result.envelope;
    if (!guard()) return null;
    this.fail(result.kind === 'invalid' ? result.message : '本機常用資料尚未初始化');
    return null;
  }

  private async readEnvelope(scope: string, guard: () => boolean): Promise<{ kind: 'missing' } | { kind: 'valid'; envelope: TemplateEnvelope } | { kind: 'invalid'; message: string }> {
    const result = this.storage.readJson<unknown>(this.key(scope));
    if (result.status === 'missing') return { kind: 'missing' };
    if (result.status !== 'ok') return { kind: 'invalid', message: '本機常用資料無法讀取，未覆寫現有內容' };
    try {
      const envelope = await this.validateEnvelope(result.value, this.ownerFor(scope));
      return guard() ? { kind: 'valid', envelope } : { kind: 'missing' };
    } catch (error) { return { kind: 'invalid', message: this.errorMessage('本機常用資料格式無效，未覆寫現有內容', error) }; }
  }

  private async validateEnvelope(value: unknown, ownerSub: string): Promise<TemplateEnvelope> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('封套必須是物件');
    const record = value as Record<string, unknown>;
    const fields = ['schemaVersion', 'ownerSub', 'operations', 'pendingIds', 'migrationComplete'];
    if (Object.keys(record).length !== fields.length || Object.keys(record).some((key) => !fields.includes(key)) || record['schemaVersion'] !== 2 || record['ownerSub'] !== ownerSub || record['migrationComplete'] !== true || !Array.isArray(record['operations']) || !Array.isArray(record['pendingIds'])) throw new Error('封套版本或欄位不符');
    const operations: TemplateOperation[] = [];
    for (const operation of record['operations']) operations.push(await validateTemplateOperation(operation, ownerSub));
    const ids = operations.map((operation) => operation.operationId);
    if (new Set(ids).size !== ids.length || new Set(record['pendingIds']).size !== record['pendingIds'].length || !record['pendingIds'].every((id) => typeof id === 'string' && ids.includes(id))) throw new Error('待送操作識別無效');
    mergeTemplateOperations(operations, ownerSub);
    return { schemaVersion: 2, ownerSub, operations, pendingIds: [...record['pendingIds']] as string[], migrationComplete: true };
  }

  private async writeAndVerify(scope: string, envelope: TemplateEnvelope, guard: () => boolean): Promise<boolean> {
    if (!guard()) return false;
    if (!this.storage.setDetailed(this.key(scope), envelope).success) return this.failure('本機常用資料儲存失敗，未宣稱操作成功');
    const verified = await this.readEnvelope(scope, guard);
    if (!guard()) return false;
    if (verified.kind !== 'valid' || !this.sameEnvelope(envelope, verified.envelope)) return this.failure(verified.kind === 'invalid' ? verified.message : '本機常用資料寫入驗證失敗');
    return true;
  }

  private applyEnvelope(scope: string, generation: number, envelope: TemplateEnvelope): void {
    if (!this.isActive(scope, generation)) return;
    let entities: TemplateEntity[];
    try { entities = mergeTemplateOperations(envelope.operations, this.ownerFor(scope)); } catch (error) { this.fail(this.errorMessage('常用資料版本關係無效', error)); return; }
    if (this.cache.envelope && this.sameEnvelope(this.cache.envelope, envelope)) { this.error.set(null); return; }
    this.cache = { envelope, entities };
    this.error.set(null);
    this.revision.update((current) => current + 1);
  }

  private valuesFor<T extends TemplateValue>(kind: TemplateKind): T[] {
    return this.cache.entities.flatMap((entity) => {
      if (entity.resourceKind !== kind) return [];
      const head = entity.heads.find((candidate) => candidate.action === 'put');
      if (!head?.value) return [];
      const value = this.copyValue(head.value) as T;
      // 衝突時畫面只呈現此分支，因此編輯只能以這個 branch 為 parent。
      this.bases.set(value, [head.revisionId]);
      return [value];
    });
  }

  private entityFor(kind: TemplateKind, id: string): TemplateEntity | undefined { return this.cache.entities.find((entity) => entity.resourceKind === kind && entity.entityId === id); }
  private captureParents(kind: TemplateKind, id: string, supplied: readonly string[] | undefined, value?: TemplateValue): readonly string[] | null {
    if (supplied) return [...new Set(supplied)].sort();
    const base = value ? this.bases.get(value) : undefined;
    if (base) return [...base];
    const entity = this.entityFor(kind, id);
    return entity && entity.heads.length > 1 ? null : entity?.heads.map((head) => head.revisionId) ?? [];
  }

  private async createOperation(input: { ownerSub: string; resourceKind: TemplateKind; entityId: string; parentRevisionIds: readonly string[]; action: 'put' | 'delete'; value: TemplateValue | null }): Promise<TemplateOperation> {
    const nonce = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    return createTemplateOperation({ ...input, revisionId: `r-${nonce}`, operationId: `o-${nonce}`, createdAt: new Date().toISOString() });
  }

  private async legacyIdentity(scope: string, kind: TemplateKind, value: TemplateValue): Promise<string> {
    return new WebCryptoSha256HashProvider().hash(canonicalizeJsonValue({ scope, kind, id: value.id, value }));
  }

  private async withScopeLock<T>(scope: string, generation: number, action: (guard: () => boolean) => Promise<T>): Promise<T | false> {
    const locks = globalThis.navigator?.locks;
    if (!locks?.request) return this.failure('此瀏覽器不支援安全的本機資料鎖定，未寫入常用資料');
    const guard = () => this.isActive(scope, generation);
    if (!guard()) return false;
    try { return await locks.request(`quotation:templates:${scope}`, async () => action(guard)); } catch (error) {
      if (guard()) this.fail(this.errorMessage('本機常用資料鎖定失敗', error));
      return false;
    }
  }

  private isActive(scope: string, generation: number): boolean { return this.scope === scope && this.generation === generation; }
  private hasWebLocks(): boolean { return !!globalThis.navigator?.locks?.request; }
  private key(scope: string): string { return `quotation:templates:${scope}:v2`; }
  private legacyKey(scope: string, kind: TemplateKind): string { return `quotation:templates:${scope}:${kind}`; }
  private ownerFor(scope: string): string { return scope === 'visitor' ? 'visitor' : scope.slice(5); }
  private normalizeScope(scope: string): string { const value = scope.trim(); return value.startsWith('user:') && value.slice(5).trim() ? `user:${value.slice(5).trim()}` : 'visitor'; }
  private normalizeCustomer(value: TemplateInput<CustomerTemplate>): CustomerTemplate | null {
    // 舊 v1 的 ID 只要求非空白，可能含首尾空白；不可在改名時偷偷改 entityId。
    const entry: CustomerTemplate = { id: value.id === undefined ? this.createId('customer') : value.id, name: value.name.trim() || value.customerCompany.trim(), customerCompany: value.customerCompany.trim() };
    this.assignOptional(entry, 'customerTaxID', value.customerTaxID); this.assignOptional(entry, 'customerContact', value.customerContact); this.assignOptional(entry, 'customerPhone', value.customerPhone); this.assignOptional(entry, 'customerPhoneExt', value.customerPhoneExt); this.assignOptional(entry, 'customerEmail', value.customerEmail); this.assignOptional(entry, 'customerAddress', value.customerAddress);
    return validateTemplateValue('customers', entry) ? entry : null;
  }
  private normalizeServiceItem(value: TemplateInput<ServiceItemTemplate>): ServiceItemTemplate | null {
    const entry: ServiceItemTemplate = { id: value.id === undefined ? this.createId('service') : value.id, name: value.name.trim() || value.item.trim(), item: value.item.trim(), price: value.price };
    this.assignOptional(entry, 'unit', value.unit); this.assignOptional(entry, 'category', value.category);
    return validateTemplateValue('service-items', entry) ? entry : null;
  }
  private copyValue<T extends TemplateValue>(value: T): T { return { ...value } as T; }
  private filter<T extends { name: string }>(entries: T[], query: string): T[] { const keyword = query.trim().toLocaleLowerCase(); return keyword ? entries.filter((entry) => entry.name.toLocaleLowerCase().includes(keyword)) : entries; }
  private sameEnvelope(left: TemplateEnvelope, right: TemplateEnvelope): boolean { return JSON.stringify(left) === JSON.stringify(right); }
  private optionalText(value: string | undefined): string | undefined { const normalized = value?.trim(); return normalized || undefined; }
  private assignOptional<T extends object>(target: T, key: string, value: string | undefined): void { const normalized = this.optionalText(value); if (normalized !== undefined) (target as Record<string, string>)[key] = normalized; }
  private createId(prefix: string): string { return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`; }
  private kindName(kind: TemplateKind): string { return kind === 'customers' ? '客戶' : '服務項目'; }
  private fail(message: string): void { this.error.set(message); }
  private failure(message: string): false { this.fail(message); return false; }
  private errorMessage(prefix: string, error: unknown): string { return `${prefix}${error instanceof Error && error.message ? `：${error.message}` : ''}`; }
}
