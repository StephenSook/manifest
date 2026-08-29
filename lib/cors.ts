// lib/cors.ts
// The Capacitor variant calls these public, keyless, read-only endpoints
// from origin capacitor://localhost, which makes every call cross-origin.
// Without these headers WebKit reports "Load failed" and the native app's
// live status, ask and trap surfaces die (frame-verified on device
// 2026-08-29). The endpoints hold no secrets and take no credentials, so a
// wildcard origin discloses nothing that GET from a browser does not.
import { NextResponse } from 'next/server';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function withCors<T extends NextResponse>(res: T): T {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.headers.set(k, v);
  return res;
}

export function corsPreflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
