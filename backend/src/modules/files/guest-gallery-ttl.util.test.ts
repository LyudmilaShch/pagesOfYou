import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GUEST_GALLERY_TTL_MS, isAbandonedGuestPhoto } from './guest-gallery-ttl.util.ts';

const NOW = new Date('2026-11-09T12:00:00.000Z');

function photo(overrides: Partial<Parameters<typeof isAbandonedGuestPhoto>[0]> = {}) {
  return {
    guestId: 'gallery-1',
    orderId: null,
    deletedAt: null,
    createdAt: new Date(NOW.getTime() - GUEST_GALLERY_TTL_MS - 1000),
    touchedAt: null as Date | null,
    ...overrides,
  };
}

describe('abandoned guest gallery photos', () => {
  it('drops a guest photo that was never touched and is older than the draft lifetime', () => {
    assert.equal(isAbandonedGuestPhoto(photo(), NOW), true);
  });

  it('keeps a photo whose gallery was touched inside the window, even if the file is older', () => {
    assert.equal(
      isAbandonedGuestPhoto(photo({ touchedAt: new Date(NOW.getTime() - 60_000) }), NOW),
      false,
    );
  });

  it('does not touch photos that already belong to an order or were deleted', () => {
    assert.equal(isAbandonedGuestPhoto(photo({ orderId: 'order-1' }), NOW), false);
    assert.equal(isAbandonedGuestPhoto(photo({ deletedAt: NOW }), NOW), false);
    assert.equal(isAbandonedGuestPhoto(photo({ guestId: null }), NOW), false);
  });
});
