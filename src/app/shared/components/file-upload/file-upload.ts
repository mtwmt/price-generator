import { Component, input, output } from '@angular/core';
import { LucideAngularModule, Upload, X } from 'lucide-angular';

@Component({
  selector: 'app-file-upload',
  imports: [LucideAngularModule],
  templateUrl: './file-upload.html',
})
export class FileUpload {
  // Inputs
  label = input.required<string>();
  supportedFormats = input<string>('支援 PNG、JPG、GIF');
  accept = input<string>('image/gif, image/jpeg, image/png');
  previewUrl = input<string | null>(null);
  variant = input<'default' | 'compact'>('default');

  // Outputs
  fileSelected = output<FileList>();
  fileRemoved = output<void>();

  // Icons
  Upload = Upload;
  X = X;

  onFileChange(files: FileList | null): void {
    if (files && files.length > 0) {
      this.fileSelected.emit(files);
    }
  }

  onRemove(): void {
    this.fileRemoved.emit();
  }
}
