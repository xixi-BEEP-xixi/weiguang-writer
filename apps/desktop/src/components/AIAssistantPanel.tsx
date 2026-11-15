import type { Editor } from '@tiptap/core';
import { BrainCircuit, Copy, CornerDownLeft, LoaderCircle, ShieldCheck, Sparkles, TriangleAlert, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeChapter, estimateStreamRequest, extractMemoryCandidates, streamAI, type AIConflict, type AIStreamResult } from '../data/aiClient';
import { loadAiSettings } from '../data/aiSettings';
import { markAiOperationInserted } from '../data/aiMemoryStore';
import { formatAiCost } from '../data/aiUsage';
import { buildContextPack, type AIOperation } from '../data/contextPack';
import { useWriterStore } from '../data/writerStore';
import { createId } from '../domain/ids';
import { createSceneVersion } from '../data/versionClient';
import type { Scene } from '../domain/types';
import { diffParagraphs, textToParagraphs } from '../domain/textDiff';

interface AIAssistantPanelProps {
  editor: Editor;
  scene: Scene;
  chapterId: string;
  onClose: () => void;
}

const operationOptions: Array<{ key: AIOperation; label: string }> = [
  { key: 'continue', label: '续写' },
  { key: 'rewrite', label: '改写' },
  { key: 'outline', label: '大纲' },
  { key: 'character', label: '人物' },
  { key: 'ask', label: '提问' },
];

const severityLabel: Record<AIConflict['severity'], string> = {
  high: '硬矛盾',
  medium: '可疑',
  low: '风格',
};

function blockIdAt(editor: Editor, position: number): string {
  const resolved = editor.state.doc.resolve(Math.max(1, Math.min(position, editor.state.doc.content.size)));
  for (let depth = resolved.depth; depth >= 0; depth -= 1) {
    const id = resolved.node(depth)?.attrs?.blockId;
    if (id) return String(id);
  }
  return '';
}

