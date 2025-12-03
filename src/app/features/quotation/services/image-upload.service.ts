import { Injectable, inject } from '@angular/core';
import { ToastService } from '@app/shared/services/toast.service';

@Injectable({
  providedIn: 'root',
})
export class ImageUploadService {
  private readonly toastService = inject(ToastService);

  private readonly MAX_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif'];

  /**
   * 上傳圖片（驗證 + 讀取）
   * @param file 上傳的檔案
   * @returns Base64 字串，如果失敗則回傳 null
   */
  async uploadImage(file: File): Promise<string | null> {
    // 1. 驗證
    if (!this.validateFile(file)) {
      return null;
    }

    // 2. 讀取
    try {
      return await this.readAsBase64(file);
    } catch (error) {
      console.error('Image upload error:', error);
      this.toastService.error('圖片讀取失敗，請重試');
      return null;
    }
  }

  /**
   * 驗證檔案大小與類型
   */
  private validateFile(file: File): boolean {
    // 檔案大小驗證
    if (file.size > this.MAX_SIZE) {
      this.toastService.error('圖片大小不可超過 5MB');
      return false;
    }

    // 檔案類型驗證
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      this.toastService.error('僅支援 JPG、PNG、GIF 格式');
      return false;
    }

    return true;
  }

  /**
   * 讀取檔案為 Base64
   */
  private readAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('File read failed'));
      };

      reader.onload = (e: ProgressEvent<FileReader>) => {
        if (e.target?.result && typeof e.target.result === 'string') {
          resolve(e.target.result);
        } else {
          reject(new Error('Invalid file result'));
        }
      };

      reader.readAsDataURL(file);
    });
  }
}
