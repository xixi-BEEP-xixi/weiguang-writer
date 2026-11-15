import { CheckCircle2, CircleHelp, Image, Palette, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { AboutComplianceView } from './AboutComplianceView';
import { openOnboardingGuide } from './OnboardingGuide';
import {
  DEFAULT_APPEARANCE,
  applyAppearance,
  imageFileToBackground,
  loadAppearance,
  normalizeBackgroundColor,
  saveAppearance,
} from '../data/appearance';

export function SettingsView() {
  const [appearance, setAppearance] = useState(() => loadAppearance());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const update = (next: typeof appearance, notice = '外观设置已更新') => {
    setAppearance(next);
    applyAppearance(next);
    saveAppearance(next);
    setMessage(notice);
    setError('');
  };

  const changeColor = (value: string) => {
    update({ ...appearance, backgroundColor: normalizeBackgroundColor(value) }, '背景色已更新');
  };

  const uploadBackground = async (file: File | null) => {
    if (!file) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const customImage = await imageFileToBackground(file);
      update({ ...appearance, customImage }, '自定义背景图片已更新');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '背景图片处理失败');
    } finally { setBusy(false); }
  };

  const removeBackground = () => update({ ...appearance, customImage: '' }, '已移除背景图片');
  const resetAppearance = () => update({ ...DEFAULT_APPEARANCE }, '已恢复默认白色背景');

  return (
    <main className="module-stage">
      <header className="module-head">
        <div><p className="eyebrow">SETTINGS</p><h1>设置</h1><p>调整软件外观，并查看界面导览与许可信息。</p></div>
        <div className="settings-head-actions">
          <button className="secondary-button" type="button" onClick={openOnboardingGuide}><CircleHelp size={15} />界面导览</button>
          <div className="module-stat"><strong>v0.2</strong><span>当前版本</span></div>
        </div>
      </header>
      {error && <div className="ai-error" role="alert">{error}</div>}
      {message && <div className="settings-success" role="status"><CheckCircle2 size={15} />{message}</div>}

      <section className="content-card appearance-card">
        <div className="section-title-row"><div><p className="eyebrow">APPEARANCE</p><h2>写作背景</h2></div><Palette size={18} /></div>
        <p className="ai-settings-intro">默认使用低干扰白色背景。可以选择任意背景色，也可以导入自己的图片；设置会自动保存。</p>

        <div className="appearance-color-row">
          <label className="appearance-color-picker">
            <input type="color" value={appearance.backgroundColor} onChange={(event) => changeColor(event.target.value)} aria-label="选择背景色" />
            <span><strong>自定义背景色</strong><small>{appearance.backgroundColor.toUpperCase()}</small></span>
          </label>
          <button className="secondary-button" type="button" onClick={resetAppearance}><RotateCcw size={15} />恢复白色</button>
        </div>

        <div className="custom-background-controls">
          <div
            className="custom-background-preview"
            style={{
              backgroundColor: appearance.backgroundColor,
              backgroundImage: appearance.customImage ? `url("${appearance.customImage}")` : undefined,
            }}
          >
            {!appearance.customImage && <Image size={24} />}
          </div>
          <div>
            <label className="secondary-button file-picker"><Upload size={15} />{appearance.customImage ? '更换背景图片' : '导入背景图片'}<input type="file" accept="image/*" disabled={busy} onChange={(event) => void uploadBackground(event.target.files?.[0] ?? null)} /></label>
            {appearance.customImage && <button className="secondary-button" type="button" onClick={removeBackground}><Trash2 size={15} />移除背景图片</button>}
            <label className="appearance-opacity"><span>图片显示强度 {Math.round(appearance.imageOpacity * 100)}%</span><input type="range" min="0.08" max="0.9" step="0.02" value={appearance.imageOpacity} onChange={(event) => update({ ...appearance, imageOpacity: Number(event.target.value) })} /></label>
          </div>
        </div>
      </section>
      <AboutComplianceView />
    </main>
  );
}