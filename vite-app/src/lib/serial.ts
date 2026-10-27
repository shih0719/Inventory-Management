// Serial numbers follow the backend's rule (src/services/apUnits.js normalizeSerial,
// docs/api/README.md): trim, then upper-case. Use these to show and compare serials
// locally; whether a serial exists or can move is decided by the lookup / API response.

export const normalizeSerial = (text: string): string => text.trim().toUpperCase();

/** One serial per line → normalized serials, blank lines dropped. */
export const parseSerialList = (text: string): string[] =>
  text.split('\n').map(normalizeSerial).filter((s) => s.length > 0);
