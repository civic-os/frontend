/**
 * Copyright (C) 2023-2025 Civic OS, L3C
 */

import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FileReference } from '../../interfaces/entity';

@Component({
  selector: 'app-pdf-viewer',
  standalone: true,
  imports: [],
  templateUrl: './pdf-viewer.component.html',
  styleUrl: './pdf-viewer.component.css'
})
export class PdfViewerComponent {
  @ViewChild('pdfDialog') dialog!: ElementRef<HTMLDialogElement>;

  currentPdf = signal<FileReference | null>(null);

  constructor(private sanitizer: DomSanitizer) {}

  /**
   * Open PDF viewer with given file
   */
  open(pdf: FileReference) {
    this.currentPdf.set(pdf);
    this.dialog.nativeElement.showModal();
  }

  /**
   * Close the viewer
   */
  close() {
    this.dialog.nativeElement.close();
    this.currentPdf.set(null);
  }

  /**
   * Get sanitized PDF URL for iframe
   * Angular security requires bypassing for blob/data URLs
   */
  getSanitizedPdfUrl(): SafeResourceUrl {
    const pdf = this.currentPdf();
    if (!pdf) return '';

    const url = this.getS3Url(pdf.s3_original_key);
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /**
   * Get raw PDF URL for download link
   */
  getPdfUrl(): string {
    const pdf = this.currentPdf();
    return pdf ? this.getS3Url(pdf.s3_original_key) : '';
  }

  /**
   * Open PDF in new tab with full browser controls
   */
  openFullScreen() {
    window.open(this.getPdfUrl(), '_blank');
  }

  /**
   * Get download filename
   */
  getDownloadFilename(): string {
    return this.currentPdf()?.file_name || 'document.pdf';
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
