declare global {
  interface Window {
    umami?: { track: (eventName: string) => void };
  }
}

/**
 * Product events deliberately contain no identifiers, audio metadata, or
 * classification data. Page views are collected by Umami's tracker itself.
 */
export function track(eventName: string): void {
  window.umami?.track(eventName);
}
