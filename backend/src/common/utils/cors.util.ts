export function getCorsOrigins(): string[] {
  const raw = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
