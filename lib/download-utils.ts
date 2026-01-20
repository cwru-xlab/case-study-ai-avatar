/**
 * Utility functions for downloading files in a React-friendly way
 */

export interface DownloadOptions {
  url: string;
  filename?: string;
  contentType?: string;
}

/**
 * Downloads a file using fetch API and blob handling
 * This is a React-friendly alternative to direct DOM manipulation
 */
export async function downloadFile(options: DownloadOptions): Promise<void> {
  const { url, filename, contentType } = options;

  try {
    // Fetch the file
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    // Get the blob
    const blob = await response.blob();

    // Create object URL
    const objectUrl = URL.createObjectURL(blob);

    try {
      // Use the modern approach with URL.createObjectURL
      const link = document.createElement('a');
      link.href = objectUrl;

      // Set filename from parameter or try to extract from response headers
      if (filename) {
        link.download = filename;
      } else {
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch) {
            link.download = filenameMatch[1].replace(/['"]/g, '');
          }
        }
      }

      // Trigger download without adding to DOM
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      // Clean up object URL to prevent memory leaks
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    console.error('Download failed:', error);
    throw new Error(error instanceof Error ? error.message : 'Download failed');
  }
}

/**
 * Downloads a file from a data blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    link.style.display = 'none';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Downloads text content as a file
 */
export function downloadText(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Downloads JSON data as a file
 */
export function downloadJson(data: any, filename: string): void {
  const content = JSON.stringify(data, null, 2);
  downloadText(content, filename, 'application/json');
}