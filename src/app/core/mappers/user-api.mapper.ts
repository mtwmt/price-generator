import { D1UserResponseDTO, UserData } from '../../features/user/user.model';

/**
 * UserApiMapper - Data Mapper Pattern
 * 職責：處理網路傳輸層 (DTO) 與應用程式領域模型 (Domain Model) 之間的轉換。
 * 好處：
 * 1. 隱藏 API 結構的細節。
 * 2. 提供類型安全與預設值處理。
 * 3. 當後端欄位更名時，只需修改此處。
 */
export class UserApiMapper {
  /**
   * 將 D1 API 的響應 DTO 映射到前端 UserData 模型
   */
  static mapD1ToUserData(dto: D1UserResponseDTO): UserData {
    const { user, profiles } = dto;
    const quotation = profiles?.quotation;

    return {
      uid: user.id,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      // 保持舊有 platforms 結構以維持相容性
      platforms: {
        quotation: quotation
          ? {
              role: quotation.role,
              premiumUntil: quotation.premiumUntil,
              firstAccessTime: quotation.firstAccessTime,
              lastAccessTime: quotation.lastAccessTime,
            }
          : undefined,
      },
      createdAt: quotation?.createdAt ?? user.createdAt,
      updatedAt: quotation?.updatedAt ?? user.updatedAt,
    };
  }

  /**
   * 批量映射 DTO 列表為 UserData 列表
   */
  static mapMany(dtos: D1UserResponseDTO[]): UserData[] {
    return dtos.map((dto) => this.mapD1ToUserData(dto));
  }
}
