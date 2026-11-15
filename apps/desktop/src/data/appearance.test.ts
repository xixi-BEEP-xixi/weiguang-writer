// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, applyAppearance, loadAppearance, normalizeBackgroundColor } from './appearance';

describe('appearance settings', () => {
  beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('style'); });

  it('defaults to the white workbench', () => {
    expect(DEFAULT_APPEARANCE.backgroundColor).toBe('#f7f6f1');
    expect(loadAppearance().backgroundColor).toBe('#f7f6f1');
  });

  it('accepts arbitrary colors and keeps background images', () => {
    expect(normalizeBackgroundColor('#abc')).toBe('#aabbcc');
    applyAppearance({ backgroundColor: '#224466', customImage: 'data:image/jpeg;base64,test', imageOpacity: 0.4 });
    expect(document.documentElement.dataset.tone).toBe('dark');
    expect(document.documentElement.dataset.hasImage).toBe('true');
    expect(document.documentElement.style.getPropertyValue('--app-background-image')).toContain('data:image/jpeg');
  });
});