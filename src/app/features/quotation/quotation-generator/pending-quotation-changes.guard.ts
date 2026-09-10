import type { CanDeactivateFn } from '@angular/router';

export interface PendingQuotationChangesAware {
  confirmDiscardBeforeLeaving(): boolean | Promise<boolean>;
}

export const pendingQuotationChangesGuard: CanDeactivateFn<
  PendingQuotationChangesAware
> = (component) => component.confirmDiscardBeforeLeaving();
