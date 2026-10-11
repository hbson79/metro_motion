import { describe, it, expect } from 'vitest';
import { validateUpload, filterContent, safeUrl } from '../lib/domain';
describe('upload boundary', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.JPEG', 'image/jpeg'],
    ['photo.PNG', 'image/png'],
    ['photo.WebP', 'image/webp'],
  ])('accepts %s as a document image only', (name, type) => {
    expect(validateUpload({ name, type, size: 100 }, 'documents')).toBeNull();
    expect(validateUpload({ name, type, size: 100 }, 'videos')).toBeTruthy();
  });
  it('rejects unsafe images, mismatched MIME and oversized photos', () => {
    for (const [name, type, size] of [
      ['photo.jpg', 'image/png', 100],
      ['photo.svg', 'image/svg+xml', 100],
      ['photo.jpg', 'image/jpeg', 0],
      ['photo.webp', 'image/webp', 21 * 1024 * 1024],
    ] as const)
      expect(validateUpload({ name, type, size }, 'documents')).toBeTruthy();
  });
  it('accepts supported files and rejects empty, oversized, mismatched files', () => {
    expect(validateUpload({ name: 'clip.mp4', type: 'video/mp4', size: 100 }, 'videos')).toBeNull();
    expect(validateUpload({ name: 'x.exe', type: 'video/mp4', size: 100 }, 'videos')).toBeTruthy();
    expect(
      validateUpload({ name: 'x.pdf', type: 'application/pdf', size: 0 }, 'documents'),
    ).toBeTruthy();
    expect(
      validateUpload(
        { name: 'x.pdf', type: 'application/pdf', size: 21 * 1024 * 1024 },
        'documents',
      ),
    ).toBeTruthy();
  });
});
describe('discovery', () => {
  it('filters Korean titles and category without mutating input', () => {
    const rows = [
      { title: '서울의 밤', description: '도시', category: '도시' },
      { title: '자연', description: '숲', category: '자연' },
    ];
    expect(filterContent(rows, '서울', '도시')).toEqual([rows[0]]);
    expect(filterContent(rows, '', '전체')).toHaveLength(2);
  });
});
describe('safe links', () => {
  it('allows only https URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('https://example.com/a')).toBe('https://example.com/a');
    expect(safeUrl('http://example.com')).toBeNull();
  });
});
