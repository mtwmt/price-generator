import { signal } from '@angular/core';
import { QuotationData } from '@app/features/quotation/models/quotation.model';

export interface StorageRouteCoordinatorContext<T = QuotationData> {
  isCloudStorage: () => boolean;
  loadLocalHistory: () => T[];
  loadCloudHistory: () => T[];
  setHistoryData: (data: T[]) => void;
  setLocalHistoryData?: (data: T[]) => void;
  getSelectedIndex: () => number | null;
  setSelectedIndex: (index: number | null) => void;
  getHistoryLength?: () => number;
}

/** 元件使用的單一儲存路由協調器；將非同步競態與選取來源集中在可直接驗證的 production 邏輯。 */
export class StorageRouteCoordinator<T = QuotationData> {
  private operationVersion = 0;
  readonly selectedStorage = signal<'local' | 'cloud' | null>(null);

  constructor(private readonly ctx: StorageRouteCoordinatorContext<T>) {}

  nextOperationVersion(): number { return ++this.operationVersion; }
  isCurrentOperation(version: number): boolean { return version === this.operationVersion; }
  setSelectedStorage(storage: 'local' | 'cloud' | null): void { this.selectedStorage.set(storage); }
  getSelectedStorage(): 'local' | 'cloud' | null { return this.selectedStorage(); }

  isEditingExisting(historyLength?: number): boolean {
    const length = historyLength ?? this.ctx.getHistoryLength?.() ?? 0;
    const index = this.ctx.getSelectedIndex();
    if (index === null || index < 0 || index >= length) return false;
    return this.selectedStorage() === (this.ctx.isCloudStorage() ? 'cloud' : 'local');
  }

  resetInapplicableSelectedIndex(historyLength?: number): void {
    const length = historyLength ?? this.ctx.getHistoryLength?.() ?? 0;
    const index = this.ctx.getSelectedIndex();
    if (index === null) { this.selectedStorage.set(null); return; }
    const currentMode = this.ctx.isCloudStorage() ? 'cloud' : 'local';
    if (this.selectedStorage() !== currentMode || index < 0 || index >= length) {
      this.ctx.setSelectedIndex(null);
      this.selectedStorage.set(null);
    }
  }

  syncHistoryByCurrentRoute(): void {
    if (this.ctx.isCloudStorage()) {
      const cloud = this.ctx.loadCloudHistory();
      this.ctx.setHistoryData(cloud);
      this.resetInapplicableSelectedIndex(cloud.length);
      return;
    }
    const local = this.ctx.loadLocalHistory();
    this.ctx.setLocalHistoryData?.(local);
    this.ctx.setHistoryData(local);
    this.resetInapplicableSelectedIndex(local.length);
  }

  async handleInitialize(initFn: () => Promise<void>): Promise<void> {
    const version = this.nextOperationVersion();
    await initFn();
    if (this.isCurrentOperation(version)) this.syncHistoryByCurrentRoute();
  }

  async handleToggle(toggleFn: () => Promise<void>): Promise<void> {
    const version = this.nextOperationVersion();
    await toggleFn();
    if (!this.isCurrentOperation(version)) return;
    this.syncHistoryByCurrentRoute();
  }

  async handleConnect(connectFn: () => Promise<void>, onError: (error: unknown) => void): Promise<void> {
    const version = this.nextOperationVersion();
    try {
      await connectFn();
      if (!this.isCurrentOperation(version)) return;
      this.syncHistoryByCurrentRoute();
    } catch (error) {
      if (!this.isCurrentOperation(version)) return;
      this.syncHistoryByCurrentRoute();
      onError(error);
    }
  }
}
