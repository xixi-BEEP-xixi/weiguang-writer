import { Bot, Database, Download, Scale, ShieldCheck } from 'lucide-react';
import { downloadTextFile } from '../domain/export';
import USER_TERMS_TEXT from '../../src-tauri/legal/USER_TERMS.txt?raw';

const COMPLIANCE_TEXT = USER_TERMS_TEXT.trim();

export function AboutComplianceView() {
  const exportNotice = () => {
    downloadTextFile('微光写作台-用户条款与隐私说明.txt', COMPLIANCE_TEXT);
  };

  return (
    <section className="content-card compliance-card">
      <div className="section-title-row">
        <div><p className="eyebrow">PRIVACY &amp; LICENSE</p><h2>用户条款与隐私</h2></div>
        <Scale size={18} />
      </div>
      <p className="ai-settings-intro">安装向导与软件内使用同一份用户条款。正式商业分发前，仍建议由专业法律人员审阅。</p>
      <div className="compliance-grid">
        <article><Database size={16} /><strong>数据只在本机</strong><p>项目、版本和分析报告存放在 <code>%APPDATA%\com.weiguang.writer</code>。</p></article>
        <article><Bot size={16} /><strong>AI 直连供应商</strong><p>正文只会发送到你选择的模型接口；使用第三方服务前请阅读其隐私政策。</p></article>
        <article><ShieldCheck size={16} /><strong>密钥安全保存</strong><p>API Key 使用 Windows 凭据保护，不写入日志或安装包。</p></article>
        <article><Scale size={16} /><strong>用户使用条款</strong><p>官方发行版适用随附用户条款；源代码同时依 MIT License 授权。</p></article>
      </div>
      <details className="compliance-details">
        <summary>查看完整用户条款与隐私说明</summary>
        <pre>{COMPLIANCE_TEXT}</pre>
      </details>
      <details className="compliance-details">
        <summary>第三方组件许可证</summary>
        <p>Tauri、React、TipTap、ProseMirror、docx、Zustand、Lucide 使用 MIT；mammoth 使用 BSD-2-Clause；JSZip 使用 MIT/GPL-3.0 双许可；SQLite 为 Public Domain。完整文本以各依赖发布包为准。</p>
      </details>
      <div className="settings-actions">
        <button className="secondary-button" type="button" onClick={exportNotice}><Download size={15} />导出用户条款与隐私说明</button>
      </div>
    </section>
  );
}