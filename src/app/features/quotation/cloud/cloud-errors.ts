export type CloudDomainErrorCode =
  | 'INVALID_ENVELOPE'
  | 'UNKNOWN_SCHEMA_VERSION'
  | 'INVALID_CONTENT_HASH'
  | 'UNVERIFIED_REVISION'
  | 'OPERATION_ID_CONFLICT'
  | 'PARENT_REVISION_IMMUTABLE'
  | 'DRAFT_REVISION_MISMATCH'
  | 'INVALID_OPERATION'
  | 'UNSUPPORTED_KIND';

export class CloudDomainError extends Error {
  constructor(
    readonly code: CloudDomainErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'CloudDomainError';
  }
}
