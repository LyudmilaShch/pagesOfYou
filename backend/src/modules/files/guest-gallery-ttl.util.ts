/** Same window as a guest's local draft (`LOCAL_DRAFT_TTL_MS` on the frontend). */
export const GUEST_GALLERY_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function guestGalleryCutoff(now = new Date(), ttlMs = GUEST_GALLERY_TTL_MS): Date {
  return new Date(now.getTime() - ttlMs);
}

/** A guest photo is abandoned when nobody has touched its gallery within the draft lifetime.
 * `touchedAt` is refreshed while the draft is saved. Photos never touched fall back to `createdAt`,
 * so a gallery uploaded and then left behind is still removed. */
export function isAbandonedGuestPhoto(
  photo: { guestId: string | null; orderId: string | null; deletedAt: Date | null; createdAt: Date; touchedAt: Date | null },
  now = new Date(),
  ttlMs = GUEST_GALLERY_TTL_MS,
): boolean {
  if (!photo.guestId || photo.orderId || photo.deletedAt) {
    return false;
  }
  const activity = photo.touchedAt ?? photo.createdAt;
  return activity.getTime() < guestGalleryCutoff(now, ttlMs).getTime();
}
