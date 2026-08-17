import crypto from 'node:crypto';

export const FILE_ACCESS_TTL_MS = 30_000;
const tokens = new Map();

function purgeExpired(now = Date.now()) {
  for (const [token, value] of tokens) if (value.expiresAt <= now) tokens.delete(token);
}

export function issueFileAccess(documentId, ttlMs = FILE_ACCESS_TTL_MS) {
  const now = Date.now();
  purgeExpired(now);
  const token = crypto.randomBytes(32).toString('base64url');
  tokens.set(token, { documentId, expiresAt: now + ttlMs });
  return { token, expiresIn: ttlMs };
}

export function hasFileAccess(token) {
  if (!token) return false;
  purgeExpired();
  return tokens.has(token);
}

export function consumeFileAccess(token, documentId) {
  purgeExpired();
  const value = tokens.get(token);
  if (!value || value.documentId !== documentId) return false;
  tokens.delete(token);
  return true;
}

export function clearFileAccessTokens() {
  tokens.clear();
}
