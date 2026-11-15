import { CheckCircle2, Coins, KeyRound, LoaderCircle, PlugZap, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AI_PROVIDER_PRESETS,
  DEFAULT_AI_SETTINGS,
  applyAutoPricing,
  clearAiApiKey,
  hasAiApiKey,
  loadAiSettings,
  saveAiApiKey,
  saveAiSettings,
  type AiSettings,
} from '../data/aiSettings';
import { testAiConnection } from '../data/aiClient';
import { formatAiCost, getAiUsageSummary, type AiUsageSummary } from '../data/aiUsage';
import { formatPricingRange, resolveAiPricing } from '../data/aiPricing';
import { useConfirm } from './ConfirmDialog';

export function AISettingsView() {
  const [settings, setSettings] = useState<AiSettings>({ ...DEFAULT_AI_SETTINGS });
  const [apiKey, setApiKey] = useState('');
  const [keyConfigured, setKeyConfigured] = useState(false);
  const [presetNote, setPresetNote] = useState('仅支持以 Bearer API Key 鉴权的 OpenAI 兼容接口');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [usageSummary, setUsageSummary] = useState<AiUsageSummary>(() => getAiUsageSummary());
  const confirm = useConfirm();

  useEffect(() => {
    const loaded = loadAiSettings();
    setSettings(loaded);
    setUsageSummary(getAiUsageSummary(loaded));
    void hasAiApiKey().then(setKeyConfigured).catch(() => setKeyConfigured(false));
  }, []);

  const update = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      return key === 'model' || key === 'base_url' ? applyAutoPricing(next) : next;
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = AI_PROVIDER_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setPresetNote(preset.note);
    setSettings((current) => applyAutoPricing({ ...current, base_url: preset.base_url, model: preset.model }));
  };

  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const saved = saveAiSettings(settings);
      setSettings(saved);
      if (apiKey.trim()) {
        await saveAiApiKey(apiKey);
        setApiKey('');
        setKeyConfigured(true);
      }
      setUsageSummary(getAiUsageSummary(settings));
      setMessage('模型设置已保存');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '设置保存失败');
    } finally { setBusy(false); }
  };

  const test = async () => {
    setTesting(true); setError(''); setMessage('');
    try {
      if (apiKey.trim()) {
        await saveAiApiKey(apiKey);
        setApiKey('');
        setKeyConfigured(true);
      } else if (!keyConfigured) {
        throw new Error('请先填写并保存模型 API Key');
      }
      const saved = saveAiSettings(settings);
      setSettings(saved);
      const result = await testAiConnection(saved);
      setMessage(`连接成功：${result.slice(0, 80)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '模型连接失败');
    } finally { setTesting(false); }
  };

  const clearKey = async () => {
    if (!(await confirm({ title: '删除模型 API Key？', description: '删除后需要重新填写 Key 才能调用模型。', confirmLabel: '删除 Key', tone: 'danger' }))) return;
    setError(''); setMessage('');
    try {
      await clearAiApiKey();
      setKeyConfigured(false);
      setMessage('API Key 已删除');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '删除 API Key 失败');
    }
  };

  return (
    <main className="module-stage">
      <header className="module-head">
        <div><p className="eyebrow">AI</p><h1>API 设置</h1><p>软件不提供内置模型。配置你自己的 OpenAI 兼容 API 后才能使用 AI 功能。</p></div>
        <div className="module-stat"><strong>{settings.pricing_resolved ? formatAiCost(usageSummary.total_cost, usageSummary.currency) : `${usageSummary.total_tokens.toLocaleString()} Token`}</strong><span>本月用量</span></div>
      </header>
      {error && <div className="ai-error" role="alert">{error}</div>}
      {message && <div className="settings-success" role="status"><CheckCircle2 size={15} />{message}</div>}

      <section className="content-card ai-settings-card">
        <div className="section-title-row"><div><p className="eyebrow">MODEL</p><h2>模型连接</h2></div><PlugZap size={18} /></div>
        <p className="ai-settings-intro">支持 OpenAI 兼容的 <code>/chat/completions</code> 接口。软件不内置本地模型，费用由你与模型供应商直接结算。</p>
        <div className="form-grid two">
          <label className="field"><span>供应商预设</span><select defaultValue="" onChange={(event) => applyPreset(event.target.value)}><option value="" disabled>选择预设</option>{AI_PROVIDER_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}</select></label>
          <label className="field"><span>模型名称</span><input value={settings.model} onChange={(event) => update('model', event.target.value)} placeholder="例如 deepseek-chat" /></label>
        </div>
        <p className="ai-provider-note">{presetNote}</p>
        <label className="field"><span>Base URL</span><input value={settings.base_url} onChange={(event) => update('base_url', event.target.value)} placeholder="https://api.example.com/v1" spellCheck={false} /></label>
        <div className="field"><span>API Key</span><div className="code-row"><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={keyConfigured ? '已安全保存；输入新 Key 可替换' : '粘贴你的模型 API Key'} autoComplete="off" /><span className={`key-status ${keyConfigured ? 'is-set' : ''}`}><KeyRound size={13} />{keyConfigured ? '已保存' : '未配置'}</span></div></div>
        <div className="ai-settings-grid">
          <label className="field"><span>创意程度 {settings.temperature.toFixed(2)}</span><input type="range" min="0" max="2" step="0.05" value={settings.temperature} onChange={(event) => update('temperature', Number(event.target.value))} /><span className="range-scale"><small>更稳定</small><small>更有创意</small></span><small className="field-help">数值越低，AI 越按已有内容稳妥地写；数值越高，变化和脑洞越多。日常续写建议 0.8。</small></label>
          <label className="field"><span>思考强度</span><select value={settings.thinking_mode} onChange={(event) => update('thinking_mode', event.target.value as typeof settings.thinking_mode)}><option value="disabled">关闭</option><option value="low">低（推荐）</option><option value="high">高</option></select><small className="field-help">思考只影响模型内部推演，不计入正文目标字数；思考 Token 仍会计入 API 用量和费用。</small></label>
          <label className="field"><span>最大输出 Token</span><input type="number" min="100" max="8000" step="100" value={settings.max_output_tokens} onChange={(event) => update('max_output_tokens', Number(event.target.value))} /></label>
          <label className="field"><span>请求超时（秒）</span><input type="number" min="15" max="300" step="5" value={settings.request_timeout_seconds} onChange={(event) => update('request_timeout_seconds', Number(event.target.value))} /></label>
          <label className="ai-strict-toggle"><input type="checkbox" checked={settings.stream} onChange={(event) => update('stream', event.target.checked)} />流式显示生成内容</label>
        </div>
        <div className="settings-actions">
          <button className="primary-button" type="button" disabled={busy || testing} onClick={() => void save()}><Save size={15} />{busy ? '保存中…' : '保存设置'}</button>
          <button className="secondary-button" type="button" disabled={busy || testing} onClick={() => void test()}>{testing ? <LoaderCircle size={15} className="spin" /> : <PlugZap size={15} />}{testing ? '测试中…' : '测试连接'}</button>
          <button className="secondary-button danger-button" type="button" disabled={!keyConfigured} onClick={() => void clearKey()}><Trash2 size={15} />删除 API Key</button>
        </div>
        <p className="settings-security-note"><ShieldCheck size={14} />API Key 使用 Windows 凭据加密保存，Key 不会写入日志。</p>
      </section>

      <section className="content-card ai-budget-card">
        <div className="section-title-row"><div><p className="eyebrow">BUDGET &amp; USAGE</p><h2>费用预估与月度预算</h2></div><Coins size={18} /></div>
        <p className="ai-settings-intro">软件会根据模型自动匹配内置参考价，无需手动填写单价。最终费用以服务商账单为准。</p>
        <div className="ai-auto-pricing">
          <div><span>自动参考价</span><strong>{formatPricingRange(resolveAiPricing(settings.model, settings.base_url))}</strong></div>
          <small>{settings.pricing_resolved ? '单价由软件根据模型自动匹配，无需手动填写。最终以服务商账单为准。' : '该模型暂无内置参考价，但仍会记录实际 Token；可用 Token 上限控制用量。'}</small>
        </div>
        <div className="ai-settings-grid cost-grid">
          <label className="field"><span>月度 Token 上限（0 为不限制）</span><input type="number" min="0" step="1000" value={settings.monthly_token_budget} onChange={(event) => update('monthly_token_budget', Number(event.target.value))} /></label>
          <label className="field"><span>月度金额预算（0 为不限制）</span><input type="number" min="0" step="0.01" value={settings.monthly_budget} disabled={!settings.pricing_resolved} onChange={(event) => update('monthly_budget', Number(event.target.value))} /></label>
        </div>
        <div className="ai-usage-strip">
          <div><span>本月调用</span><strong>{usageSummary.calls} 次</strong></div>
          <div><span>输入 / 输出（含思考）</span><strong>{usageSummary.input_tokens.toLocaleString()} / {usageSummary.output_tokens.toLocaleString()}</strong></div>
          <div><span>其中思考 Token</span><strong>{usageSummary.reasoning_tokens.toLocaleString()}</strong></div>
          <div><span>本月估算费用</span><strong>{settings.pricing_resolved ? formatAiCost(usageSummary.total_cost, usageSummary.currency) : '暂无参考价'}</strong></div>
          <div><span>Token 上限</span><strong>{settings.monthly_token_budget > 0 ? `${usageSummary.total_tokens.toLocaleString()} / ${settings.monthly_token_budget.toLocaleString()}` : '未设置上限'}</strong></div>
        </div>
        <p className="settings-security-note"><ShieldCheck size={14} />每次请求先按输入估算和最大输出预占预算；超过 Token 或其他已设置上限时会在发送前阻止。</p>
      </section>
    </main>
  );
}
