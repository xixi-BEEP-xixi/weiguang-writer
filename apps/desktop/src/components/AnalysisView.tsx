import { BookOpenCheck, Download, FileText, LoaderCircle, Play, RotateCcw, ShieldCheck, Square, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { directChat } from '../data/aiClient';
import { loadAiSettings } from '../data/aiSettings';
import { loadLatestAnalysisReport, saveAnalysisReport, type StoredAnalysisReport } from '../data/localArtifactStore';
import { useWriterStore } from '../data/writerStore';
import { collectPlainText } from '../domain/blocks';
import { docxToManuscriptText } from '../domain/importers';
import { AnalysisReport } from './AnalysisReport';
import { PageGuideBubble } from './PageGuideBubble';

type AnalysisKind = 'book_scan' | 'book_analysis';

function isSupportedAnalysisFile(file: File): boolean {
  return /\.(txt|md|markdown|docx)$/i.test(file.name);
}



function chunkText(text: string, size = 8000): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const chunks: string[] = [];
  let offset = 0;
  while (offset < normalized.length) {
    let end = Math.min(normalized.length, offset + size);
    if (end < normalized.length) {
      const boundary = normalized.lastIndexOf('\n', end);
      if (boundary > offset + size * 0.6) end = boundary;
    }
    chunks.push(normalized.slice(offset, end).trim());
    offset = end;
  }
  return chunks;
}

function analysisSystemPrompt(kind: AnalysisKind): string {
  if (kind === 'book_scan') {
    return '你是严谨的中文长篇小说编辑。对整部作品做一致性体检，重点检查人物事实、时间线、设定、称谓、逻辑因果、伏笔遗漏和重复矛盾。输出 Markdown，按严重程度列出问题，并附短证据。不要修改正文。';
  }
  return '你是资深中文小说策划编辑。对整部作品做拆书分析，输出 Markdown 报告，必须包含：全书概述、结构与章节节拍、主要人物与关系、时间线、伏笔与回收、爽点与钩子、节奏问题、文风特征、可借鉴技巧、证据引用。只使用提供文本，不虚构情节。';
}

