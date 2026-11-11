import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('UTF-8 Encoding & Content Script Sanitization', () => {
  it('should ensure FloatingPanel.tsx does not contain raw symbols ▲, ▼, ⚙', () => {
    const floatingPanelPath = path.resolve(
      process.cwd(),
      'entrypoints/zalo.content/FloatingPanel.tsx',
    );
    const content = fs.readFileSync(floatingPanelPath, 'utf8');

    expect(content.includes('▲')).toBe(false);
    expect(content.includes('▼')).toBe(false);
    expect(content.includes('⚙')).toBe(false);
    expect(content.includes('\\u25B2')).toBe(true);
    expect(content.includes('\\u25BC')).toBe(true);
    expect(content.includes('\\u2699')).toBe(true);
  });

  it('should ensure all built .js files in .output/chrome-mv3 are valid UTF-8 without non-characters', () => {
    const outputPath = path.resolve(process.cwd(), '.output/chrome-mv3');
    if (!fs.existsSync(outputPath)) {
      // If not built yet in CI environment, skip or pass
      return;
    }

    function getFiles(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          results = results.concat(getFiles(full));
        } else if (file.endsWith('.js')) {
          results.push(full);
        }
      }
      return results;
    }

    const jsFiles = getFiles(outputPath);
    expect(jsFiles.length).toBeGreaterThan(0);

    const decoder = new TextDecoder('utf-8', { fatal: true });

    for (const filePath of jsFiles) {
      const buffer = fs.readFileSync(filePath);

      // Verify no UTF-8 BOM
      expect(buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf).toBe(false);

      // Verify strict UTF-8 decoding
      const text = decoder.decode(buffer);

      // Verify no raw non-characters that break Chrome extension loading
      expect(text.includes('\uFFFF')).toBe(false);
      expect(text.includes('\uFFFE')).toBe(false);

      // Verify no raw symbols in content script
      if (filePath.includes('zalo.js')) {
        expect(text.includes('▲')).toBe(false);
        expect(text.includes('▼')).toBe(false);
        expect(text.includes('⚙')).toBe(false);
      }
    }
  });
});
