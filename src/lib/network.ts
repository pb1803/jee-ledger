// Tiny connectivity helper. Relying on navigator.onLine (updated by the browser
// online/offline events) is enough for this app — no polling service.
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export const OFFLINE_SAVE_MESSAGE =
  "You're offline. Connect to the internet to save changes.";
