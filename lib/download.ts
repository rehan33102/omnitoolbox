/**
 * Reliable blob download helper.
 *
 * The anchor MUST be attached to document.body before .click() —
 * detached anchors silently fail on mobile browsers / WebViews.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // Required: element must be in the DOM for the click to trigger download
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Clean up: remove element immediately, revoke URL after a delay
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
  }, 4000);
}

/**
 * Download from a data-URL or remote URL string.
 * For cross-origin URLs this opens in a new tab as fallback.
 */
export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  // For cross-origin URLs, target _blank as fallback (download attr ignored cross-origin)
  if (/^https?:\/\//.test(url) && !url.startsWith(window.location.origin)) {
    a.target = "_blank";
    a.rel = "noopener";
  }
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
  }, 4000);
}
