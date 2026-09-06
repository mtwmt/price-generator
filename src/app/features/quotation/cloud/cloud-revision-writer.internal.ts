import {
  CloudQuotationRevisionWriter,
  VerifiedCloudQuotationRevision,
} from './cloud-contracts';
import { assertCloudQuotationRevisionVerified } from './cloud-domain';

type PersistVerifiedRevision<TPayload> = (
  revision: VerifiedCloudQuotationRevision<TPayload>
) => Promise<void>;

/**
 * raw persistence callback 只存在這個未由 public barrel 匯出的 adapter 組裝層。
 * 公開呼叫端只拿得到 appendRevision；型別斷言無法略過方法內的 runtime guard。
 */
class GuardedCloudQuotationRevisionWriter<
  TPayload,
> implements CloudQuotationRevisionWriter {
  constructor(
    private readonly persistVerifiedRevision: PersistVerifiedRevision<TPayload>
  ) {}

  async appendRevision(value: unknown): Promise<void> {
    assertCloudQuotationRevisionVerified<TPayload>(value);
    await this.persistVerifiedRevision(value);
  }
}

/** 僅供 cloud 內部 persistence adapter 與邊界測試組裝，不得從 index.ts 匯出。 */
export function createCloudQuotationRevisionWriterForAdapter<TPayload>(
  persistVerifiedRevision: PersistVerifiedRevision<TPayload>
): CloudQuotationRevisionWriter {
  return new GuardedCloudQuotationRevisionWriter(persistVerifiedRevision);
}
