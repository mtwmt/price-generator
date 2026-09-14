/** Direct component entry points → real sync/domain/hash/storage → in-memory external boundaries. */
const dependencies = new Map<unknown, unknown>();
const effects: (() => void)[] = [];
jest.mock('@angular/core', () => ({
  Injectable: () => (target: unknown) => target, Component: () => (target: unknown) => target,
  ChangeDetectionStrategy: { OnPush: 'OnPush' },
  Renderer2: class {}, DestroyRef: class {}, ChangeDetectorRef: class {}, DOCUMENT: 'document',
  computed: (fn: () => unknown) => fn, viewChild: () => () => undefined,
  effect: (fn: () => void) => { effects.push(fn); },
  inject: (token: unknown) => dependencies.get(token),
  signal: <T>(initial: T) => {
    let value = initial;
    return Object.assign(() => value, { set: (next: T) => { value = next; },
      update: (fn: (current: T) => T) => { value = fn(value); } });
  },
}));
jest.mock('@angular/common', () => ({ CommonModule: class {} }));
jest.mock('@angular/forms', () => ({ ReactiveFormsModule: class {} }));
jest.mock('@lucide/angular', () => ({}));
jest.mock('litepicker', () => class {});
jest.mock('@app/features/quotation/quotation-preview/quotation-preview.component', () => ({ QuotationPreview: class {} }));
jest.mock('@app/features/quotation/cloud/cloud-sync-status/cloud-sync-status.component', () => ({ CloudSyncStatusComponent: class {} }));
jest.mock('./quotation-history/quotation-history.component', () => ({ QuotationHistory: class {} }));
jest.mock('./customer-info-section/customer-info-section.component', () => ({ CustomerInfoSection: class {} }));
jest.mock('./quotation-info-section/quotation-info-section.component', () => ({ QuotationInfoSection: class {} }));
jest.mock('./quoter-info-section/quoter-info-section.component', () => ({ QuoterInfoSection: class {} }));
jest.mock('./service-items-section/service-items-section.component', () => ({ ServiceItemsSection: class {} }));
jest.mock('./pricing-section/pricing-section.component', () => ({ PricingSection: class {} }));
jest.mock('./other-info-section/other-info-section.component', () => ({ OtherInfoSection: class {} }));
jest.mock('@app/shared/components/searchable-select/searchable-select.component', () => ({ SearchableSelectComponent: class {} }));
jest.mock('@app/core/services/auth.service', () => ({ AuthService: class {} }));
jest.mock('@app/core/services/analytics.service', () => ({ AnalyticsService: class {} }));
jest.mock('@app/shared/services/toast.service', () => ({ ToastService: class {} }));
jest.mock('@app/shared/services/logger.service', () => ({ LoggerService: class {} }));
jest.mock('@app/shared/services/confirm-dialog.service', () => ({ ConfirmDialogService: class {} }));
jest.mock('@app/features/quotation/services/quotation-form.service', () => ({ QuotationFormService: class {} }));
jest.mock('@app/features/quotation/services/image-upload.service', () => ({ ImageUploadService: class {} }));
jest.mock('@app/features/quotation/services/date-picker.service', () => ({ DatePickerService: class {} }));
jest.mock('../cloud/drive-cloud-api.service', () => ({
  DriveCloudApiService: class {}, DriveAuthorizationRequiredError: class extends Error {},
  DriveServiceUnavailableError: class extends Error {},
  DriveOperationNotSentError: class extends Error { constructor(readonly originalError: unknown) { super('not sent'); } },
}));

import { FormGroup } from '@angular/forms';
import { AuthService } from '@app/core/services/auth.service';
import { AnalyticsService } from '@app/core/services/analytics.service';
import { ToastService } from '@app/shared/services/toast.service';
import { LoggerService } from '@app/shared/services/logger.service';
import { ConfirmDialogService } from '@app/shared/services/confirm-dialog.service';
import { StorageService } from '@app/shared/services/storage.service';
import { QuotationStorageService } from '../services/quotation-storage.service';
import { QuotationTemplatesService } from '../services/quotation-templates.service';
import { QuotationFormService } from '../services/quotation-form.service';
import { CloudQuotationSyncService } from '../cloud/cloud-quotation-sync.service';
import { DriveCloudApiService, DriveAuthorizationRequiredError, DriveOperationNotSentError } from '../cloud/drive-cloud-api.service';
import { filterQuotationHistory } from './quotation-history/quotation-history.utils';
import { quotationStatusLabel } from '../utils/quotation-lifecycle';
import { createCloudQuotationRevision, createQuotationCloudSummary } from '../cloud/cloud-domain';
import { WebCryptoSha256HashProvider } from '../cloud/cloud-hash';
import { QuotationGeneratorComponent } from './quotation-generator.component';
import { QuotationData } from '../models/quotation.model';
import { CloudQuotationRevision } from '../cloud/cloud-contracts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function quote(): QuotationData {
  return { customerCompany: '合成客戶', quoterName: '合成報價者', quoterEmail: 'q@example.test',
    startDate: '2026-09-12', serviceItems: [{ item: '服務', price: 100, count: 1, amount: 100 }],
    excludingTax: 100, tax: 5, includingTax: 105, isSign: false,
    quotationId: '', quotationNumber: '', status: 'draft', businessVersion: 1, previousVersions: [] };
}
class FormBoundary {
  value = quote();
  dirty = true;
  invalid = false;
  getRawValue() { return structuredClone(this.value); }
  patchValue(value: Partial<QuotationData>) { Object.assign(this.value, structuredClone(value)); }
  get(key: keyof QuotationData) { return { setValue: (value: unknown) => { (this.value as unknown as Record<string, unknown>)[key] = value; } }; }
  markAsDirty() { this.dirty = true; }
  markAsPristine() { this.dirty = false; }
  markAllAsTouched() {}
}

