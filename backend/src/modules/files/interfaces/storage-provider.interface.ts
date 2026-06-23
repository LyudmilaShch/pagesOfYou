export interface PresignedUploadOptions {
  /** Target key in the bucket, e.g. "uploads/user-id/uuid.jpg" */
  key: string;
  /** MIME type of the file being uploaded */
  contentType: string;
  /** Maximum allowed file size in bytes */
  maxSizeBytes?: number;
  /** URL expiration in seconds (default: 900 = 15 min) */
  expiresIn?: number;
}

export interface PresignedUploadResult {
  /** Client uploads directly to this URL via HTTP PUT */
  uploadUrl: string;
  /** Public CDN URL to access the file after upload */
  publicUrl: string;
  /** Storage key — save in DB as UploadedFile.storageKey */
  key: string;
}

export interface IStorageProvider {
  /**
   * Generate a presigned PUT URL for direct client-side upload.
   * The client sends a PUT request to uploadUrl with the file body.
   */
  generateUploadUrl(options: PresignedUploadOptions): Promise<PresignedUploadResult>;

  /**
   * Permanently delete a file from storage.
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Get the public CDN URL for a stored file.
   */
  getFileUrl(key: string): string;
}
