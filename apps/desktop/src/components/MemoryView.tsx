import { BrainCircuit, Check, CircleAlert, Filter, LoaderCircle, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from './ConfirmDialog';
import { PageGuideBubble } from './PageGuideBubble';
import { useWriterStore } from '../data/writerStore';
import {
  clearProjectMemory,
  deleteMemoryItem,
  getMemoryStats,
  listMemoryItems,
  setMemoryItemStatus,
  type MemoryItem,
  type MemoryKind,
  type MemoryStats,
  type MemoryStatus,
} from '../data/memoryStore';

const kindLabel: Record<MemoryKind, string> = {
  character: '人物',
  relationship: '关系',
  location: '地点',
  item: '物品',
  event: '事件',
  foreshadow: '伏笔',
  cognition: '认知',
  rule: '规则',
};

const statusLabel: Record<MemoryStatus, string> = {
  candidate: '待确认',
  approved: '已确认',
  rejected: '已拒绝',
  superseded: '已失效',
};

export function MemoryView() {
  const data = useWriterStore((state) => state.data);
  const setProjectMemoryEnabled = useWriterStore((state) => state.setProjectMemoryEnabled);
  const project = data.projects.find((item) => item.id === data.activeProjectId);
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [status, setStatus] = useState<'all' | MemoryStatus>('candidate');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirm = useConfirm();

  const refresh = async () => {
    if (!project) return;
    setLoading(true); setError('');
    try {
      const [nextItems, nextStats] = await Promise.all([listMemoryItems(project.id), getMemoryStats(project.id)]);
      setItems(nextItems);
      setStats(nextStats);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '长期记忆读取失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { void refresh(); }, [project?.id]);

  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return items.filter((item) => (status === 'all' || item.status === status)
      && (!needle || `${item.title}\n${item.detail}\n${item.evidence}`.toLocaleLowerCase().includes(needle)));
  }, [items, query, status]);

  const changeStatus = async (item: MemoryItem, next: MemoryStatus) => {
    if (!project) return;
    try {
      await setMemoryItemStatus(project.id, item.id, next);
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : '记忆状态更新失败'); }
  };

  const remove = async (item: MemoryItem) => {
    if (!project) return;
    if (!(await confirm({ title: `删除记忆「${item.title}」？`, description: '只删除这条长期记忆，不会修改正文。', confirmLabel: '删除记忆', tone: 'danger' }))) return;
    try {
      await deleteMemoryItem(project.id, item.id);
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : '记忆删除失败'); }
  };

  const clearAll = async () => {
    if (!project) return;
    if (!(await confirm({ title: '清空本书长期记忆？', description: '会删除全部候选、已确认和已拒绝记忆，但不会修改正文或故事圣经。', confirmLabel: '清空记忆', tone: 'danger' }))) return;
    try {
      await clearProjectMemory(project.id);
      await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : '长期记忆清理失败'); }
  };

  if (!project) return null;
  const enabled = project.aiMemoryEnabled;

  return (
    <main className="module-stage memory-stage">
      <header className="module-head">
        <div><p className="eyebrow">MEMORY</p><h1>长期记忆</h1><p>只使用作者确认过的记忆参与 AI 上下文。所有内容与证据都保存在本机。</p></div>
        <div className="settings-head-actions">
          <button className="secondary-button" type="button" disabled={loading} onClick={() => void refresh()}><RefreshCw size={15} className={loading ? 'spin' : ''} />刷新</button>
          <button className={enabled ? 'secondary-button' : 'primary-button'} type="button" onClick={() => setProjectMemoryEnabled(project.id, !enabled)}><BrainCircuit size={15} />{enabled ? '关闭该书记忆' : '开启该书记忆'}</button>
        </div>
      </header>

      {error && <div className="ai-error" role="alert"><CircleAlert size={14} />{error}</div>}

      <div className="memory-stats-grid">
        <div><span>待确认</span><strong>{stats?.candidates ?? 0}</strong></div>
        <div><span>已确认</span><strong>{stats?.approved ?? 0}</strong></div>
        <div><span>已拒绝</span><strong>{stats?.rejected ?? 0}</strong></div>
        <div><span>记忆状态</span><strong>{enabled ? '参与上下文' : '仅本地保存'}</strong></div>
      </div>

      <section className="memory-toolbar">
        <div className="segmented" aria-label="记忆状态筛选">
          {([['candidate', '待确认'], ['approved', '已确认'], ['rejected', '已拒绝'], ['all', '全部']] as Array<['all' | MemoryStatus, string]>).map(([value, label]) => (
            <button key={value} type="button" className={status === value ? 'is-active' : ''} onClick={() => setStatus(value)}>{label}</button>
          ))}
        </div>
        <label className="search-field"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索记忆或原文证据" aria-label="搜索长期记忆" /></label>
        <button className="secondary-button danger-button" type="button" disabled={!items.length} onClick={() => void clearAll()}><Trash2 size={14} />清空记忆</button>
      </section>

      <section className="memory-list" aria-label="长期记忆列表">
        {loading && <div className="module-empty"><LoaderCircle size={20} className="spin" /><strong>正在读取本地记忆</strong><p>记忆只从当前项目的本地数据库加载。</p></div>}
        {!loading && visible.length === 0 && <div className="module-empty"><Filter size={20} /><strong>当前筛选下没有记忆</strong><p>在 AI 助手里点击“提取记忆”，候选事实会出现在这里等待确认。</p></div>}
        {!loading && visible.map((item) => (
          <article key={item.id} className={`memory-item ${item.status}`}>
            <div className="memory-item-head">
              <div><span className={`memory-kind ${item.kind}`}>{kindLabel[item.kind]}</span><span className={`memory-status ${item.status}`}>{statusLabel[item.status]}</span></div>
              <div className="memory-item-actions">
                {item.status === 'candidate' && <>
                  <button className="primary-button compact" type="button" onClick={() => void changeStatus(item, 'approved')}><Check size={14} />确认</button>
                  <button className="secondary-button" type="button" onClick={() => void changeStatus(item, 'rejected')}><X size={14} />拒绝</button>
                </>}
                {item.status === 'approved' && <button className="secondary-button" type="button" onClick={() => void changeStatus(item, 'candidate')}>撤回确认</button>}
                {item.status === 'rejected' && <button className="secondary-button" type="button" onClick={() => void changeStatus(item, 'candidate')}>恢复候选</button>}
                <button className="icon-button danger" type="button" aria-label={`删除${item.title}`} title="删除记忆" onClick={() => void remove(item)}><Trash2 size={14} /></button>
              </div>
            </div>
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
            {item.evidence && <blockquote>{item.evidence}</blockquote>}
            <footer>
              <span>置信度 {Math.round(item.confidence * 100)}%</span>
              <span>{new Date(item.updated_at).toLocaleString()}</span>
            </footer>
          </article>
        ))}
      </section>
      <PageGuideBubble
        id="long-term-memory"
        target=".memory-stats-grid"
        title="长期记忆怎么用"
        points={[
          '在 AI 助手里点击“提取记忆”，让模型从当前场景提取候选事实。',
          '候选记忆不会直接影响写作；你确认后才会进入后续 AI 上下文。',
          '每条记忆都保留原文证据，可撤回、拒绝或删除。',
        ]}
      />
    </main>
  );
}