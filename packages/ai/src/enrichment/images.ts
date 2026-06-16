// Image evidence handling — a self-contained util: extract from
// provider payloads, validate against the SINGLE allowlist (config.ts), dedupe,
// and quality-rank. Profile photos are a parallel concern to textual evidence and
// flow through to the candidate so the UI can show a face.

import { IMAGE_ALLOWED_EXTENSIONS, IMAGE_ALLOWED_HOSTS } from './config';

// Keys that, anywhere in a provider's JSON, tend to carry an image URL.
const IMAGE_KEY_RE = /(image|thumbnail|avatar|logo|photo|picture)/i;

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hasAllowedExtension(url: string): boolean {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();
  return IMAGE_ALLOWED_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function isAllowedHost(host: string): boolean {
  return IMAGE_ALLOWED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

// An image is valid if it's http(s) AND (has an allowed extension OR comes from a
// known image CDN — many CDN URLs omit a file extension).
export function isValidImageUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  const host = hostOf(url);
  if (!host) return false;
  return hasAllowedExtension(url) || isAllowedHost(host);
}

// Recursively walk an arbitrary provider JSON value, collecting string values that
// live under an image-ish key OR are themselves a valid image URL. Defensive: one
// malformed branch never throws.
export function extractImageUrls(value: unknown, keyHint = ''): string[] {
  const out: string[] = [];
  if (typeof value === 'string') {
    if ((IMAGE_KEY_RE.test(keyHint) || isValidImageUrl(value)) && /^https?:\/\//i.test(value)) {
      out.push(value);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) out.push(...extractImageUrls(item, keyHint));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.push(...extractImageUrls(v, k));
    }
  }
  return out;
}

// Quality score for ranking — higher is better. Encyclopedic/known-profile CDNs
// rank above generic ones; a real file extension is a mild positive.
function qualityScore(url: string): number {
  const host = hostOf(url) ?? '';
  let score = 0;
  if (host.endsWith('wikimedia.org') || host.endsWith('wikipedia.org')) score += 50;
  if (host.endsWith('licdn.com')) score += 40;
  if (host.endsWith('gravatar.com')) score += 20;
  if (isAllowedHost(host)) score += 10;
  if (hasAllowedExtension(url)) score += 5;
  return score;
}

// Validate → dedupe (ordered) → rank. Returns the ranked list of valid image URLs.
export function rankImages(urls: readonly string[]): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const url of urls) {
    if (!isValidImageUrl(url) || seen.has(url)) continue;
    seen.add(url);
    valid.push(url);
  }
  return valid.sort((a, b) => qualityScore(b) - qualityScore(a));
}
