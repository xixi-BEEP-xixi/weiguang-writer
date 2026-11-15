export interface AppearanceSettings {
  backgroundColor: string;
  customImage: string;
  imageOpacity: number;
}

const APPEARANCE_KEY = 'weiguang.appearance.v2';
const LEGACY_APPEARANCE_KEY = 'weiguang.appearance.v1';
const DEFAULT_BACKGROUND = '#f7f6f1';

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  backgroundColor: DEFAULT_BACKGROUND,
  customImage: '',
  imageOpacity: 0.5,
};

interface Rgb { r: number; g: number; b: number; }

function parseHexColor(value: unknown): Rgb | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/^#/, '');
  const expanded = normalized.length === 3 ? normalized.split('').map((part) => part + part).join('') : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) return null;
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function mix(from: string, to: string, amount: number): string {
  const a = parseHexColor(from) ?? parseHexColor(DEFAULT_BACKGROUND)!;
  const b = parseHexColor(to) ?? a;
  return toHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}

function luminance(color: string): number {
  const rgb = parseHexColor(color) ?? parseHexColor(DEFAULT_BACKGROUND)!;
  const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function normalizeBackgroundColor(value: unknown): string {
  return toHex(parseHexColor(value) ?? parseHexColor(DEFAULT_BACKGROUND)!);
}

export function loadAppearance(): AppearanceSettings {
  try {
    const current = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? 'null') as Partial<AppearanceSettings> | null;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_APPEARANCE_KEY) ?? 'null') as Partial<AppearanceSettings> | null;
    const parsed = current ?? legacy ?? {};
    return {
      backgroundColor: normalizeBackgroundColor(parsed.backgroundColor),
      customImage: typeof parsed.customImage === 'string' ? parsed.customImage : '',
      imageOpacity: Math.min(0.9, Math.max(0.08, Number(parsed.imageOpacity ?? DEFAULT_APPEARANCE.imageOpacity))),
    };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(settings: AppearanceSettings): void {
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(settings));
  localStorage.removeItem(LEGACY_APPEARANCE_KEY);
}

export function applyAppearance(settings: AppearanceSettings): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const background = normalizeBackgroundColor(settings.backgroundColor);
  const dark = luminance(background) < 0.38;
  const white = '#ffffff';
  const black = '#171b18';

  root.dataset.appearance = 'custom';
  root.dataset.tone = dark ? 'dark' : 'light';
  root.dataset.hasImage = settings.customImage ? 'true' : 'false';
  root.style.colorScheme = dark ? 'dark' : 'light';

  const surface0 = background;
  const surface1 = dark ? mix(background, white, 0.055) : mix(background, white, 0.72);
  const surface2 = dark ? mix(background, white, 0.09) : mix(background, white, 0.92);
  const surface3 = dark ? mix(background, white, 0.14) : mix(background, black, 0.055);
  const line = dark ? mix(background, white, 0.18) : mix(background, black, 0.12);
  const lineSoft = dark ? mix(background, white, 0.1) : mix(background, black, 0.07);

  root.style.setProperty('--surface-0', surface0);
  root.style.setProperty('--surface-1', surface1);
  root.style.setProperty('--surface-2', surface2);
  root.style.setProperty('--surface-3', surface3);
  root.style.setProperty('--text-primary', dark ? '#f3f0e8' : '#1d231f');
  root.style.setProperty('--text-secondary', dark ? '#d1d2cb' : '#4d574f');
  root.style.setProperty('--text-tertiary', dark ? '#a6aaa3' : '#747d75');
  root.style.setProperty('--text-disabled', dark ? '#777d77' : '#a0a7a1');
  root.style.setProperty('--accent-primary', dark ? '#dfb47a' : '#9a6431');
  root.style.setProperty('--accent-quiet', dark ? '#3b2d1d' : '#f1e5d8');
  root.style.setProperty('--teal', dark ? '#83c5ad' : '#33745f');
  root.style.setProperty('--teal-soft', dark ? '#1c342e' : '#e3f0ea');
  root.style.setProperty('--danger', dark ? '#ed8a8a' : '#ae4040');
  root.style.setProperty('--line', line);
  root.style.setProperty('--line-soft', lineSoft);
  root.style.setProperty('--control-bg', dark ? 'rgba(255,255,255,.055)' : 'rgba(24,34,28,.045)');
  root.style.setProperty('--hover-bg', dark ? 'rgba(255,255,255,.09)' : 'rgba(24,34,28,.075)');
  root.style.setProperty('--sunken-bg', dark ? 'rgba(0,0,0,.16)' : 'rgba(24,34,28,.035)');
  root.style.setProperty('--titlebar-bg', dark ? mix(background, black, 0.16) : mix(background, white, 0.5));
  root.style.setProperty('--nav-bg', dark ? mix(background, black, 0.08) : mix(background, white, 0.25));
  root.style.setProperty('--accent-ink', dark ? '#1c160f' : '#ffffff');
  root.style.setProperty('--app-background-image', settings.customImage ? `url("${settings.customImage}")` : 'none');
  root.style.setProperty('--app-background-opacity', String(settings.imageOpacity));
}

export async function imageFileToBackground(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件');
  const bitmap = await createImageBitmap(file);
  const maxEdge = 2200;
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法处理这张图片');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.86;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 4_500_000 && quality > 0.5) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > 4_500_000) throw new Error('图片过大，请选择更小的文件');
  return dataUrl;
}