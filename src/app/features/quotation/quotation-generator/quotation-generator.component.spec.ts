/**
 * 折扣值正規化邏輯的單元測試
 *
 * 由於 Angular 元件測試需要複雜的設定，這裡將核心邏輯抽離測試。
 * 測試重點：
 * 1. 固定金額折扣不可超過小計
 * 2. 折數型折扣不受限制
 * 3. 前導零處理
 * 4. 邊界情況處理
 */

interface DiscountNormalizationInput {
  discountValue: number | string | null | undefined;
  discountType: 'amount' | 'percentage';
  excludingTax: number;
}

/**
 * 模擬 normalizeDiscountValue 方法的核心邏輯
 */
function normalizeDiscountValue(input: DiscountNormalizationInput): number | null {
  const { discountValue, discountType, excludingTax } = input;

  if (discountValue === null || discountValue === undefined || discountValue === '') {
    return null;
  }

  let numValue = Number(discountValue);
  if (isNaN(numValue)) {
    return null;
  }

  // 如果是固定金額折扣，限制不可超過小計
  if (discountType === 'amount') {
    if (numValue > excludingTax) {
      numValue = excludingTax;
    }
  }

  return numValue;
}

describe('折扣值正規化邏輯', () => {
  describe('固定金額折扣驗證', () => {
    it('當折扣金額超過小計時，應自動限制為小計金額', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 1500,
      });

      expect(result).toBe(1200);
    });

    it('當折扣金額等於小計時，應保持不變', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 1200,
      });

      expect(result).toBe(1200);
    });

    it('當折扣金額小於小計時，應保持不變', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 500,
      });

      expect(result).toBe(500);
    });

    it('當小計為 0 時，折扣金額應被限制為 0', () => {
      const result = normalizeDiscountValue({
        excludingTax: 0,
        discountType: 'amount',
        discountValue: 100,
      });

      expect(result).toBe(0);
    });

    it('當折扣金額為負數時，應保持為負數（小於小計）', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: -50,
      });

      expect(result).toBe(-50);
    });
  });

  describe('折數型折扣不受限制', () => {
    it('折數型折扣應保持原值不變', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: 95,
      });

      expect(result).toBe(95);
    });

    it('折數型折扣即使數值很大也不受限', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: 9999,
      });

      expect(result).toBe(9999);
    });

    it('折數型折扣可以是小數', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: 8.5,
      });

      expect(result).toBe(8.5);
    });
  });

  describe('前導零處理', () => {
    it('應移除前導零 - 固定金額', () => {
      const result = normalizeDiscountValue({
        excludingTax: 5000,
        discountType: 'amount',
        discountValue: '0100',
      });

      expect(result).toBe(100);
    });

    it('應移除前導零 - 折數', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: '08',
      });

      expect(result).toBe(8);
    });

    it('應移除多個前導零', () => {
      const result = normalizeDiscountValue({
        excludingTax: 5000,
        discountType: 'amount',
        discountValue: '00050',
      });

      expect(result).toBe(50);
    });
  });

  describe('邊界情況', () => {
    it('當折扣值為 null 時，應返回 null', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: null,
      });

      expect(result).toBeNull();
    });

    it('當折扣值為 undefined 時，應返回 null', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: undefined,
      });

      expect(result).toBeNull();
    });

    it('當折扣值為空字串時，應返回 null', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: '',
      });

      expect(result).toBeNull();
    });

    it('當折扣值為非數字字串時，應返回 null', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 'abc',
      });

      expect(result).toBeNull();
    });

    it('當折扣值為 0 時，應返回 0', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: 0,
      });

      expect(result).toBe(0);
    });

    it('當折扣值為字串 "0" 時，應返回 0', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: '0',
      });

      expect(result).toBe(0);
    });
  });

  describe('整合情境', () => {
    it('情境1: 使用者輸入 "01500" 於固定金額折扣（小計 1200）', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: '01500',
      });

      // 應移除前導零得到 1500，再限制為小計 1200
      expect(result).toBe(1200);
    });

    it('情境2: 使用者輸入 "095" 於折數（小計 1200）', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'percentage',
        discountValue: '095',
      });

      // 應移除前導零得到 95，折數不受小計限制
      expect(result).toBe(95);
    });

    it('情境3: 使用者輸入 "00800" 於固定金額折扣（小計 1200）', () => {
      const result = normalizeDiscountValue({
        excludingTax: 1200,
        discountType: 'amount',
        discountValue: '00800',
      });

      // 應移除前導零得到 800，小於小計所以保持不變
      expect(result).toBe(800);
    });
  });
});

