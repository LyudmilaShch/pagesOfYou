export interface AuthTokens {
  /** Short-lived JWT for API requests (default: 15 min) */
  accessToken: string;
  /** Long-lived JWT for token rotation (default: 30 days) */
  refreshToken: string;
  /** Access token TTL in seconds — for frontend countdown */
  expiresIn: number;
}
