/** Job Inbox feature gate — keep off in production until Client Desk ships. */

export function isJobInboxEnabled(): boolean {
  const flag = process.env.JOB_INBOX_ENABLED?.trim();
  if (flag === "1" || flag?.toLowerCase() === "true") return true;
  // Local Next.js default: allow when NODE_ENV is development.
  return process.env.NODE_ENV === "development";
}

export function getJobInboxExtensionToken(): string | null {
  const t = process.env.JOB_INBOX_TOKEN?.trim();
  return t ? t : null;
}

/** Constant-time-ish compare for extension bearer tokens. */
export function extensionTokenMatches(provided: string | null | undefined): boolean {
  const expected = getJobInboxExtensionToken();
  if (!expected || !provided) return false;
  if (expected.length !== provided.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}
