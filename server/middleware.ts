import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { FREE_QUOTA_CONFIG } from './config.ts';

const COOKIE_NAME = 'voxcraft_sid';
const SESSION_SECRET = process.env.SESSION_SECRET || 'voxcraft-local-dev-secret-key';

export interface RequestWithContext extends Request {
  voxcraftUserId?: string;
  voxcraftClientIp?: string;
}

function signId(id: string): string {
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('hex').slice(0, 16);
  return `${id}.${sig}`;
}

function verifySignedId(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [id, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('hex').slice(0, 16);
  if (sig.length !== expected.length) return null;
  try {
    if (crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return id;
    }
  } catch {
    return null;
  }
  return null;
}

export function setSessionCookie(res: Response, userId: string): void {
  const token = signId(userId);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

export function sessionMiddleware(
  req: RequestWithContext,
  res: Response,
  next: NextFunction
): void {
  const rawCookie = req.cookies?.[COOKIE_NAME] as string | undefined;
  let userId = rawCookie ? verifySignedId(rawCookie) : null;

  if (!userId) {
    userId = `gst_${crypto.randomBytes(10).toString('hex')}`;
    setSessionCookie(res, userId);
  }

  req.voxcraftUserId = userId;
  req.voxcraftClientIp = extractClientIp(req);
  next();
}

const rateLimitStore = new Map<string, number[]>();

export function rateLimitMiddleware(
  req: RequestWithContext,
  res: Response,
  next: NextFunction
): void {
  const ip = req.voxcraftClientIp || extractClientIp(req);
  const now = Date.now();
  const windowMs = FREE_QUOTA_CONFIG.rateLimitWindowSeconds * 1000;
  const timestamps = (rateLimitStore.get(ip) || []).filter((t) => now - t < windowMs);

  if (timestamps.length >= FREE_QUOTA_CONFIG.rateLimitMaxRequests) {
    res.status(429).json({
      error: `Too many requests in a short period. Please wait ${FREE_QUOTA_CONFIG.rateLimitWindowSeconds} seconds before trying again.`,
    });
    return;
  }

  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);
  next();
}
