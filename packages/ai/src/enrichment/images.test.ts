import { describe, expect, it } from 'vitest';
import { extractImageUrls, isValidImageUrl, rankImages } from './images';

describe('isValidImageUrl', () => {
  it('accepts a known CDN host even without a file extension', () => {
    expect(isValidImageUrl('https://media.licdn.com/dms/image/abc123')).toBe(true);
  });
  it('accepts an allowed extension on any host', () => {
    expect(isValidImageUrl('https://example.com/avatars/jane.jpg')).toBe(true);
  });
  it('rejects an unknown host with no allowed extension', () => {
    expect(isValidImageUrl('https://example.com/profile')).toBe(false);
  });
  it('rejects non-http urls', () => {
    expect(isValidImageUrl('data:image/png;base64,xxxx')).toBe(false);
    expect(isValidImageUrl('ftp://x.com/a.png')).toBe(false);
  });
});

describe('extractImageUrls', () => {
  it('recursively pulls urls from image-ish keys and nested structures', () => {
    const payload = {
      organic_results: [{ thumbnail: 'https://x.com/a.jpg', link: 'https://x.com' }],
      inline_images: [{ original: 'https://media.licdn.com/img/1' }],
      nested: { deep: { avatar: 'https://gravatar.com/avatar/2' } },
    };
    const urls = extractImageUrls(payload);
    expect(urls).toContain('https://x.com/a.jpg');
    expect(urls).toContain('https://media.licdn.com/img/1');
    expect(urls).toContain('https://gravatar.com/avatar/2');
  });

  it('does not throw on malformed/odd values', () => {
    expect(() => extractImageUrls({ a: null, b: undefined, c: 5, d: [NaN] })).not.toThrow();
  });
});

describe('rankImages', () => {
  it('validates, dedupes (ordered), and ranks encyclopedic/profile CDNs highest', () => {
    const ranked = rankImages([
      'https://example.com/no-ext', // invalid → dropped
      'https://example.com/a.png', // valid (extension)
      'https://upload.wikimedia.org/face.jpg', // highest quality
      'https://media.licdn.com/img/1', // high
      'https://example.com/a.png', // dup → dropped
    ]);
    expect(ranked[0]).toBe('https://upload.wikimedia.org/face.jpg');
    expect(ranked[1]).toBe('https://media.licdn.com/img/1');
    expect(ranked).not.toContain('https://example.com/no-ext');
    expect(ranked.filter((u) => u === 'https://example.com/a.png')).toHaveLength(1);
  });
});