export function AIAssistantPanel({ editor, scene, chapterId, onClose }: AIAssistantPanelProps) {
  const data = useWriterStore((state) => state.data);
  const [operation, setOperation] = useState<AIOperation>('continue');
  const [instruction, setInstruction] = useState('');
  const [targetLength, setTargetLength] = useState(800);
  const [result, setResult] = useState<AIStreamResult | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [conflicts, setConflicts] = useState<AIConflict[] | null>(null);
  const [strict, setStrict] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generatedOperation, setGeneratedOperation] = useState<AIOperation>('continue');
  const [generatedSelection, setGeneratedSelection] = useState<{ from: number; to: number; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [memoryExtracting, setMemoryExtracting] = useState(false);
  const [memoryNotice, setMemoryNotice] = useState('');
  const setActiveNav = useWriterStore((state) => state.setActiveNav);
  const project = data.projects.find((item) => item.id === scene.projectId);
  const projectMemoryEnabled = project?.aiMemoryEnabled === true;

  const selection = useMemo(() => {
    const { from, to } = editor.state.selection;
    return {
      text: from === to ? '' : editor.state.doc.textBetween(from, to, '\n', ' '),
      startId: blockIdAt(editor, from),
      endId: blockIdAt(editor, to),
    };
  }, [editor, editor.state.selection]);

  const settings = useMemo(() => loadAiSettings(), []);
  const context = useMemo(
    () => buildContextPack(data, scene, selection.text, selection.startId, selection.endId),
    [data, scene, selection.text, selection.startId, selection.endId],
  );
  const estimate = useMemo(
    () => estimateStreamRequest(operation, instruction, targetLength, context, settings),
    [operation, instruction, targetLength, context, settings],
  );
  const budgetBlocked = estimate.token_budget_exceeded || estimate.budget_exceeded || (estimate.monthly_budget > 0 && !estimate.pricing_configured);
  const rewriteNeedsSelection = operation === 'rewrite' && !selection.text.trim();
  const generatedText = result?.text || streamingText;
  const rewriteDiff = useMemo(
    () => generatedOperation === 'rewrite' && generatedSelection
      ? diffParagraphs(textToParagraphs(generatedSelection.text), textToParagraphs(generatedText))
      : [],
    [generatedOperation, generatedSelection, generatedText],
  );


  const generate = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    setStreamingText('');
    setCopied(false);
    const controller = new AbortController();
    abortRef.current = controller;
    const { from, to } = editor.state.selection;
    setGeneratedOperation(operation);
    setGeneratedSelection(operation === 'rewrite' ? { from, to, text: selection.text } : null);
    try {
      const response = await streamAI(
        operation,
        scene.projectId,
        scene.id,
        chapterId,
        instruction,
        targetLength,
        context,
        { signal: controller.signal, onDelta: (chunk) => setStreamingText((current) => current + chunk) },
      );
      setResult(response);
      setStreamingText(response.text);
    } catch (caught) {
      if (controller.signal.aborted || (caught instanceof DOMException && caught.name === 'AbortError')) setError('请求已取消');
      else setError(caught instanceof Error ? caught.message : 'AI 请求失败');
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

  const checkScene = async () => {
    setAnalyzing(true);
    setError('');
    try {
      setConflicts(await analyzeChapter(scene.projectId, chapterId, scene.id, context, strict));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '场景体检失败');
    } finally {
      setAnalyzing(false);
    }
  };

  const applyResult = async () => {
    const text = generatedText;
    if (!text.trim()) return;
    await createSceneVersion(scene.projectId, scene.id, editor.getJSON(), 'AI 应用前自动恢复点').catch(() => undefined);
    const generationId = result?.requestId || createId();
    const nodes = text.split(/\n+/).filter(Boolean).map((paragraph) => ({
      type: 'paragraph',
      attrs: { blockId: createId(), aiGenerated: true, generationId },
      content: paragraph ? [{ type: 'text', text: paragraph }] : [],
    }));
    if (generatedOperation === 'rewrite') {
      if (!generatedSelection?.text.trim() || generatedSelection.from === generatedSelection.to) {
        setError('改写需要先生成一次带选区的结果。');
        return;
      }
      editor.chain().focus().insertContentAt({ from: generatedSelection.from, to: generatedSelection.to }, nodes, { updateSelection: true }).run();
    } else {
      editor.chain().focus('end').insertContent(nodes).run();
    }
    if (result?.operationId) void markAiOperationInserted(scene.projectId, result.operationId);
  };

  const extractMemory = async () => {
    if (!projectMemoryEnabled) {
      setMemoryNotice('请先在长期记忆页开启该书的记忆功能。');
      return;
    }
    setMemoryExtracting(true);
    setError('');
    setMemoryNotice('');
    try {
      const extraction = await extractMemoryCandidates(scene.projectId, scene.id, chapterId, context);
      setMemoryNotice(extraction.added > 0
        ? `已保存 ${extraction.added} 条候选记忆，请到长期记忆页确认。`
        : '本次没有发现新的可确认事实。');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '长期记忆提取失败');
    } finally {
      setMemoryExtracting(false);
    }
  };

  const copyResult = async () => {
    const text = result?.text || streamingText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError('无法写入剪贴板');
    }
  };
  return (
    <aside className="ai-panel" aria-label="AI 写作助手">
      <header className="ai-panel-head">
        <div>
          <p className="eyebrow">AI ASSISTANT</p>
          <h2>写作助手</h2>
        </div>
        <button className="icon-button" type="button" aria-label="关闭 AI 面板" title="关闭" onClick={onClose}><X size={16} /></button>
      </header>

      <div className="ai-operation-tabs" role="tablist" aria-label="AI 操作">
        {operationOptions.map((item) => (
          <button key={item.key} type="button" className={operation === item.key ? 'is-active' : ''} onClick={() => { setOperation(item.key); setResult(null); setStreamingText(''); setConflicts(null); setGeneratedSelection(null); }}>
            {item.label}
          </button>
        ))}
      </div>

      <div className={`ai-memory-strip ${projectMemoryEnabled ? 'is-on' : ''}`}>
        <BrainCircuit size={15} />
        <div><strong>长期记忆</strong><span>{projectMemoryEnabled ? '仅使用已确认记忆' : '当前未开启'}</span></div>
        <div className="ai-memory-actions">
          <button type="button" onClick={() => setActiveNav('memory')}>查看</button>
          <button type="button" disabled={memoryExtracting || !projectMemoryEnabled} onClick={() => void extractMemory()}>{memoryExtracting ? '提取中' : '提取记忆'}</button>
        </div>
      </div>
      {memoryNotice && <div className="settings-success" role="status"><BrainCircuit size={14} />{memoryNotice}</div>}

      {selection.text && <div className="ai-selection-note">已捕获 {selection.text.length} 字选区。{operation === 'rewrite' ? '改写结果会先显示差异，确认后替换该选区。' : '生成结果仍需要你确认后才会写入正文。'}</div>}
      {rewriteNeedsSelection && <div className="ai-selection-note is-warning">改写模式需要先在正文中选中一段文字。</div>}

      <details className="ai-context-preview">
        <summary>查看本次将发送的上下文</summary>
        <ul>
          <li>当前场景正文约 {editor.getText().length.toLocaleString()} 字</li>
          <li>故事设定 {context.story_cards.length} 条，伏笔 {context.foreshadows.length} 条，时间线 {context.timeline_events.length} 条</li>
          <li>{selection.text ? `当前选区 ${selection.text.length.toLocaleString()} 字` : '未选择正文，将参考当前场景结尾'}</li>
          <li>仅使用已确认的长期记忆；候选记忆不会发送</li>
        </ul>
        <p>内容只会发送到你配置的 API 服务商。软件不经过自有服务器。</p>
      </details>

      <label className="field">
        <span>写作要求</span>
        <textarea
          className="ai-instruction"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder={operation === 'continue' ? '例如：写得更压抑，以一个异响收尾' : '描述你希望 AI 如何协助'}
        />
      </label>

      <label className="ai-length-field">
        <span>目标长度</span>
        <input type="range" min={100} max={2000} step={100} value={targetLength} onChange={(event) => setTargetLength(Number(event.target.value))} />
        <strong>{targetLength} 字</strong>
      </label>

      <div className={`ai-cost-estimate ${budgetBlocked ? 'is-blocked' : ''}`}>
        <div><span>本次预计</span><strong>{estimate.input_tokens.toLocaleString()} 输入 + {estimate.output_tokens.toLocaleString()} 输出 Token</strong></div>
        {estimate.pricing_configured ? <div><span>费用参考</span><strong>{formatAiCost(estimate.projected_cost.total_cost, settings.currency)}</strong></div> : <div><span>费用参考</span><strong>该模型暂无内置价格</strong></div>}
        <small>{settings.monthly_token_budget > 0 ? `本月 Token ${estimate.monthly_tokens.toLocaleString()} / ${settings.monthly_token_budget.toLocaleString()}` : '按实际 Token 记录用量；可在 API 设置中配置上限'}</small>
      </div>

      <div className="ai-generate-row">
        <button className="primary-button ai-generate" type="button" disabled={loading || budgetBlocked || rewriteNeedsSelection} onClick={() => void generate()}>
          {loading ? <LoaderCircle size={15} className="spin" /> : <Sparkles size={15} />}
          {loading ? '正在生成' : budgetBlocked ? '预算已阻止请求' : '生成建议'}
        </button>
        {loading && <button className="secondary-button" type="button" onClick={() => abortRef.current?.abort()}>取消</button>}
      </div>

      {error && <div className="ai-error" role="alert"><TriangleAlert size={14} />{error}</div>}

      {(streamingText || result) && (
        <section className="ai-result-card" aria-live="polite">
          <div className="ai-result-meta">
            <span>{result?.provider ?? 'streaming'}</span>
            {result?.usage && <span>{result.usage.input_tokens} 输入 / {result.usage.output_tokens} 输出</span>}
            {result?.cost && <span>{formatAiCost(result.cost.total_cost, result.cost.currency)}</span>}
          </div>
          {generatedOperation === 'rewrite' && rewriteDiff.length > 0 ? (
            <div className="ai-diff-preview" aria-label="改写差异">
              {rewriteDiff.slice(0, 240).map((line, index) => (
                <p key={`${line.kind}-${index}`} className={`ai-diff-${line.kind}`}>
                  <span>{line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}</span>{line.text}
                </p>
              ))}
            </div>
          ) : <div className="ai-result-text">{streamingText}</div>}
          <div className="ai-result-actions">
            <button className="secondary-button" type="button" onClick={() => void copyResult()}><Copy size={14} />{copied ? '已复制' : '复制'}</button>
            <button className="primary-button" type="button" onClick={() => void applyResult()}><CornerDownLeft size={14} />{generatedOperation === 'rewrite' ? '确认替换选区' : '插入末尾'}</button>
          </div>
        </section>
      )}

      <section className="ai-check-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">CONSISTENCY</p>
            <h3>当前场景体检</h3>
          </div>
          <ShieldCheck size={16} />
        </div>
        <label className="ai-strict-toggle"><input type="checkbox" checked={strict} onChange={(event) => setStrict(event.target.checked)} />显示低置信度提示</label>
        <button className="secondary-button ai-check-button" type="button" disabled={analyzing} onClick={() => void checkScene()}>
          {analyzing ? <LoaderCircle size={14} className="spin" /> : <ShieldCheck size={14} />}
          {analyzing ? '检查中' : '开始体检'}
        </button>
        {conflicts && (
          <div className="ai-conflict-list">
            {conflicts.length === 0 ? <p className="ai-no-conflict">没有发现规则层冲突。</p> : conflicts.map((conflict) => (
              <article key={conflict.id} className={`ai-conflict ${conflict.severity}`}>
                <div><span>{severityLabel[conflict.severity]}</span><strong>{conflict.entity || conflict.type}</strong></div>
                <p>{conflict.suggestion}</p>
                {conflict.evidence.quote && <blockquote>{conflict.evidence.quote}</blockquote>}
                <small>{Math.round(conflict.confidence * 100)}% 置信度</small>
              </article>
            ))}
          </div>
        )}
      </section>

    </aside>
  );
}
