// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_WRITING_PREFERENCES, loadWritingPreferences, saveWritingPreferences } from './writingPreferences';

describe('writing preferences', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to Chinese long-form typography', () => {
    expect(loadWritingPreferences()).toEqual(DEFAULT_WRITING_PREFERENCES);
    expect(DEFAULT_WRITING_PREFERENCES.firstLineIndent).toBe(true);
  });

  it('persists supported typography choices and rejects invalid values', () => {
    saveWritingPreferences({ firstLineIndent: false, fontFamily: 'sans', fontSize: 22, lineHeight: 1.8, paragraphSpacing: 1, textAlign: 'left' });
    expect(loadWritingPreferences()).toMatchObject({ firstLineIndent: false, fontFamily: 'sans', fontSize: 22, lineHeight: 1.8, textAlign: 'left' });
    localStorage.setItem('weiguang.writing.preferences.v1', JSON.stringify({ fontSize: 99, lineHeight: 9, textAlign: 'weird' }));
    expect(loadWritingPreferences()).toMatchObject({ fontSize: 18, lineHeight: 1.95, textAlign: 'justify' });
  });
});