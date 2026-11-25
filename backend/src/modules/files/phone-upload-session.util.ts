/** How long a QR link keeps accepting photos after the computer creates it. */
export const PHONE_UPLOAD_SESSION_TTL_MS = 60 * 60 * 1000;

export function phoneUploadExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + PHONE_UPLOAD_SESSION_TTL_MS);
}

/** A link is live until the computer leaves step 2 (`revokedAt`) or the hour runs out. */
export function isPhoneUploadSessionActive(
  session: { expiresAt: Date; revokedAt: Date | null },
  now = new Date(),
): boolean {
  return session.revokedAt == null && session.expiresAt.getTime() > now.getTime();
}