export function AnalysisView({ kind }: { kind: AnalysisKind }) {
  const data = useWriterStore((state) => state.data);
  const [sourceMode, setSourceMode] = useState<'project' | 'file'>('project');
  const [file, setFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [report, setReport] = useState<StoredAnalysisReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const runSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void loadLatestAnalysisReport(kind).then((saved) => { if (!cancelled) setReport(saved); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [kind]);

  const projectText = useMemo(() => {
    const chapters = data.chapters.filter((chapter) => chapter.projectId === data.activeProjectId).sort((a, b) => a.sort - b.sort);
    return chapters.map((chapter) => {
      const scenes = data.scenes.filter((scene) => scene.chapterId === chapter.id).sort((a, b) => a.sort - b.sort);
      return [`# ${chapter.title}`, ...scenes.map((scene) => `## ${scene.title}\n${collectPlainText(scene.doc)}`)].join('\n\n');
    }).join('\n\n');
  }, [data]);

  const readSource = async (): Promise<string> => {
    if (sourceMode === 'project') return projectText;
    if (!file) throw new Error('请选择 TXT、Markdown 或 DOCX 文件');
    if (!isSupportedAnalysisFile(file)) throw new Error('仅支持 TXT、Markdown 或 DOCX 文件');
    if (!rightsConfirmed) throw new Error('请确认你拥有该文本的版权或授权');
    return file.name.toLowerCase().endsWith('.docx') ? docxToManuscriptText(file) : file.text();
  };

  const selectFile = (selected: File | null) => {
    setRightsConfirmed(false);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!isSupportedAnalysisFile(selected)) {
      setFile(null);
      setError('仅支持 TXT、Markdown 或 DOCX 文件');
      return;
    }
    setError('');
    setFile(selected);
  };

  const run = async () => {
    const sequence = ++runSeqRef.current;
    setBusy(true); setError(''); setProgress('');
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const source = await readSource();
      const chunks = chunkText(source);
      if (chunks.length === 0) throw new Error('没有可分析的正文');
      const loadedSettings = loadAiSettings();
      const settings = { ...loadedSettings, stream: false, max_output_tokens: 16000 };
      let material = source;
      if (chunks.length > 1) {
        const notes: string[] = [];
        for (let index = 0; index < chunks.length; index += 1) {
          setProgress(`压缩第 ${index + 1} / ${chunks.length} 个分块`);
          const result = await directChat([
            { role: 'system', content: '你是小说编辑助理。压缩以下文本为高密度编辑笔记，保留人物、事件、时间、地点、冲突、伏笔、钩子和文风信息，不虚构。' },
            { role: 'user', content: chunks[index] },
          ], settings, { signal: controller.signal }, {
            projectId: data.activeProjectId,
            operation: 'analysis_chunk',
            instruction: '压缩全书分块为编辑笔记',
            record: false,
            useMemory: false,
          });
          notes.push(`## 分块 ${index + 1}\n${result.text}`);
        }
        material = notes.join('\n\n');
      }
      setProgress('生成最终报告');
      const result = await directChat([
        { role: 'system', content: analysisSystemPrompt(kind) },
        { role: 'user', content: `文本来源：${sourceMode === 'project' ? '当前项目' : file?.name || '上传文件'}\n\n${material}` },
      ], settings, { signal: controller.signal }, {
        projectId: data.activeProjectId,
        operation: kind,
        instruction: `${kind === 'book_analysis' ? '拆书' : '全书体检'}：${sourceMode === 'project' ? '当前项目' : file?.name || '上传文件'}`,
        record: true,
        useMemory: sourceMode === 'project',
      });
      const saved = await saveAnalysisReport(kind, sourceMode === 'project' ? '当前项目' : file?.name || '上传文件', result.text);
      setReport(saved);
      setProgress('分析完成');
    } catch (caught) {
      if (sequence !== runSeqRef.current) return;
      if (controller.signal.aborted) setError('分析已取消');
      else setError(caught instanceof Error ? caught.message : typeof caught === 'string' ? caught : '分析失败');
    } finally {
      if (sequence === runSeqRef.current) {
        setBusy(false);
        abortRef.current = null;
      }
    }
  };

  const cancel = () => {
    runSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setProgress('');
    setError('分析已取消');
  };

  const exportReport = () => {
    if (!report) return;
    const blob = new Blob([report.text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${kind === 'book_analysis' ? '拆书报告' : '全书体检'}-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <main className="module-stage">
      <header className="module-head">
        <div><p className="eyebrow">{kind === 'book_analysis' ? 'BOOK ANALYSIS' : 'FULL BOOK SCAN'}</p><h1>{kind === 'book_analysis' ? '拆书' : '全书体检'}</h1><p>整书分析在本机分块执行，所需文本只发送到你配置的模型接口，报告保存在本机。</p></div>
        <div className="module-stat"><strong>AI</strong><span>深度分析</span></div>
      </header>
      <PageGuideBubble
        id={kind === 'book_analysis' ? 'book-analysis' : 'book-scan'}
        target='[data-tour="analysis-workspace"]'
        title={kind === 'book_analysis' ? '拆书怎么用' : '全书体检怎么用'}
        points={kind === 'book_analysis' ? [
          '选择当前项目，或上传拥有版权或授权的 TXT、Markdown、DOCX 旧稿。',
          '开始分析后会生成结构、人物、节拍和文风报告。',
          '报告只作参考，不会改写正文。',
        ] : [
          '选择当前项目，读取全部章节。',
          '检查人物、时间线、设定、因果和伏笔。',
          '根据报告逐条核对，修改仍由作者完成。',
        ]}
      />
            {error && <div className="ai-error" role="alert">{error}</div>}
      <section className="content-card analysis-local-card" data-tour="analysis-workspace">
        <div className="section-title-row"><div><p className="eyebrow">SOURCE</p><h2>分析来源</h2></div><FileText size={18} /></div>
        <div className="segmented" role="tablist" aria-label="分析来源"><button type="button" className={sourceMode === 'project' ? 'is-active' : ''} onClick={() => setSourceMode('project')}>当前项目</button><button type="button" className={sourceMode === 'file' ? 'is-active' : ''} onClick={() => setSourceMode('file')}>上传旧稿</button></div>
        {sourceMode === 'project' ? <p className="analysis-source-note">将读取当前项目的全部章节与正文，共 {projectText.length.toLocaleString()} 字。不会修改作者正文。</p> : <div className="analysis-file-row"><label className="secondary-button file-picker"><Upload size={15} />选择 TXT / Markdown / DOCX<input type="file" accept=".txt,.md,.markdown,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => selectFile(event.target.files?.[0] ?? null)} /></label><span>{file?.name ?? '未选择文件'}</span></div>}
        {sourceMode === 'file' && <label className="ai-strict-toggle"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />我确认拥有该文本的版权或合法授权</label>}
        <div className="analysis-actions"><button className="primary-button" type="button" disabled={busy || (sourceMode === 'file' && (!file || !rightsConfirmed))} onClick={() => void run()}>{busy ? <LoaderCircle size={15} className="spin" /> : <Play size={15} />}{busy ? '分析中…' : '开始分析'}</button>{busy && <button className="secondary-button" type="button" onClick={cancel}><Square size={14} />取消</button>}</div>
        {progress && <p className="analysis-progress">{progress}</p>}
      </section>
      {report ? <section className="content-card analysis-report-card">
        <header className="analysis-report-heading">
          <div>
            <p className="eyebrow">REPORT</p>
            <h2>{kind === 'book_analysis' ? '拆书报告' : '全书体检报告'}</h2>
            <p className="analysis-report-meta-line"><span>{report.source}</span><span>{new Date(report.created_at).toLocaleString()}</span><span>约 {report.text.length.toLocaleString()} 字</span></p>
          </div>
          <div className="analysis-actions"><button className="secondary-button" type="button" onClick={exportReport}><Download size={14} />导出 Markdown</button><button className="secondary-button" type="button" onClick={() => setReport(null)}><RotateCcw size={14} />清空显示</button></div>
        </header>
        <AnalysisReport text={report.text} />
      </section> : <section className="content-card analysis-report-card"><div className="module-empty"><BookOpenCheck size={24} /><strong>还没有分析报告</strong><p>配置模型 API Key 后，从当前项目或上传旧稿生成分析报告。</p></div></section>}
      <p className="settings-security-note"><ShieldCheck size={14} />报告会保留在项目中。当前支持 TXT、Markdown、DOCX 来源与 Markdown 导出。</p>
    </main>
  );
}
