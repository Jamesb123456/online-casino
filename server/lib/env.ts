export function parseOrigins(raw: string | undefined, fallback = 'http://localhost'): string[] {
  return (raw || fallback).split(',').map(o => o.trim()).filter(Boolean);
}
