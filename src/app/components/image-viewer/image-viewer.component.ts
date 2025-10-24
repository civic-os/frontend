/**
 * Copyright (C) 2023-2025 Civic OS, L3C
 */

import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { FileReference } from '../../interfaces/entity';

@Component({
  selector: 'app-image-viewer',
  standalone: true,
  imports: [],
  templateUrl: './image-viewer.component.html',
  styleUrl: './image-viewer.component.css'
})
export class ImageViewerComponent {
  @ViewChild('imageDialog') dialog!: ElementRef<HTMLDialogElement>;

  currentImage = signal<FileReference | null>(null);
  zoomed = signal(false);

  /**
   * Open image viewer with given file
   */
  open(image: FileReference) {
    this.currentImage.set(image);
    this.zoomed.set(false);
    this.dialog.nativeElement.showModal();
  }

  /**
   * Close the viewer
   */
  close() {
    this.dialog.nativeElement.close();
    this.currentImage.set(null);
    this.zoomed.set(false);
  }

  /**
   * Toggle between fit and actual size
   */
  toggleZoom() {
    this.zoomed.update(z => !z);
  }

  /**
   * Get download filename
   */
  getDownloadFilename(): string {
    return this.currentImage()?.file_name || 'image';
  }

  /**
   * Get image URL (prefer large thumbnail, fallback to original)
   */
  getImageUrl(): string {
    const img = this.currentImage();
    if (!img) return '';

    // For zoomed view, always use original
    if (this.zoomed()) {
      return this.getS3Url(img.s3_original_key);
    }

    // For fit view, use large thumbnail if available
    return img.s3_thumbnail_large_key
      ? this.getS3Url(img.s3_thumbnail_large_key)
      : this.getS3Url(img.s3_original_key);
  }

  /**
   * Construct S3 URL from key
   * TODO: Make this configurable via environment
   */
  private getS3Url(s3Key: string): string {
    // For development with MinIO
    const endpoint = 'http://localhost:9000';
    const bucket = 'civic-os-files';
    return `${endpoint}/${bucket}/${s3Key}`;
  }
}
