export type ProseFontFamily = 'serif' | 'sans';
export type ProseTextAlign = 'left' | 'justify' | 'center';

export interface WritingPreferences {
  firstLineIndent: boolean;
  fontFamily: ProseFontFamily;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  textAlign: ProseTextAlign;
}

const STORAGE_KEY = 'weiguang.writing.preferences.v1';

export const DEFAULT_WRITING_PREFERENCES: WritingPreferences = {
  firstLineIndent: true,
  fontFamily: 'serif',
  fontSize: 18,
  lineHeight: 1.95,
  paragraphSpacing: 0.65,
  textAlign: 'justify',
};

function finiteChoice(value: unknown, choices: number[], fallback: number): number {
  const number = Number(value);
  return choices.includes(number) ? number : fallback;
}

export function loadWritingPreferences(): WritingPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<WritingPreferences>;
    return {
      firstLineIndent: parsed.firstLineIndent !== false,
      fontFamily: parsed.fontFamily === 'sans' ? 'sans' : 'serif',
      fontSize: finiteChoice(parsed.fontSize, [16, 17, 18, 19, 20, 22, 24], DEFAULT_WRITING_PREFERENCES.fontSize),
      lineHeight: finiteChoice(parsed.lineHeight, [1.5, 1.65, 1.8, 1.95, 2.1], DEFAULT_WRITING_PREFERENCES.lineHeight),
      paragraphSpacing: finiteChoice(parsed.paragraphSpacing, [0, 0.35, 0.65, 1], DEFAULT_WRITING_PREFERENCES.paragraphSpacing),
      textAlign: parsed.textAlign === 'left' || parsed.textAlign === 'center' ? parsed.textAlign : 'justify',
    };
  } catch {
    return { ...DEFAULT_WRITING_PREFERENCES };
  }
}

export function saveWritingPreferences(preferences: WritingPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
}