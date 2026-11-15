import { Bot, Database, Download, Scale, ShieldCheck } from 'lucide-react';
import { downloadTextFile } from '../domain/export';

const COMPLIANCE_TEXT = `微光写作台 0.2 — 隐私与许可说明

一、数据边界
1. 软件不需要注册或登录。项目正文、故事设定、长期记忆、版本历史、分析报告、AI 操作记录和用量统计保存在当前 Windows 用户的本机数据目录。
2. 默认数据目录：%APPDATA%\\com.weiguang.writer
3. 自动数据库备份位于上述目录下的 backups 文件夹，默认保留 14 份。
4. 卸载应用不会自动删除用户数据。如需彻底删除，请先导出必要备份，再手动删除该数据目录。

二、AI 与第三方模型
1. AI 功能使用你自己配置的 API Key，请求会发送到你填写的模型接口。
2. 发起 AI 请求时，当前场景、选区、故事设定和伏笔状态等必要上下文会发送给该模型供应商。
3. API Key 使用 Windows DPAPI 加密，仅当前 Windows 用户可解密；不会写入 localStorage、应用日志或安装包。
4. 模型供应商可能按其隐私政策记录、处理或跨境传输请求。使用前请阅读所选供应商的条款并自行评估敏感内容。
5. 软件本身不提供任何本地 AI 模型；未配置用户自己的 API 时，AI 功能不可用。

三、MIT 开源许可摘要
1. 项目使用 MIT License，允许使用、复制、修改、合并、发布、分发、再许可和销售软件副本。
2. 分发软件或实质部分时，必须保留原版权声明和 MIT 许可声明。
3. 软件按“现状”提供，不附带任何明示或默示担保。
4. 用户对自己输入的内容、导入的稿件及 AI 生成内容承担责任，并应确保拥有必要的版权或合法授权。
5. 完整条款以仓库根目录 LICENSE 文件为准。

四、第三方组件
- Tauri、React、TipTap、ProseMirror、docx、Zustand、Lucide：MIT
- mammoth：BSD-2-Clause
- JSZip：MIT 或 GPL-3.0 双许可
- SQLite：Public Domain
- Noto Sans SC / Noto Serif SC：SIL Open Font License 1.1
- Rust 与前端依赖按其各自许可证使用；完整许可文本以对应依赖发布包为准。
`;

export function AboutComplianceView() {
  const exportNotice = () => {
    downloadTextFile('微光写作台-隐私与许可说明.txt', COMPLIANCE_TEXT);
  };

  return (
    <section className="content-card compliance-card">
      <div className="section-title-row">
        <div><p className="eyebrow">PRIVACY &amp; LICENSE</p><h2>关于与合规</h2></div>
        <Scale size={18} />
      </div>
      <p className="ai-settings-intro">隐私边界、免费使用许可和第三方组件说明。正式分发前仍建议由专业法律人员审阅条款。</p>
      <div className="compliance-grid">
        <article><Database size={16} /><strong>数据只在本机</strong><p>项目、版本和分析报告存放在 <code>%APPDATA%\com.weiguang.writer</code>。</p></article>
        <article><Bot size={16} /><strong>AI 直连供应商</strong><p>正文只会发送到你选择的模型接口；使用第三方服务前请阅读其隐私政策。</p></article>
        <article><ShieldCheck size={16} /><strong>密钥安全保存</strong><p>API Key 使用 Windows 凭据保护，不写入日志或安装包。</p></article>
        <article><Scale size={16} /><strong>MIT 开源</strong><p>源代码采用 MIT License；分发时请保留版权与许可声明。</p></article>
      </div>
      <details className="compliance-details">
        <summary>查看完整隐私与许可摘要</summary>
        <pre>{COMPLIANCE_TEXT}</pre>
      </details>
      <details className="compliance-details">
        <summary>第三方组件许可证</summary>
        <p>Tauri、React、TipTap、ProseMirror、docx、Zustand、Lucide 使用 MIT；mammoth 使用 BSD-2-Clause；JSZip 使用 MIT/GPL-3.0 双许可；SQLite 为 Public Domain。完整文本以各依赖发布包为准。</p>
      </details>
      <div className="settings-actions">
        <button className="secondary-button" type="button" onClick={exportNotice}><Download size={15} />导出隐私与许可说明</button>
      </div>
    </section>
  );
}