describe('報價單儲存狀態與路由一致性', () => {
  interface MockQuotationData {
    customerCompany: string;
    quoterName: string;
    quoterEmail: string;
    serviceItems: unknown[];
    startDate: string;
    excludingTax: number;
    tax: number;
    includingTax: number;
    isSign: boolean;
  }

  interface StorageRouteCoordinatorContext<T = MockQuotationData> {
    isCloudStorage: () => boolean;
    loadLocalHistory: () => T[];
    loadCloudHistory: () => T[];
    setHistoryData: (data: T[]) => void;
    setLocalHistoryData?: (data: T[]) => void;
    getSelectedIndex: () => number | null;
    setSelectedIndex: (index: number | null) => void;
    getHistoryLength?: () => number;
  }

  /**
   * 模擬 QuotationGeneratorComponent 的 StorageRouteCoordinator 狀態協調邏輯
   * （此邏輯須與 QuotationGeneratorComponent 中的 StorageRouteCoordinator 保持一致）
   */
  class StorageRouteCoordinator<T = MockQuotationData> {
    private operationVersion = 0;
    private selectedStorage: 'local' | 'cloud' | null = null;

    constructor(private readonly ctx: StorageRouteCoordinatorContext<T>) {}

    nextOperationVersion(): number {
      return ++this.operationVersion;
    }

    isCurrentOperation(version: number): boolean {
      return version === this.operationVersion;
    }

    setSelectedStorage(storage: 'local' | 'cloud' | null): void {
      this.selectedStorage = storage;
    }

    getSelectedStorage(): 'local' | 'cloud' | null {
      return this.selectedStorage;
    }

    isEditingExisting(historyLength?: number): boolean {
      const length = historyLength ?? this.ctx.getHistoryLength?.() ?? 0;
      const index = this.ctx.getSelectedIndex();
      if (index === null || index < 0 || index >= length) return false;
      const currentMode = this.ctx.isCloudStorage() ? 'cloud' : 'local';
      return this.selectedStorage === currentMode;
    }

    resetInapplicableSelectedIndex(historyLength?: number): void {
      const length = historyLength ?? this.ctx.getHistoryLength?.() ?? 0;
      const index = this.ctx.getSelectedIndex();
      if (index === null) {
        this.selectedStorage = null;
        return;
      }
      const currentMode = this.ctx.isCloudStorage() ? 'cloud' : 'local';
      if (
        this.selectedStorage !== currentMode ||
        index < 0 ||
        index >= length
      ) {
        this.ctx.setSelectedIndex(null);
        this.selectedStorage = null;
      }
    }

    syncHistoryByCurrentRoute(): void {
      if (this.ctx.isCloudStorage()) {
        const cloud = this.ctx.loadCloudHistory();
        this.ctx.setHistoryData(cloud);
        this.resetInapplicableSelectedIndex(cloud.length);
      } else {
        const local = this.ctx.loadLocalHistory();
        this.ctx.setLocalHistoryData?.(local);
        this.ctx.setHistoryData(local);
        this.resetInapplicableSelectedIndex(local.length);
      }
    }

    async handleInitialize(initFn: () => Promise<void>): Promise<void> {
      const version = this.nextOperationVersion();
      await initFn();
      if (!this.isCurrentOperation(version)) return;
      this.syncHistoryByCurrentRoute();
    }

    async handleToggle(toggleFn: () => Promise<void>): Promise<void> {
      const version = this.nextOperationVersion();
      await toggleFn();
      if (!this.isCurrentOperation(version)) return;
      this.ctx.setSelectedIndex(null);
      this.selectedStorage = null;
      this.syncHistoryByCurrentRoute();
    }

    async handleConnect(
      connectFn: () => Promise<void>,
      onError: (error: unknown) => void
    ): Promise<void> {
      const version = this.nextOperationVersion();
      try {
        await connectFn();
        if (!this.isCurrentOperation(version)) return;
        this.ctx.setSelectedIndex(null);
        this.selectedStorage = null;
        this.syncHistoryByCurrentRoute();
      } catch (error) {
        if (!this.isCurrentOperation(version)) return;
        this.syncHistoryByCurrentRoute();
        onError(error);
      }
    }
  }

  function createMockQuotation(customerCompany: string): MockQuotationData {
    return {
      customerCompany,
      quoterName: '測試廠商',
      quoterEmail: 'test@example.com',
      serviceItems: [],
      startDate: '2026-09-09',
      excludingTax: 1000,
      tax: 50,
      includingTax: 1050,
      isSign: false,
    };
  }

  function createTestHarness(initial?: {
    isCloud?: boolean;
    localItems?: MockQuotationData[];
    cloudItems?: MockQuotationData[];
  }) {
    let isCloud = initial?.isCloud ?? false;
    let localData = initial?.localItems ?? [
      createMockQuotation('本機客戶A'),
      createMockQuotation('本機客戶B'),
    ];
    let cloudData = initial?.cloudItems ?? [createMockQuotation('雲端客戶X')];
    let currentHistory: MockQuotationData[] = [];
    let currentLocalHistory: MockQuotationData[] = [];
    let selectedIndex: number | null = null;

    const coordinator = new StorageRouteCoordinator({
      isCloudStorage: () => isCloud,
      loadLocalHistory: () => localData,
      loadCloudHistory: () => cloudData,
      setHistoryData: (data) => {
        currentHistory = [...data];
      },
      setLocalHistoryData: (data) => {
        currentLocalHistory = [...data];
      },
      getSelectedIndex: () => selectedIndex,
      setSelectedIndex: (idx) => {
        selectedIndex = idx;
      },
      getHistoryLength: () => currentHistory.length,
    });

    return {
      coordinator,
      setIsCloud: (val: boolean) => {
        isCloud = val;
      },
      setLocalData: (items: MockQuotationData[]) => {
        localData = items;
      },
      setCloudData: (items: MockQuotationData[]) => {
        cloudData = items;
      },
      getHistory: () => currentHistory,
      getLocalHistory: () => currentLocalHistory,
      getSelectedIndex: () => selectedIndex,
      setSelectedIndex: (idx: number | null) => {
        selectedIndex = idx;
      },
    };
  }

  it('本機偏好：未開啟雲端或偏好本機時，初始化維持本機歷史且不被清空', async () => {
    const harness = createTestHarness({ isCloud: false });
    await harness.coordinator.handleInitialize(async () => {
      // 本機偏好，不連接雲端
    });

    expect(harness.getHistory()).toHaveLength(2);
    expect(harness.getHistory()[0]?.customerCompany).toBe('本機客戶A');
    expect(harness.getLocalHistory()).toHaveLength(2);
  });

  it('雲端恢復失敗：自動恢復失敗時保持本機歷史，不可清空為空陣列', async () => {
    const harness = createTestHarness({ isCloud: false });
    await harness.coordinator.handleInitialize(async () => {
      // 模擬雲端恢復授權失敗，保持非雲端狀態
      harness.setIsCloud(false);
    });

    expect(harness.getHistory()).toHaveLength(2);
    expect(harness.getHistory()[0]?.customerCompany).toBe('本機客戶A');
  });

  it('雲端成功：成功連線雲端時載入雲端歷史，並重設本機選取索引避免誤覆蓋', async () => {
    const harness = createTestHarness({ isCloud: false });
    harness.coordinator.syncHistoryByCurrentRoute();
    harness.setSelectedIndex(0);
    harness.coordinator.setSelectedStorage('local');
    expect(harness.coordinator.isEditingExisting()).toBe(true);

    await harness.coordinator.handleInitialize(async () => {
      harness.setIsCloud(true);
    });

    expect(harness.getHistory()).toHaveLength(1);
    expect(harness.getHistory()[0]?.customerCompany).toBe('雲端客戶X');
    expect(harness.getSelectedIndex()).toBeNull();
    expect(harness.coordinator.getSelectedStorage()).toBeNull();
    expect(harness.coordinator.isEditingExisting()).toBe(false);
  });

  it('連結失敗不清 localStorage：Drive 授權或連線拋出例外時，保留本機歷史不清空', async () => {
    const harness = createTestHarness({ isCloud: false });
    harness.coordinator.syncHistoryByCurrentRoute();
    expect(harness.getHistory()).toHaveLength(2);

    let capturedError: unknown;
    await harness.coordinator.handleConnect(
      async () => {
        throw new Error('OAuth popup closed by user');
      },
      (err) => {
        capturedError = err;
      }
    );

    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as Error).message).toBe('OAuth popup closed by user');
    expect(harness.getHistory()).toHaveLength(2);
    expect(harness.getHistory()[0]?.customerCompany).toBe('本機客戶A');
  });

  it('非同步路由改變：非同步初始化完成時若路由已變更，依當前路由顯示並避免競態覆蓋', async () => {
    const harness = createTestHarness({ isCloud: false });
    harness.coordinator.syncHistoryByCurrentRoute();

    let resolveOperation1: () => void;
    const operation1Promise = new Promise<void>((resolve) => {
      resolveOperation1 = resolve;
    });

    // 啟動非同步操作 1（嘗試切換至雲端）
    const op1 = harness.coordinator.handleInitialize(async () => {
      await operation1Promise;
      harness.setIsCloud(true);
    });

    // 在 operation 1 完成前，使用者切換回本機偏好，觸發 operation 2
    await harness.coordinator.handleToggle(async () => {
      harness.setIsCloud(false);
    });

    // 此時 operation 1 延遲完成
    resolveOperation1!();
    await op1;

    // 由於 operation 1 已被 operation 2 取代（版本過期），不應顯示過期之雲端資料
    expect(harness.getHistory()).toHaveLength(2);
    expect(harness.getHistory()[0]?.customerCompany).toBe('本機客戶A');
  });

  it('選取索引防護：當歷史長度改變或路由切換時，重設不適用 selectedHistoryIndex 避免儲存覆蓋', () => {
    const harness = createTestHarness({ isCloud: true });
    harness.coordinator.syncHistoryByCurrentRoute();
    harness.setSelectedIndex(0);
    harness.coordinator.setSelectedStorage('cloud');
    expect(harness.coordinator.isEditingExisting()).toBe(true);

    // 路由切換為本機，且長度為 0
    harness.setIsCloud(false);
    harness.coordinator.resetInapplicableSelectedIndex(0);
    expect(harness.getSelectedIndex()).toBeNull();
    expect(harness.coordinator.isEditingExisting()).toBe(false);
  });
});
