import {
  DonationRequestDTO,
  DonationRequest,
} from '../../features/user/user.model';

/**
 * DonationApiMapper - Data Mapper Pattern
 * 職責：處理贊助申請相關的 DTO 與領域模型轉換。
 */
export class DonationApiMapper {
  /**
   * 將 DTO 列表轉換為領域模型列表
   */
  static mapMany(dtos: DonationRequestDTO[]): DonationRequest[] {
    return dtos.map((dto) => this.mapOne(dto));
  }

  /**
   * 將單一 DTO 轉換為領域模型
   */
  static mapOne(dto: DonationRequestDTO): DonationRequest {
    return {
      id: dto.id,
      uid: dto.uid,
      userDisplayName: dto.userDisplayName || '未知使用者',
      userEmail: dto.userEmail || '-',
      proof: dto.proof || '',
      note: (dto.note || '').replace(/\\n/g, '\n'),
      status: dto.status,
      createdAt: dto.createdAt,
      updatedAt: dto.updatedAt,
      reviewedBy: dto.reviewedBy || undefined,
      reviewedAt: dto.reviewedAt || undefined,
    };
  }
}
