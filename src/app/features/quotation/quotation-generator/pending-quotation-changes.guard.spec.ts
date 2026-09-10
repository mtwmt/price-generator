import { pendingQuotationChangesGuard } from './pending-quotation-changes.guard';

describe('pendingQuotationChangesGuard', () => {
  it('把站內導頁決定交給報價單元件', async () => {
    const component = {
      confirmDiscardBeforeLeaving: jest.fn().mockResolvedValue(false),
    };

    const result = pendingQuotationChangesGuard(
      component,
      {} as never,
      {} as never,
      {} as never
    );

    await expect(result).resolves.toBe(false);
    expect(component.confirmDiscardBeforeLeaving).toHaveBeenCalledTimes(1);
  });
});
