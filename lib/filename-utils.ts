/**
 * Utility functions for handling filenames safely
 */

/**
 * Sanitizes a filename by removing or replacing invalid characters
 */
export function sanitizeFilename(filename: string): string {
  // Replace invalid characters with underscores
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Invalid filename characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, 255); // Limit length to 255 characters
}

/**
 * Extracts the file extension from a filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.substring(lastDot) : '';
}

/**
 * Gets a safe download filename, preferring the original filename over title
 */
export function getDownloadFilename(title: string, originalFilename?: string): string {
  if (originalFilename) {
    return sanitizeFilename(originalFilename);
  }

  // If no original filename, use title but ensure it has an extension
  const sanitizedTitle = sanitizeFilename(title);
  const extension = getFileExtension(sanitizedTitle);

  // If title doesn't have an extension, add a generic one
  if (!extension) {
    return `${sanitizedTitle}.pdf`; // Default to PDF as most docs are PDF
  }

  return sanitizedTitle;
}