async function harness(cloud = true, sharedFiles?: Map<string, CloudQuotationRevision<QuotationData>>) {
  dependencies.clear(); effects.length = 0;
  // Node's structuredClone creates host-realm objects in Jest; use the browser's
  // same-realm JSON-data behavior for quotation fixtures.
  globalThis.structuredClone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  const local = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => local.set(key, value),
    removeItem: (key: string) => local.delete(key),
  } });
  let owner: string | null = 'owner-A';
  let role = 'premium';
  const auth = { currentUser: () => owner ? { uid: owner } : null,
    userData: () => owner ? { platforms: { quotation: { role } } } : null,
    userId: () => owner, userEmail: () => owner ? `${owner}@example.test` : null,
    isAuthenticated: () => !!owner, isPremium: () => role === 'premium', isAdmin: () => role === 'admin',
    loginWithGoogle: jest.fn() };
  const toast = { error: jest.fn(), warning: jest.fn(), success: jest.fn(), info: jest.fn() };
  dependencies.set(AuthService, auth); dependencies.set(ToastService, toast);
  dependencies.set(LoggerService, { error: jest.fn(), warn: jest.fn() });
  dependencies.set(AnalyticsService, { trackQuotationGenerated: jest.fn(), trackHistoryDeleted: jest.fn(), trackHistoryLoaded: jest.fn() });
  const confirm = jest.fn(async () => true);
  dependencies.set(ConfirmDialogService, { confirm });
  dependencies.set(QuotationFormService, { loadQuotationData: (form: FormBoundary, data: QuotationData) => form.patchValue(data),
    resetForm: (form: FormBoundary) => { form.value = quote(); } });
  dependencies.set(StorageService, new StorageService());
  const storage = new QuotationStorageService();
  dependencies.set(QuotationStorageService, storage);
  dependencies.set(QuotationTemplatesService, new QuotationTemplatesService());
  const files = sharedFiles ?? new Map<string, CloudQuotationRevision<QuotationData>>();
  const accepted = deferred<void>();
  let loseNextResponse = false;
  let loseAuthResponse = false;
  let receiptGate: ReturnType<typeof deferred<void>> | undefined;
  const api = {
    disconnect: jest.fn(), isConfigured: () => true, restoreConnection: async () => true, beginConnect: async (): Promise<void> => undefined,
    listRevisions: async (sub: string) => ({ nextPageToken: null, files: [...files].filter(([, r]) => r.ownerSub === sub).map(([fileId, r]) => ({
      fileId, name: '報價單 合成客戶', quotationId: r.quotationId, revisionId: r.revisionId,
      parentRevisionIds: r.parentRevisionIds, kind: r.kind, createdAt: r.createdAt,
      quotationNumber: r.payload?.quotationNumber, status: r.payload?.status,
    })) }),
    getRevision: jest.fn(async (id: string) => files.get(id)),
    createOperation: jest.fn(async (r: CloudQuotationRevision<QuotationData>) => {
      const existing = [...files].find(([, prior]) => prior.operationId === r.operationId);
      const fileId = existing?.[0] ?? `file-${files.size}`;
      if (!existing) files.set(fileId, r);
      accepted.resolve();
      if (receiptGate) { const gate = receiptGate; receiptGate = undefined; await gate.promise; }
      if (loseNextResponse) { loseNextResponse = false; throw new Error('accepted; response lost'); }
      if (loseAuthResponse) { loseAuthResponse = false; throw new DriveAuthorizationRequiredError(); }
      return { operationId: r.operationId, quotationId: r.quotationId, revisionId: r.revisionId,
        driveFileId: fileId, status: existing ? 'replayed' : 'accepted', idempotent: !!existing };
    }),
  };
  dependencies.set(DriveCloudApiService, api);
  const sync = new CloudQuotationSyncService();
  dependencies.set(CloudQuotationSyncService, sync);
  const component = new QuotationGeneratorComponent();
  const form = new FormBoundary(); component.form = form as unknown as FormGroup;
  effects.forEach((fn) => fn());
  await component.onCloudSyncToggle(cloud);
  effects.forEach((fn) => fn());
  return { component, form, sync, storage, toast, api, files, confirm, auth, accepted: accepted.promise,
    setRole: async (next: string) => {
      role = next; effects.forEach((fn) => fn());
      await new Promise<void>((resolve) => setImmediate(resolve)); effects.forEach((fn) => fn());
    },
    flushEffects: () => effects.forEach((fn) => fn()),
    loseAuthResponse: () => { loseAuthResponse = true; },
    changeAuthBeforeEffect: (next: string | null) => { owner = next; },
    loseResponse: () => { loseNextResponse = true; },
    holdReceipt: () => { receiptGate = deferred<void>(); return receiptGate; },
    setOwner: async (next: string | null) => {
      // Drive/auth boundary change runs the component's real registered effect.
      owner = next; effects.forEach((fn) => fn());
      await new Promise<void>((resolve) => setImmediate(resolve));
      effects.forEach((fn) => fn());
    },
  };
}

