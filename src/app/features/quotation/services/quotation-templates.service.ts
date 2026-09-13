import { Injectable, inject } from '@angular/core';
import {
  CustomerTemplate,
  ServiceItemTemplate,
} from '@app/features/quotation/models/quotation.model';
import { StorageService } from '@app/shared/services/storage.service';

interface TemplateStore<T> {
  readonly schemaVersion: 1;
  readonly entries: readonly T[];
}

/**
 * 常用資料只存瀏覽器目前資料區，刻意不納入報價修訂或 Drive 同步。
 * scope 由呼叫端依登入 UID 或 visitor 設定，因此登入不會接管訪客資料。
 */
@Injectable({ providedIn: 'root' })
export class QuotationTemplatesService {
  private readonly storage = inject(StorageService);
  private scope = 'visitor';

  setScope(scope: string): void {
    // Scope is deliberately switched atomically: callers can re-render after this
    // method returns without ever seeing templates from the previous account.
    this.scope = scope.trim() || 'visitor';
  }

  getCustomers(query = ''): CustomerTemplate[] {
    return this.filter(
      this.read<CustomerTemplate>('customers', (value): value is CustomerTemplate =>
        this.isCustomerTemplate(value)
      ),
      query
    );
  }

  getServiceItems(query = ''): ServiceItemTemplate[] {
    return this.filter(
      this.read<ServiceItemTemplate>('service-items', (value): value is ServiceItemTemplate =>
        this.isServiceItemTemplate(value)
      ),
      query
    );
  }

  saveCustomer(value: Omit<CustomerTemplate, 'id'> & { id?: string }): boolean {
    if (!value.customerCompany.trim()) return false;
    const entries = this.read<CustomerTemplate>('customers', (entry): entry is CustomerTemplate =>
      this.isCustomerTemplate(entry)
    );
    const entry: CustomerTemplate = {
      id: value.id || this.createId('customer'),
      name: value.name.trim() || value.customerCompany.trim(),
      customerCompany: value.customerCompany.trim(),
      customerTaxID: this.optionalText(value.customerTaxID),
      customerContact: this.optionalText(value.customerContact),
      customerPhone: this.optionalText(value.customerPhone),
      customerPhoneExt: this.optionalText(value.customerPhoneExt),
      customerEmail: this.optionalText(value.customerEmail),
      customerAddress: this.optionalText(value.customerAddress),
    };
    return this.write('customers', this.upsert(entries, entry));
  }

  saveServiceItem(
    value: Omit<ServiceItemTemplate, 'id'> & { id?: string }
  ): boolean {
    if (!value.item.trim() || !Number.isFinite(value.price) || value.price < 0) {
      return false;
    }
    const entries = this.read<ServiceItemTemplate>(
      'service-items',
      (entry): entry is ServiceItemTemplate => this.isServiceItemTemplate(entry)
    );
    const entry: ServiceItemTemplate = {
      id: value.id || this.createId('service'),
      name: value.name.trim() || value.item.trim(),
      item: value.item.trim(),
      price: value.price,
      unit: this.optionalText(value.unit),
      category: this.optionalText(value.category),
    };
    return this.write('service-items', this.upsert(entries, entry));
  }

  deleteCustomer(id: string): boolean {
    return this.write(
      'customers',
      this.read<CustomerTemplate>('customers', (entry): entry is CustomerTemplate =>
        this.isCustomerTemplate(entry)
      ).filter(
        (entry) => entry.id !== id
      )
    );
  }

  deleteServiceItem(id: string): boolean {
    return this.write(
      'service-items',
      this.read<ServiceItemTemplate>('service-items', (entry): entry is ServiceItemTemplate =>
        this.isServiceItemTemplate(entry)
      ).filter(
        (entry) => entry.id !== id
      )
    );
  }

  private key(kind: 'customers' | 'service-items'): string {
    return `quotation:templates:${this.scope}:${kind}`;
  }

  private read<T extends { id: string }>(
    kind: 'customers' | 'service-items',
    isValid: (value: unknown) => value is T
  ): T[] {
    const fallback: TemplateStore<T> = { schemaVersion: 1, entries: [] };
    const record = this.storage.get<unknown>(this.key(kind), fallback);
    if (!this.isTemplateStore<T>(record)) return [];
    // Never expose a partially corrupted local entry to the UI.  A valid entry is
    // copied on read so a consumer cannot mutate the persisted snapshot in place.
    return record.entries.filter(isValid).map((entry) => ({ ...entry }));
  }

  private write<T extends { id: string }>(
    kind: 'customers' | 'service-items',
    entries: readonly T[]
  ): boolean {
    return this.storage.set<TemplateStore<T>>(this.key(kind), {
      schemaVersion: 1,
      entries,
    });
  }

  private upsert<T extends { id: string }>(entries: T[], entry: T): T[] {
    const index = entries.findIndex((current) => current.id === entry.id);
    return index < 0
      ? [entry, ...entries]
      : entries.map((current) => (current.id === entry.id ? entry : current));
  }

  private filter<T extends { name: string }>(entries: T[], query: string): T[] {
    const keyword = query.trim().toLocaleLowerCase();
    return !keyword
      ? entries
      : entries.filter((entry) => entry.name.toLocaleLowerCase().includes(keyword));
  }

  private isTemplateStore<T>(value: unknown): value is TemplateStore<T> {
    return !!value && typeof value === 'object' &&
      (value as { schemaVersion?: unknown }).schemaVersion === 1 &&
      Array.isArray((value as { entries?: unknown }).entries);
  }

  private isCustomerTemplate(value: unknown): value is CustomerTemplate {
    return this.hasTextFields(value, 'id', 'name', 'customerCompany');
  }

  private isServiceItemTemplate(value: unknown): value is ServiceItemTemplate {
    return this.hasTextFields(value, 'id', 'name', 'item') &&
      Number.isFinite((value as { price?: unknown }).price) &&
      (value as { price: number }).price >= 0;
  }

  private hasTextFields(value: unknown, ...fields: string[]): boolean {
    return !!value && typeof value === 'object' && fields.every(
      (field) => typeof (value as Record<string, unknown>)[field] === 'string'
    );
  }

  private optionalText(value: string | undefined): string | undefined {
    const normalized = value?.trim();
    return normalized || undefined;
  }

  private createId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
  }
}
