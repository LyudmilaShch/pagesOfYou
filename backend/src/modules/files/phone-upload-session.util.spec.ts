import { isPhoneUploadSessionActive, phoneUploadExpiresAt, PHONE_UPLOAD_SESSION_TTL_MS } from './phone-upload-session.util';

const NOW = new Date('2026-11-25T12:00:00.000Z');

describe('phone upload session lifetime', () => {
  it('expires one hour after it is created', () => {
    expect(phoneUploadExpiresAt(NOW).toISOString()).toBe('2026-11-25T13:00:00.000Z');
    expect(PHONE_UPLOAD_SESSION_TTL_MS).toBe(60 * 60 * 1000);
  });

  it('accepts a session that has not been revoked and has not expired', () => {
    expect(
      isPhoneUploadSessionActive(
        { expiresAt: new Date('2026-11-25T12:30:00.000Z'), revokedAt: null },
        NOW,
      ),
    ).toBe(true);
  });

  it('rejects an expired or revoked session', () => {
    expect(
      isPhoneUploadSessionActive(
        { expiresAt: new Date('2026-11-25T12:00:00.000Z'), revokedAt: null },
        NOW,
      ),
    ).toBe(false);
    expect(
      isPhoneUploadSessionActive(
        { expiresAt: new Date('2026-11-25T13:00:00.000Z'), revokedAt: NOW },
        NOW,
      ),
    ).toBe(false);
  });
});