describe('QuotationGeneratorComponent submission lifecycle integration', () => {
  it('贊助會員預設進階版，手動切換模式不會變更正在編輯的報價資料', async () => {
    const h = await harness(false);
    const before = editorState(h);

    expect(h.component.showAdvancedFeatures()).toBe(true);
    h.component.setAdvancedMode(false);
    expect(h.component.showAdvancedFeatures()).toBe(false);
    expect(editorState(h)).toEqual(before);

    h.component.setAdvancedMode(true);
    expect(h.component.showAdvancedFeatures()).toBe(true);
    expect(editorState(h)).toEqual(before);
  });

  it('失去贊助資格時安全退回簡易版，且保留現有報價的資料與狀態', async () => {
    const h = await harness(false);
    h.component.quotationNumber.set('Q-MODE-KEEP');
    h.form.patchValue({ quotationNumber: 'Q-MODE-KEEP', status: 'sent', businessVersion: 2 });
    h.component.onStatusChange({ target: { value: 'sent' } } as unknown as Event);
    const before = editorState(h);

    await h.setRole('free');

    expect(h.component.showAdvancedFeatures()).toBe(false);
    expect(editorState(h)).toEqual(before);
  });

  it('免費會員不可直接切換為進階版，但可開啟進階功能介紹彈窗並導向贊助', async () => {
    const h = await harness(false);
    await h.setRole('free');

    // 免費會員無法透過 setAdvancedMode 啟用進階功能
    expect(h.component.showAdvancedFeatures()).toBe(false);
    h.component.setAdvancedMode(true);
    expect(h.component.showAdvancedFeatures()).toBe(false);

    // 點擊開啟進階功能介紹彈窗
    expect(h.component.showAdvancedPromoModal()).toBe(false);
    h.component.openAdvancedPromoModal();
    expect(h.component.showAdvancedPromoModal()).toBe(true);

    // 關閉彈窗
    h.component.closeAdvancedPromoModal();
    expect(h.component.showAdvancedPromoModal()).toBe(false);

    // 已登入免費會員點擊贊助時關閉彈窗
    h.component.openAdvancedPromoModal();
    expect(h.component.showAdvancedPromoModal()).toBe(true);
    h.component.goToDonation();
    expect(h.component.showAdvancedPromoModal()).toBe(false);
  });

  it('未登入訪客點擊前往贊助時調用 Google 登入', async () => {
    const h = await harness(false);
    await h.setOwner(null);

    h.component.openAdvancedPromoModal();
    expect(h.component.showAdvancedPromoModal()).toBe(true);

    h.component.goToDonation();
    expect(h.component.showAdvancedPromoModal()).toBe(false);
    expect(h.auth.loginWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('免費會員保留本機歷史，但不載入舊資料匯入', async () => {
    const h = await harness(false);
    h.storage.saveToHistory(quote(), 'quotation');
    await h.component.onSubmit();
    const storedBeforeDowngrade = structuredClone(h.storage.getHistory('quotation:user:owner-A'));

    await h.setRole('free');

    expect(h.component.historyData()).toEqual(storedBeforeDowngrade);
    expect(h.component.localHistoryData()).toEqual(storedBeforeDowngrade);
    expect(h.component.legacyCandidates()).toEqual([]);

    h.form.patchValue({ customerCompany: '免費會員仍可寫入歷史' });
    await h.component.onSaveAsNew();

    expect(h.storage.getHistory('quotation:user:owner-A')).toHaveLength(2);
    expect(h.storage.getLegacyHistory()).toHaveLength(1);
  });

  async function coldCloudEditor(blank = true) {
    const a = await harness(); a.component.quotationNumber.set('Q-COLD-LOAD');
    a.component.onStatusChange({ target: { value: 'sent' } } as unknown as Event);
    await a.component.onSubmit(); a.component.onCreateNextBusinessVersion(); await a.component.onSubmit();
    const saved = structuredClone(a.component.savedBusinessVersion()!);
    const h = await harness(true, a.files);
    if (blank) h.form.patchValue({ quotationId: '', quotationNumber: '', customerCompany: '', quoterName: '', quoterEmail: '', serviceItems: [] });
    h.form.markAsPristine();
    const gate = deferred<void>(); const get = h.api.getRevision.getMockImplementation()!;
    h.api.getRevision.mockImplementation(async (id) => { await gate.promise; return get(id); });
    return { ...h, gate, saved };
  }

  function serializeEditor(h: Awaited<ReturnType<typeof harness>>) {
    return (h.component as unknown as { serializeCurrentFormData(): string }).serializeCurrentFormData();
  }

  it('blank editor serialization is deterministic, keeps raw empty ID and allocates no editor identity', async () => {
    const h = await coldCloudEditor(); const before = editorState(h);
    const first = serializeEditor(h); const second = serializeEditor(h);
    expect(first).toBe(second); expect(JSON.parse(first).quotationId).toBe('');
    expect(editorState(h)).toEqual(before);
  });

  it('cold cloud load into a truly blank raw-ID editor succeeds after delayed read and then updates the same document', async () => {
    const h = await coldCloudEditor(); const loading = h.component.onLoadHistory(0);
    await new Promise<void>((resolve) => setImmediate(resolve));
    h.gate.resolve(); await loading;
    expect(h.form.value.quotationId).toBe(h.saved.quotationId);
    expect(h.component.quotationNumber()).toBe('Q-COLD-LOAD');
    expect(h.component.quotationBusinessVersion()).toBe(2); expect(h.form.dirty).toBe(false);
    h.form.patchValue({ customerCompany: 'loaded then edited' }); h.form.markAsDirty(); await h.component.onSubmit();
    expect(new Set([...h.files.values()].map((entry) => entry.quotationId)).size).toBe(1);
    expect(h.component.selectedHistoryId()).toBe(h.saved.quotationId);
  });

  it.each(['text', 'image', 'template'] as const)('delayed blank cloud load preserves a real %s edit', async (mode) => {
    const h = await coldCloudEditor(); const loading = h.component.onLoadHistory(0);
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (mode === 'image') h.component.customerLogo.set('data:image/png;base64,c3ludGhldGlj');
    else if (mode === 'template') h.component.applyCustomerTemplate({ id: 'fixture', name: 'template', customerCompany: 'template customer' } as never);
    else h.form.patchValue({ customerCompany: 'typed while loading' });
    h.form.markAsDirty(); const before = serializeEditor(h);
    h.gate.resolve(); await loading;
    expect(serializeEditor(h)).toBe(before); expect(h.form.dirty).toBe(true);
    expect(h.component.savedBusinessVersion()).toBeNull();
  });

  it.each(['owner', 'repository', 'epoch'] as const)('delayed cloud load rejects a %s transition, including identical editor bytes', async (mode) => {
    const h = await coldCloudEditor(false); const before = serializeEditor(h);
    const loading = h.component.onLoadHistory(0);
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (mode === 'owner') await h.setOwner('owner-B');
    else if (mode === 'repository') await h.component.onCloudSyncToggle(false);
    else { await h.component.onCreateNewForm(); expect(serializeEditor(h)).toBe(before); }
    const state = editorState(h);
    h.gate.resolve(); await loading;
    expect(editorState(h)).toEqual(state); expect(h.component.savedBusinessVersion()).toBeNull();
  });

  it('viewed old version with intentionally cleared raw ID remains a pure snapshot until loading', async () => {
    const h = await coldCloudEditor();
    await h.component.onViewBusinessVersion(h.saved.previousVersions![0]);
    h.form.patchValue({ quotationId: '' });
    const before = editorState(h); const snapshot = serializeEditor(h);
    expect(serializeEditor(h)).toBe(snapshot); expect(JSON.parse(snapshot).quotationId).toBe('');
    expect(editorState(h)).toEqual(before);
    h.gate.resolve(); await h.component.onLoadHistory(0);
    expect(h.form.value.quotationId).toBe(h.saved.quotationId);
    expect(h.component.quotationBusinessVersion()).toBe(2);
  });

  it.each(['text', 'owner', 'repository', 'epoch'] as const)('history confirmation rejects a %s change before fetching', async (mode) => {
    const h = await coldCloudEditor(false); h.form.markAsDirty();
    const confirmation = deferred<boolean>(); h.confirm.mockReturnValueOnce(confirmation.promise);
    const loading = h.component.onLoadHistory(0);
    if (mode === 'text') h.form.patchValue({ customerCompany: 'edited during confirmation' });
    else if (mode === 'owner') await h.setOwner('owner-B');
    else if (mode === 'repository') await h.component.onCloudSyncToggle(false);
    else await h.component.onCreateNewForm();
    const before = editorState(h);
    h.gate.resolve(); confirmation.resolve(true); await loading;
    expect(h.api.getRevision).not.toHaveBeenCalled(); expect(editorState(h)).toEqual(before);
  });

  function legacyQuote(company: string): QuotationData {
    const data = { ...quote(), customerCompany: company };
    for (const key of ['quotationId', 'quotationNumber', 'status', 'businessVersion', 'previousVersions'] as const) delete data[key];
    return data;
  }

  function cloudToggleControl(h: Awaited<ReturnType<typeof harness>>) {
    const dom = new (require('jsdom').JSDOM)('<input type="checkbox">');
    const control = dom.window.document.querySelector('input') as HTMLInputElement;
    control.checked = h.component.isCloudStorage();
    let pending: Promise<void>;
    control.addEventListener('change', (event) => { pending = h.component.onCloudSyncToggleChange(event); });
    return { control, close: () => dom.window.close(), click: () => { control.click(); return pending!; } };
  }

  it.each(['restore-false', 'popup-closed', 'success'] as const)('native checkbox click reconciles %s with actual repository and preserves cancelled local edits', async (mode) => {
    const h = await harness(false); await h.component.onSubmit(); await h.component.onLoadHistory(0);
    h.form.patchValue({ customerCompany: 'dirty local editor' }); h.form.markAsDirty();
    const before = editorState(h); const raw = localStorage.getItem('quotation:user:owner-A');
    const gate = deferred<boolean>(); h.api.restoreConnection = () => gate.promise;
    const toggle = cloudToggleControl(h); const operation = toggle.click();
    expect(toggle.control.checked).toBe(false); expect(editorState(h)).toEqual(before);
    gate.resolve(mode === 'success'); await operation;
    if (mode === 'popup-closed') {
      h.api.beginConnect = async () => { throw new Error('popup_closed'); };
      await h.component.onDriveConnect();
    }
    expect(toggle.control.checked).toBe(mode === 'success');
    expect(toggle.control.checked).toBe(h.component.isCloudStorage());
    if (mode !== 'success') {
      expect(editorState(h)).toEqual(before); expect(localStorage.getItem('quotation:user:owner-A')).toBe(raw);
      await h.component.onSubmit();
      const records = h.storage.getHistory('quotation:user:owner-A');
      expect(records).toHaveLength(1); expect(records[0].quotationId).toBe(before.id);
      expect(records[0].customerCompany).toBe('dirty local editor');
    }
    toggle.close();
  });

  it.each(['owner', 'detached', 'newer-request'] as const)('native toggle late completion handles %s without restoring stale requested state', async (mode) => {
    const h = await harness(false); const gate = deferred<boolean>(); h.api.restoreConnection = () => gate.promise;
    const toggle = cloudToggleControl(h); const pending = toggle.click();
    if (mode === 'owner') { h.api.restoreConnection = async () => false; await h.setOwner('owner-B'); }
    else if (mode === 'detached') { toggle.control.remove(); toggle.control.checked = true; }
    else {
      h.api.restoreConnection = async () => false;
      await toggle.click();
    }
    gate.resolve(true); await pending;
    expect(toggle.control.checked).toBe(mode === 'detached' ? true : h.component.isCloudStorage());
    if (mode !== 'detached') expect(h.component.isCloudStorage()).toBe(false);
    toggle.close();
  });

  it('raw no-ID legacy restore → real load → update keeps one logical record and persists stable identity', async () => {
    const h = await harness(false); await h.setOwner(null);
    const raw = JSON.stringify([legacyQuote('restored legacy')]);
    localStorage.setItem('quotation:visitor', '{broken');
    await h.component.restoreRecoveryBackup({ text: async () => raw } as File);
    expect(localStorage.getItem('quotation:visitor')).toBe(raw);
    await h.component.onCloudSyncToggle(false); // Real coordinator re-reads persisted legacy data.
    await h.component.onLoadHistory(0); const id = h.component.selectedHistoryId();
    h.form.patchValue({ customerCompany: 'edited restored legacy' }); h.form.markAsDirty();
    await h.component.onSubmit();
    const history = new QuotationStorageService().getHistory('quotation:visitor');
    expect(history).toHaveLength(1); expect(history[0].quotationId).toBe(id);
    expect(history[0].customerCompany).toBe('edited restored legacy');
    expect(h.component.selectedHistoryId()).toBe(id);
  });

  it.each([0, 1, 2, 3])('full target existing1 + claimed4 updates selected legacy %s after UI reorder/search without eviction or duplicate', async (selected) => {
    const h = await harness(false); await h.setOwner(null);
    await h.component.onSubmit(); const existing = h.storage.getHistory('quotation:visitor')[0];
    const raw = JSON.stringify(Array.from({ length: 6 }, (_, i) => legacyQuote(`legacy-${i}`)));
    localStorage.setItem('quotation', raw);
    localStorage.setItem('quotation:user:untouched', 'untouched bytes');
    h.component.claimSelectedLegacyHistory([0, 1, 2, 3]);
    await h.component.onCloudSyncToggle(false);
    const ledger = JSON.parse(localStorage.getItem('quotation:visitor')!).legacyClaims;
    const firstIds = h.storage.getHistory('quotation:visitor').map((entry) => entry.quotationId);
    h.component.historyData.update((history) => [...history].reverse());
    const match = filterQuotationHistory(h.component.historyData(), `legacy-${selected}`)[0];
    await h.component.onLoadHistory(match.originalIndex); const id = h.component.selectedHistoryId();
    h.form.patchValue({ customerCompany: `edited-${selected}` }); h.form.markAsDirty();
    await h.component.onSubmit();
    const history = new QuotationStorageService().getHistory('quotation:visitor');
    expect(history).toHaveLength(5); expect(new Set(history.map((item) => item.quotationId)).size).toBe(5);
    expect(history.map((entry) => entry.quotationId)).toEqual(firstIds);
    expect(history.find((entry) => entry.quotationId === existing.quotationId)).toEqual(existing);
    expect(history.find((entry) => entry.quotationId === id)?.customerCompany).toBe(`edited-${selected}`);
    const after = localStorage.getItem('quotation:visitor');
    h.component.claimSelectedLegacyHistory([0, 1, 2, 3]);
    expect(localStorage.getItem('quotation:visitor')).toBe(after);
    h.component.claimSelectedLegacyHistory([4]); // Full target must reject unclaimed source.
    expect(localStorage.getItem('quotation:visitor')).toBe(after);
    expect(JSON.parse(after!).legacyClaims).toEqual(ledger);
    expect(localStorage.getItem('quotation')).toBe(raw);
    expect(localStorage.getItem('quotation:user:untouched')).toBe('untouched bytes');
  });

  it.each(['missing', 'changed', 'selection-missing', 'write-failed'] as const)('selected update %s never falls back to add/evict and retains editor', async (mode) => {
    const h = await harness(false); await h.setOwner(null);
    for (let i = 0; i < 5; i++) {
      if (i) await h.component.onCreateNewForm();
      h.form.patchValue({ customerCompany: `saved-${i}` }); await h.component.onSubmit();
    }
    await h.component.onLoadHistory(2);
    h.form.patchValue({ customerCompany: 'unsaved edit to keep' }); h.form.markAsDirty();
    const scope = 'quotation:visitor';
    if (mode === 'selection-missing') h.component.coordinator.setSelectedStorage(null);
    if (mode === 'missing' || mode === 'changed') {
      const envelope = JSON.parse(localStorage.getItem(scope)!);
      if (mode === 'missing') envelope.records[2].quotationId = 'replacement-document';
      else envelope.records[2].customerCompany = 'newer edit in another tab';
      localStorage.setItem(scope, JSON.stringify(envelope));
    }
    const raw = localStorage.getItem(scope); const state = editorState(h);
    const write = mode === 'write-failed'
      ? jest.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('disk full'); }) : null;
    try { await h.component.onSubmit(); } finally { write?.mockRestore(); }
    expect(localStorage.getItem(scope)).toBe(raw);
    expect(editorState(h)).toEqual(state);
    expect(h.storage.getHistory(scope)).toHaveLength(5);
  });

  async function loadedLocal() {
    const h = await harness(false);
    h.component.quotationNumber.set('Q-LOCAL');
    h.component.onStatusChange({ target: { value: 'sent' } } as unknown as Event);
    await h.component.onSubmit(); h.component.onCreateNextBusinessVersion();
    await h.component.onSubmit(); await h.component.onLoadHistory(0);
    return h;
  }

  function editorState(h: Awaited<ReturnType<typeof harness>>) {
    return { form: h.form.getRawValue(), dirty: h.form.dirty,
      number: h.component.quotationNumber(), status: h.component.quotationStatus(),
      version: h.component.quotationBusinessVersion(), baseline: structuredClone(h.component.savedBusinessVersion()),
      id: h.component.selectedHistoryId(), index: h.component.selectedHistoryIndex(),
      storage: h.component.coordinator.getSelectedStorage(),
    };
  }

  it.each(['local-preference', 'restore-false', 'restore-throw'])('same-owner initializeStorageRoute via role change preserves complete local editor when %s', async (mode) => {
    const h = await loadedLocal();
    if (mode !== 'local-preference') {
      h.api.restoreConnection = async () => {
        if (mode === 'restore-throw') throw new Error('restore unavailable');
        return false;
      };
      await h.component.onCloudSyncToggle(true);
    }
    h.component.quotationNumber.set('Q-ROLE-EDIT'); h.form.patchValue({ quotationNumber: 'Q-ROLE-EDIT' });
    h.component.onStatusChange({ target: { value: 'won' } } as unknown as Event);
    const before = editorState(h);
    await h.setRole('admin');
    expect(editorState(h)).toEqual(before);
    await h.component.onSubmit();
    const history = h.storage.getHistory('quotation:user:owner-A');
    expect(history).toHaveLength(1); expect(history[0].quotationId).toBe(before.id);
  });

  it.each(['cancel', 'connect-throw', 'restore-false', 'restore-throw', 'no-authorization'])('failed first cloud attempt %s preserves complete loaded local editor and subsequent save updates', async (mode) => {
    for (const dirty of [false, true]) {
      const h = await loadedLocal();
      if (dirty) {
        h.component.quotationNumber.set('Q-LOCAL-EDIT'); h.form.patchValue({ quotationNumber: 'Q-LOCAL-EDIT' });
        h.component.onStatusChange({ target: { value: 'won' } } as unknown as Event);
      }
      const before = editorState(h);
      if (mode === 'cancel' || mode === 'connect-throw') {
        h.api.beginConnect = async () => { throw mode === 'cancel' ? new DriveAuthorizationRequiredError('cancel') : new Error('broker unavailable'); };
        await h.component.onDriveConnect();
      } else {
        h.api.restoreConnection = async () => {
          if (mode === 'restore-throw') throw new Error('restore unavailable');
          if (mode === 'no-authorization') throw new DriveAuthorizationRequiredError('no grant');
          return false;
        };
        await h.component.onCloudSyncToggle(true);
      }
      h.flushEffects();
      expect(editorState(h)).toEqual(before);
      await h.component.onSubmit();
      const history = h.storage.getHistory('quotation:user:owner-A');
      expect(history).toHaveLength(1); expect(history[0].quotationId).toBe(before.id);
      expect(history[0].previousVersions).toEqual(before.form.previousVersions);
      expect(history[0].quotationNumber).toBe(before.number); expect(history[0].status).toBe(before.status);
    }
  });

  it.each(['connect', 'toggle'] as const)('%s failure does not restore a stale snapshot over edits made during authorization', async (mode) => {
    const h = await loadedLocal(); const gate = deferred<void>();
    const failure = async () => { await gate.promise; throw new DriveAuthorizationRequiredError('cancel'); };
    h.api.beginConnect = failure; h.api.restoreConnection = failure;
    const pending = mode === 'connect' ? h.component.onDriveConnect() : h.component.onCloudSyncToggle(true);
    h.form.patchValue({ customerCompany: 'typed during authorization', quotationNumber: 'Q-LATER' });
    h.component.quotationNumber.set('Q-LATER');
    h.component.onStatusChange({ target: { value: 'lost' } } as unknown as Event);
    const during = editorState(h);
    gate.resolve(); await pending; h.flushEffects();
    expect(editorState(h)).toEqual(during);
    await h.component.onSubmit(); expect(h.storage.getHistory('quotation:user:owner-A')).toHaveLength(1);
  });

  it.each(['connect', 'toggle'] as const)('successful first %s commits cross-repository identity change once, retaining later editor content', async (mode) => {
    const h = await loadedLocal(); const localId = h.component.selectedHistoryId();
    const gate = deferred<void>();
    h.api.beginConnect = () => gate.promise;
    h.api.restoreConnection = async () => { await gate.promise; return true; };
    const pending = mode === 'connect' ? h.component.onDriveConnect() : h.component.onCloudSyncToggle(true);
    expect(h.component.selectedHistoryId()).toBe(localId);
    h.form.patchValue({ customerCompany: 'latest content' }); h.form.markAsDirty();
    gate.resolve(); await pending; h.flushEffects();
    expect(h.form.value.customerCompany).toBe('latest content');
    expect(h.component.selectedHistoryId()).toBeNull(); expect(h.component.savedBusinessVersion()).toBeNull();
    expect(h.component.quotationNumber()).toBe(''); expect(h.component.quotationStatus()).toBe('draft');
    await h.component.onSubmit(); const saved = editorState(h); h.flushEffects();
    expect(editorState(h)).toEqual(saved);
    expect(h.component.selectedHistoryId()).not.toBe(localId);
    expect(h.storage.getHistory('quotation:user:owner-A')).toHaveLength(1);
  });

  it.each(['connect', 'toggle'] as const)('first %s late receipt cannot change owner B local identity', async (mode) => {
    const h = await loadedLocal(); const gate = deferred<void>();
    h.api.beginConnect = () => gate.promise;
    h.api.restoreConnection = async () => { await gate.promise; return true; };
    const pending = mode === 'connect' ? h.component.onDriveConnect() : h.component.onCloudSyncToggle(true);
    h.changeAuthBeforeEffect('owner-B');
    await h.component.onCloudSyncToggle(false); await h.component.onSubmit();
    const before = editorState(h);
    gate.resolve(); await pending;
    expect(editorState(h)).toEqual(before);
    expect(h.files.size).toBe(0);
  });

  it.each(['connect', 'toggle'] as const)('%s completion/effect cannot detach a new cloud save made after authorization but before listing returns', async (mode) => {
    const h = await loadedLocal(); const gate = deferred<void>();
    h.api.listRevisions = async () => { await gate.promise; return { files: [], nextPageToken: null }; };
    const connecting = mode === 'connect' ? h.component.onDriveConnect() : h.component.onCloudSyncToggle(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(h.sync.isCloudRepository()).toBe(true);
    // A real save can be clicked before Angular's repository effect is flushed.
    await h.component.onSubmit();
    h.form.patchValue({ customerCompany: 'new edit after cloud save', quotationNumber: 'Q-CLOUD-EDIT' });
    h.component.quotationNumber.set('Q-CLOUD-EDIT'); h.form.markAsDirty();
    const before = editorState(h);
    gate.resolve(); await connecting; h.flushEffects();
    expect(editorState(h)).toEqual(before);
    expect(h.files.size).toBe(1);
  });
  it('cold device B searches device A listing, duplicate cancellation/acceptance requires no per-item payload download', async () => {
    const a = await harness(); a.component.quotationNumber.set('Q-COLD');
    a.component.onStatusChange({ target: { value: 'sent' } } as unknown as Event);
    await a.component.onSubmit();
    const b = await harness(true, a.files);
    expect(filterQuotationHistory(b.component.historyData(), 'Q-COLD')).toHaveLength(1);
    expect(filterQuotationHistory(b.component.historyData(), '已送出')).toHaveLength(1);
    b.component.quotationNumber.set('Q-COLD'); b.confirm.mockResolvedValueOnce(false);
    await b.component.onSubmit(); expect(b.files.size).toBe(1);
    b.confirm.mockResolvedValueOnce(true); await b.component.onSubmit(); expect(b.files.size).toBe(2);
    expect(b.api.getRevision).not.toHaveBeenCalled();
  });

  it.each(['owner-B', 'local'] as const)('duplicate confirmation cannot submit captured data after %s switch', async (target) => {
    const h = await harness(); h.component.quotationNumber.set('Q-GUARD'); await h.component.onSubmit();
    await h.component.onCreateNewForm(); h.component.quotationNumber.set('Q-GUARD');
    const gate = deferred<boolean>(); h.confirm.mockReturnValueOnce(gate.promise);
    const saving = h.component.onSubmit(); await new Promise<void>((resolve) => setImmediate(resolve));
    if (target === 'local') await h.component.onCloudSyncToggle(false); else await h.setOwner(target);
    gate.resolve(true); await saving;
    expect(h.files.size).toBe(1); expect(h.component.savedBusinessVersion()).toBeNull();
  });
  it.each([false, true])('cloud=%s duplicate number cancel writes nothing; accept creates, own update does not warn', async (cloud) => {
    const h = await harness(cloud);
    h.component.quotationNumber.set('Q-001'); await h.component.onSubmit();
    await h.component.onCreateNewForm();
    h.component.quotationNumber.set('Q-001'); h.form.markAsDirty();
    h.confirm.mockClear(); h.confirm.mockResolvedValueOnce(false);
    await h.component.onSubmit();
    expect(h.confirm).toHaveBeenCalledTimes(1);
    expect(h.form.dirty).toBe(true);
    expect(cloud ? h.files.size : h.storage.getHistory('quotation:user:owner-A').length).toBe(1);
    h.confirm.mockResolvedValueOnce(true); await h.component.onSubmit();
    expect(cloud ? h.files.size : h.storage.getHistory('quotation:user:owner-A').length).toBe(2);
    // Change to a unique number, then update that same document with no duplicate dialog.
    h.component.quotationNumber.set('Q-002'); await h.component.onSubmit();
    h.confirm.mockClear(); await h.component.onSubmit();
    expect(h.confirm).not.toHaveBeenCalled();
  });

  it.each(['draft', 'sent', 'won', 'lost'] as const)('status %s survives actual save/reload/load and is searchable by Chinese and code', async (status) => {
    for (const cloud of [false, true]) {
      const h = await harness(cloud);
      h.component.quotationNumber.set('Q-STATUS');
      h.component.onStatusChange({ target: { value: status } } as unknown as Event);
      await h.component.onSubmit();
      if (cloud) await h.component.onDriveConnect();
      else await h.component.onCreateNewForm();
      expect(filterQuotationHistory(h.component.historyData(), quotationStatusLabel(status))).toHaveLength(1);
      expect(filterQuotationHistory(h.component.historyData(), status)).toHaveLength(1);
      expect(filterQuotationHistory(h.component.historyData(), 'Q-STATUS')).toHaveLength(1);
      await h.component.onLoadHistory(0);
      expect(h.component.quotationStatus()).toBe(status);
      expect(h.component.savedBusinessVersion()?.status).toBe(status);
    }
  });

  it('true generator resolves two concurrent heads with both parents, reload leaves one head and all old revisions', async () => {
    const h = await harness(); await h.component.onSubmit();
    const base = [...h.files.values()][0];
    for (const [revisionId, company, createdAt] of [
      ['rA', 'device A', '2026-09-12T10:01:00.000Z'],
      ['rB', 'device B', '2026-09-12T10:02:00.000Z'],
    ]) {
      const payload = { ...base.payload, customerCompany: company };
      const revision = await createCloudQuotationRevision({ schemaVersion: 2, ownerSub: base.ownerSub,
        quotationId: base.quotationId, revisionId, operationId: `op-${revisionId}`, kind: 'update',
        parentRevisionIds: [base.revisionId], createdAt, payload, summary: createQuotationCloudSummary(payload),
      }, new WebCryptoSha256HashProvider());
      await h.api.createOperation(revision);
    }
    await h.component.onDriveConnect();
    expect(h.sync.history()).toHaveLength(1);
    expect(h.sync.history()[0].headRevisionIds).toEqual(['rA', 'rB']);
    await h.component.onLoadHistory(0);
    expect(h.form.value.customerCompany).toBe('device B');
    h.form.patchValue({ customerCompany: 'resolution' }); h.form.markAsDirty();
    await h.component.onSubmit(); const resolved = [...h.files.values()].at(-1)!;
    expect(resolved.parentRevisionIds).toEqual(['rA', 'rB']);
    expect(resolved.quotationId).toBe(base.quotationId);
    await h.component.onDriveConnect();
    expect(h.sync.history()).toHaveLength(1);
    expect(h.sync.history()[0].headRevisionIds).toEqual([resolved.revisionId]);
    expect(h.files.size).toBe(4);
    expect([...h.files.values()][0]).toEqual(base);
  });

  it('definitely-not-sent auth failure retains existing identity through reconnect then sends edited content', async () => {
    const h = await harness(); await h.component.onSubmit(); const id = h.form.value.quotationId;
    h.api.createOperation.mockRejectedValueOnce(new DriveOperationNotSentError(new DriveAuthorizationRequiredError()));
    await h.component.onSubmit(); h.flushEffects();
    expect(h.component.submissionUncertain()).toBe(false); expect(h.files.size).toBe(1);
    h.form.patchValue({ customerCompany: 'new edit after not sent' }); h.form.markAsDirty();
    await h.component.onDriveConnect(); expect(h.files.size).toBe(1);
    await h.component.onSubmit();
    expect(h.form.value.quotationId).toBe(id);
    expect([...h.files.values()].at(-1)?.payload.customerCompany).toBe('new edit after not sent');
  });

  it('cancelled reconnect preserves unknown operation and a later reconnect replays it', async () => {
    const h = await harness(); h.loseAuthResponse(); await h.component.onSubmit();
    h.api.beginConnect = jest.fn().mockRejectedValueOnce(new DriveAuthorizationRequiredError('cancelled')).mockResolvedValue(undefined);
    await h.component.onDriveConnect(); h.flushEffects();
    expect(h.component.submissionUncertain()).toBe(true); expect(h.files.size).toBe(1);
    await h.component.onDriveConnect();
    expect(h.component.submissionUncertain()).toBe(false); expect(h.files.size).toBe(1);
  });

  it.each(['owner-B', null, 'local'] as const)('late reconnect after switch to %s cannot restore old pending/baseline', async (target) => {
    const h = await harness(); h.loseAuthResponse(); await h.component.onSubmit();
    const gate = deferred<void>(); h.api.beginConnect = () => gate.promise;
    const connecting = h.component.onDriveConnect();
    if (target === 'local') await h.component.onCloudSyncToggle(false);
    else await h.setOwner(target);
    gate.resolve(); await connecting; h.flushEffects();
    expect(h.component.savedBusinessVersion()).toBeNull();
    expect(h.component.selectedHistoryId()).toBeNull();
    expect(h.component.submissionUncertain()).toBe(false);
    expect(h.files.size).toBe(1);
  });
  it.each([false, true])('cloud=%s snapshot cancel preserves editor, confirmed snapshot saves a new document', async (cloud) => {
    const h = await harness(cloud);
    h.component.onStatusChange({ target: { value: 'sent' } } as unknown as Event);
    await h.component.onSubmit();
    h.form.patchValue({ customerCompany: 'v2 edit before next version' }); h.form.markAsDirty();
    h.component.onCreateNextBusinessVersion(); await h.component.onSubmit();
    const baseline = structuredClone(h.component.savedBusinessVersion()!);
    const snapshot = baseline.previousVersions![0];
    expect(snapshot.data.customerCompany).toBe('合成客戶');
    h.form.patchValue({ customerCompany: 'dirty v2' }); h.form.markAsDirty();
    const before = h.form.getRawValue(); const selected = h.component.selectedHistoryId();
    h.confirm.mockResolvedValueOnce(false);
    await h.component.onViewBusinessVersion(snapshot);
    expect(h.form.getRawValue()).toEqual(before); expect(h.form.dirty).toBe(true);
    expect(h.component.savedBusinessVersion()).toEqual(baseline);
    expect(h.component.selectedHistoryId()).toBe(selected);
    await h.component.onViewBusinessVersion(snapshot);
    expect(h.form.value.customerCompany).toBe('合成客戶');
    expect(h.component.quotationStatus()).toBe('sent');
    await h.component.onSubmit();
    expect(h.form.value.quotationId).not.toBe(baseline.quotationId);
    expect(h.component.quotationStatus()).toBe('draft');
    expect(h.component.quotationBusinessVersion()).toBe(1);
    const history = cloud ? h.sync.history().map((entry) => entry.data) : h.storage.getHistory('quotation:user:owner-A');
    expect(history.find((entry) => entry.quotationId === baseline.quotationId)).toEqual(baseline);
  });

  it('snapshot confirmation cannot load owner A snapshot into owner B', async () => {
    const h = await harness(); await h.component.onSubmit();
    h.component.onCreateNextBusinessVersion(); await h.component.onSubmit();
    const snapshot = h.form.value.previousVersions![0];
    h.form.patchValue({ customerCompany: 'keep current edit' }); h.form.markAsDirty();
    const gate = deferred<boolean>(); h.confirm.mockReturnValueOnce(gate.promise);
    const viewing = h.component.onViewBusinessVersion(snapshot);
    await h.setOwner('owner-B'); gate.resolve(true); await viewing;
    expect(h.form.value.customerCompany).toBe('keep current edit');
    expect(h.component.savedBusinessVersion()).toBeNull();
  });
  it('same-owner actual reconnect replays accepted auth failure and retains later edits', async () => {
    const h = await harness(); await h.component.onSubmit();
    const id = h.form.value.quotationId;
    h.form.patchValue({ customerCompany: 'accepted update' }); h.form.markAsDirty();
    h.loseAuthResponse(); await h.component.onSubmit(); h.flushEffects();
    expect(h.component.submissionUncertain()).toBe(true);
    h.form.patchValue({ customerCompany: 'later edit' });
    await h.component.onDriveConnect(); h.flushEffects();
    expect(h.files.size).toBe(2);
    expect(h.form.value.quotationId).toBe(id);
    expect(h.form.value.customerCompany).toBe('later edit');
    expect(h.form.dirty).toBe(true);
    expect(h.component.savedBusinessVersion()?.customerCompany).toBe('accepted update');
    const calls = h.api.createOperation.mock.calls;
    expect(calls[1][0]).toEqual(calls[2][0]);
    await h.component.onSubmit();
    expect([...h.files.values()].at(-1)?.parentRevisionIds).toEqual([calls[1][0].revisionId]);
  });

  it('same-owner reconnect without pending preserves saved document and update semantics', async () => {
    const h = await harness(); await h.component.onSubmit();
    const id = h.form.value.quotationId;
    h.api.listRevisions = jest.fn(h.api.listRevisions).mockRejectedValueOnce(new DriveAuthorizationRequiredError());
    await expect(h.sync.reloadHistory()).rejects.toThrow(); h.flushEffects();
    h.form.patchValue({ customerCompany: 'reauthorized edit' });
    await h.component.onDriveConnect(); await h.component.onSubmit();
    expect(h.form.value.quotationId).toBe(id);
    expect([...h.files.values()].at(-1)?.kind).toBe('update');
  });
  it.each(['create', 'copy'] as const)('%s response loss then button retry keeps one document and operation', async (mode) => {
    const h = await harness();
    if (mode === 'copy') await h.component.onSubmit();
    const before = h.files.size;
    h.loseResponse();
    await (mode === 'copy' ? h.component.onSaveAsNew() : h.component.onSubmit());
    await (mode === 'copy' ? h.component.onSaveAsNew() : h.component.onSubmit());
    expect(h.files.size).toBe(before + 1);
    const calls = h.api.createOperation.mock.calls.slice(-2);
    expect(calls[0][0]).toEqual(calls[1][0]);
    expect(h.form.value.quotationId).toBe(calls[1][0].quotationId);
    expect(h.component.savedBusinessVersion()?.quotationId).toBe(h.form.value.quotationId);
  });

  it('edited content after response loss replays original before allowing an update from the accepted baseline', async () => {
    const h = await harness(); await h.component.onSubmit();
    h.form.patchValue({ customerCompany: 'first update' }); h.form.markAsDirty();
    h.loseResponse(); await h.component.onSubmit();
    const accepted = [...h.files.values()].at(-1)!;
    h.form.patchValue({ customerCompany: 'newer unsaved edit' });
    await h.component.onSubmit();
    expect(h.files.size).toBe(2);
    expect(h.form.value.customerCompany).toBe('newer unsaved edit');
    expect(h.form.dirty).toBe(true);
    expect(h.component.savedBusinessVersion()?.customerCompany).toBe('first update');
    await h.component.onSubmit();
    const next = [...h.files.values()].at(-1)!;
    expect(next.parentRevisionIds).toEqual([accepted.revisionId]);
    expect(next.payload.customerCompany).toBe('newer unsaved edit');
  });

  it('double click during deferred SHA hashing sends one operation', async () => {
    const h = await harness(); const gate = deferred<void>();
    const original = WebCryptoSha256HashProvider.prototype.hash;
    const spy = jest.spyOn(WebCryptoSha256HashProvider.prototype, 'hash').mockImplementation(async function(this: WebCryptoSha256HashProvider, value) {
      await gate.promise; return original.call(this, value);
    });
    try {
      const first = h.component.onSaveAsNew(); const second = h.component.onSaveAsNew();
      gate.resolve(); await Promise.all([first, second]);
      expect(h.files.size).toBe(1); expect(h.api.createOperation).toHaveBeenCalledTimes(1);
    } finally { spy.mockRestore(); }
  });

  it('local → cloud → local detaches same-ID records and preserves form content', async () => {
    const h = await harness(false); await h.component.onSubmit();
    const id = h.form.value.quotationId!;
    await h.component.onCloudSyncToggle(true);
    await h.sync.save({ ...quote(), quotationId: id, customerCompany: 'existing remote' });
    h.form.patchValue({ customerCompany: 'retained local content' });
    await h.component.onSubmit();
    expect(h.component.selectedHistoryId()).not.toBe(id);
    expect(h.sync.history().find((entry) => entry.quotationId === id)?.data.customerCompany).toBe('existing remote');
    await h.component.onCloudSyncToggle(false);
    expect(h.component.savedBusinessVersion()).toBeNull();
    expect(h.component.selectedHistoryId()).toBeNull();
    expect(h.form.value.customerCompany).toBe('retained local content');
    await h.component.onSubmit();
    expect(h.storage.getHistory('quotation:user:owner-A')).toHaveLength(2);
    expect(h.storage.getHistory('quotation:user:owner-A').find((entry) => entry.quotationId === id)?.customerCompany).toBe('合成客戶');
  });

  it('A → B invalidates pending identity/baseline while retaining editor content', async () => {
    const h = await harness(); h.form.patchValue({ customerCompany: '保留 A 的未完成編輯' });
    h.loseResponse(); await h.component.onSubmit();
    await h.setOwner('owner-B');
    expect(h.component.selectedHistoryId()).toBeNull(); expect(h.component.savedBusinessVersion()).toBeNull();
    expect(h.form.value.customerCompany).toBe('保留 A 的未完成編輯');
    await h.component.onSubmit();
    expect([...h.files.values()].at(-1)?.ownerSub).toBe('owner-B');
    expect(new Set([...h.files.values()].map((r) => r.quotationId)).size).toBe(2);
  });

  it.each([false, true])('cloud=%s: unsaved sent cannot next-version; saved next-version stays one record and copy resets metadata', async (cloud) => {
    const h = await harness(cloud);
    h.component.quotationNumber.set('Q-001');
    h.form.patchValue({ quotationNumber: 'Q-001' });
    h.component.onStatusChange({ target: { value: 'sent' } } as unknown as Event);
    h.component.onCreateNextBusinessVersion();
    expect(h.component.quotationBusinessVersion()).toBe(1);
    expect(h.form.value.previousVersions).toHaveLength(0);
    await h.component.onSubmit(); const id = h.form.value.quotationId;
    h.component.onCreateNextBusinessVersion(); await h.component.onSubmit();
    const history = cloud ? h.sync.history().map((entry) => entry.data) : h.storage.getHistory('quotation:user:owner-A');
    expect(history).toHaveLength(1); expect(history[0].quotationId).toBe(id);
    expect(history[0].businessVersion).toBe(2); expect(history[0].previousVersions).toHaveLength(1);
    expect(history[0].previousVersions?.[0].data.status).toBe('sent');
    expect(history[0].quotationNumber).toBe('Q-001');
    await h.component.onSaveAsNew();
    expect(h.form.value.quotationId).not.toBe(id);
    expect(h.component.quotationBusinessVersion()).toBe(1); expect(h.component.quotationStatus()).toBe('draft');
    expect(h.component.quotationNumber()).toBe('');
    expect(h.form.value.quotationNumber).toBe('');
    expect(h.component.savedBusinessVersion()?.previousVersions).toHaveLength(0);
  });

  it('local definitive write failure retains editor and retries as one top-level record', async () => {
    const h = await harness(false);
    const spy = jest.spyOn(localStorage, 'setItem').mockImplementationOnce(() => { throw new Error('disk unavailable'); });
    await h.component.onSubmit();
    expect(h.component.savedBusinessVersion()).toBeNull(); expect(h.form.dirty).toBe(true);
    expect(h.component.submissionUncertain()).toBe(false);
    spy.mockRestore();
    await h.component.onSubmit(); await h.component.onSubmit();
    expect(h.storage.getHistory('quotation:user:owner-A')).toHaveLength(1);
  });

  it('SHA failure is definitely not sent; changed editor can start a fresh submission', async () => {
    const h = await harness();
    const spy = jest.spyOn(WebCryptoSha256HashProvider.prototype, 'hash').mockRejectedValueOnce(new Error('SHA unavailable'));
    try {
      await h.component.onSubmit();
      expect(h.component.submissionUncertain()).toBe(false);
      expect(h.api.createOperation).not.toHaveBeenCalled();
      h.form.patchValue({ customerCompany: 'new content after definite failure' });
      await h.component.onSubmit();
      expect(h.files.size).toBe(1);
      expect([...h.files.values()][0].payload.customerCompany).toBe('new content after definite failure');
    } finally { spy.mockRestore(); }
  });

  it('unknown outcome blocks next-version/new-document navigation; retry preserves invalid later edits', async () => {
    const h = await harness(); h.loseResponse(); await h.component.onSubmit();
    expect(h.component.submissionUncertain()).toBe(true);
    await h.component.onCreateNewForm();
    h.component.onCreateNextBusinessVersion();
    h.form.patchValue({ customerCompany: '' }); h.form.invalid = true;
    await h.component.onSubmit();
    expect(h.files.size).toBe(1); expect(h.form.value.customerCompany).toBe('');
    expect(h.form.dirty).toBe(true); expect(h.component.submissionUncertain()).toBe(false);
    expect(h.component.savedBusinessVersion()?.businessVersion).toBe(1);
  });

  it.each(['owner-B', null])('late accepted receipt after owner changes to %s cannot restore old identity', async (owner) => {
    const h = await harness(); const gate = h.holdReceipt();
    const saving = h.component.onSubmit();
    // Wait for real hashing and the fake Drive to accept, while its receipt is held.
    await h.accepted;
    h.form.patchValue({ customerCompany: 'keep edits during owner change' });
    await h.setOwner(owner);
    gate.resolve(); await saving;
    expect(h.component.selectedHistoryId()).toBeNull();
    expect(h.component.savedBusinessVersion()).toBeNull();
    expect(h.component.isSubmitting()).toBe(false);
    expect(h.form.value.quotationId).toBe('');
    expect(h.form.value.customerCompany).toBe('keep edits during owner change');
    expect(h.form.dirty).toBe(true);
  });

  it('late cloud receipt after toggling local cannot overwrite local saved baseline', async () => {
    const h = await harness(); const gate = h.holdReceipt(); const cloudSave = h.component.onSubmit();
    await h.accepted;
    await h.component.onCloudSyncToggle(false);
    h.form.patchValue({ customerCompany: 'local edit' }); await h.component.onSubmit();
    const localId = h.form.value.quotationId;
    gate.resolve(); await cloudSave;
    expect(h.form.value.quotationId).toBe(localId);
    expect(h.component.savedBusinessVersion()?.customerCompany).toBe('local edit');
    expect(h.component.coordinator.getSelectedStorage()).toBe('local');
  });

  it('service reservation shares deferred hashing and rejects a changed unresolved baseline', async () => {
    const h = await harness(); const gate = deferred<void>();
    const original = WebCryptoSha256HashProvider.prototype.hash;
    const spy = jest.spyOn(WebCryptoSha256HashProvider.prototype, 'hash').mockImplementation(async function(this: WebCryptoSha256HashProvider, value) {
      await gate.promise; return original.call(this, value);
    });
    try {
      const data = { ...quote(), quotationId: 'fixed-document' };
      const first = h.sync.save(data); const second = h.sync.save(data);
      expect(first).toBe(second);
      await expect(h.sync.save({ ...data, customerCompany: 'new edit' })).rejects.toThrow('尚未確認');
      gate.resolve(); await Promise.all([first, second]);
      expect(h.api.createOperation).toHaveBeenCalledTimes(1);
    } finally { gate.resolve(); spy.mockRestore(); }
  });

  it('auth changes before Angular effect flush: same-ID B record cannot be updated with A editing identity', async () => {
    const h = await harness(false); await h.component.onSubmit();
    const originalId = h.form.value.quotationId!;
    h.storage.saveToHistory({ ...quote(), quotationId: originalId, customerCompany: 'B existing record' }, 'quotation:user:owner-B');
    h.changeAuthBeforeEffect('owner-B');
    h.form.patchValue({ customerCompany: 'A editor retained as new' });
    await h.component.onSubmit();
    expect(h.form.value.quotationId).not.toBe(originalId);
    const history = h.storage.getHistory('quotation:user:owner-B');
    expect(history).toHaveLength(2);
    expect(history.find((entry) => entry.quotationId === originalId)?.customerCompany).toBe('B existing record');
    expect(h.storage.getHistory('quotation:user:owner-A')).toHaveLength(1);
  });
});
