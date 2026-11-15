import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  MapPin,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useWriterStore } from '../data/writerStore';
import { PageGuideBubble } from './PageGuideBubble';
import { useConfirm } from './ConfirmDialog';
import type { BibleCard, BibleCardKind } from '../domain/types';

const kindOptions: Array<{ key: BibleCardKind; label: string; icon: typeof UserRound }> = [
  { key: 'character', label: '人物', icon: UserRound },
  { key: 'location', label: '地点', icon: MapPin },
  { key: 'item', label: '物品', icon: Package },
  { key: 'organization', label: '组织', icon: Building2 },
  { key: 'concept', label: '设定', icon: Sparkles },
];

const kindLabel = Object.fromEntries(kindOptions.map((item) => [item.key, item.label])) as Record<BibleCardKind, string>;
const kindIcon = Object.fromEntries(kindOptions.map((item) => [item.key, item.icon])) as Record<BibleCardKind, typeof UserRound>;

function CardEditor({ card }: { card: BibleCard }) {
  const updateBibleCard = useWriterStore((state) => state.updateBibleCard);
  const deleteBibleCard = useWriterStore((state) => state.deleteBibleCard);
  const confirm = useConfirm();
  const [draft, setDraft] = useState(card);

  useEffect(() => setDraft(card), [card]);

  const commit = (patch: Partial<BibleCard>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    updateBibleCard(card.id, {
      name: next.name,
      kind: next.kind,
      aliases: next.aliases,
      summary: next.summary,
      details: next.details,
      tags: next.tags,
    });
  };

  return (
    <section className="bible-editor" aria-label={`${card.name} 设定卡`} data-context-menu="bible-card" data-context-label={`设定：${card.name}`} data-context-delete-target={`#delete-bible-card-${card.id}`} data-context-delete-label="删除设定卡">
      <div className="bible-editor-head">
        <div>
          <p className="eyebrow">STORY BIBLE / {kindLabel[card.kind]}</p>
          <input
            className="module-title-input"
            aria-label="设定卡名称"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            onBlur={() => commit({ name: draft.name })}
          />
        </div>
        <button
          className="icon-button danger"
          type="button"
          aria-label="删除设定卡"
          title="删除设定卡"
          onClick={() => {
            void confirm({ title: `删除设定卡「${card.name}」？`, description: '设定卡会从故事圣经中移除。', confirmLabel: '删除设定卡', tone: 'danger' }).then((ok) => { if (ok) deleteBibleCard(card.id); });
          }}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="form-grid two">
        <label className="field">
          <span>卡片类型</span>
          <select value={draft.kind} onChange={(event) => commit({ kind: event.target.value as BibleCardKind })}>
            {kindOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>别名</span>
          <input
            value={draft.aliases.join('，')}
            placeholder="多个别名用逗号分隔"
            onChange={(event) => setDraft({ ...draft, aliases: event.target.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean) })}
            onBlur={() => commit({ aliases: draft.aliases })}
          />
        </label>
      </div>

      <label className="field">
        <span>一句话定位</span>
        <input
          value={draft.summary}
          placeholder="这个角色、地点或设定最重要的特征"
          onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
          onBlur={() => commit({ summary: draft.summary })}
        />
      </label>

      <label className="field field-grow">
        <span>详细设定</span>
        <textarea
          value={draft.details}
          placeholder="动机、外观、规则、关系与待确认信息……"
          onChange={(event) => setDraft({ ...draft, details: event.target.value })}
          onBlur={() => commit({ details: draft.details })}
        />
      </label>

      <label className="field">
        <span>标签</span>
        <input
          value={draft.tags.join('，')}
          placeholder="主线，第一卷，待确认"
          onChange={(event) => setDraft({ ...draft, tags: event.target.value.split(/[，,]/).map((item) => item.trim()).filter(Boolean) })}
          onBlur={() => commit({ tags: draft.tags })}
        />
      </label>
    </section>
  );
}

export function StoryBibleView() {
  const data = useWriterStore((state) => state.data);
  const addBibleCard = useWriterStore((state) => state.addBibleCard);
  const [kind, setKind] = useState<'all' | BibleCardKind>('all');
  const [query, setQuery] = useState('');
  const [newName, setNewName] = useState('');
  const [selectedId, setSelectedId] = useState('');

  const cards = useMemo(() => {
    const projectCards = data.bibleCards.filter((card) => card.projectId === data.activeProjectId);
    const normalized = query.trim().toLowerCase();
    return projectCards.filter((card) => (
      (kind === 'all' || card.kind === kind)
      && (!normalized || [card.name, card.summary, ...card.aliases, ...card.tags].join(' ').toLowerCase().includes(normalized))
    ));
  }, [data.activeProjectId, data.bibleCards, kind, query]);

  const selected = data.bibleCards.find((card) => card.id === selectedId && card.projectId === data.activeProjectId)
    ?? cards[0]
    ?? null;

  const createCard = () => {
    const name = newName.trim();
    if (!name) return;
    addBibleCard(kind === 'all' ? 'character' : kind, name);
    setNewName('');
  };

  return (
    <main className="module-stage">
      <header className="module-head">
        <div>
          <p className="eyebrow">STORY BIBLE</p>
          <h1>故事圣经</h1>
          <p>把人物、地点、物品和世界规则收束成可检索的单一事实来源。</p>
        </div>
        <div className="module-stat"><strong>{cards.length}</strong><span>当前卡片</span></div>
      </header>
      <PageGuideBubble
        id="story-bible"
        target='[data-tour="bible-workspace"]'
        title="故事圣经怎么用"
        points={[
          '先新建人物、地点、物品或设定卡。',
          '填写定位、详情、别名和标签，作为写作时的统一设定。',
          '正文出现新事实时回到这里补卡，避免设定散落。',
        ]}
      />
            <div className="module-toolbar" data-tour="bible-workspace">
        <div className="segmented" role="tablist" aria-label="设定卡分类">
          <button type="button" className={kind === 'all' ? 'is-active' : ''} onClick={() => setKind('all')}>全部</button>
          {kindOptions.map(({ key, label }) => (
            <button key={key} type="button" className={kind === key ? 'is-active' : ''} onClick={() => setKind(key)}>{label}</button>
          ))}
        </div>
        <label className="search-field">
          <Search size={15} />
          <span className="sr-only">搜索设定卡</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、别名或标签" />
        </label>
      </div>

      <div className="module-split bible-split">
        <section className="module-list-panel" aria-label="设定卡列表">
          <form className="quick-create" onSubmit={(event) => { event.preventDefault(); createCard(); }}>
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="新增卡片名称" aria-label="新增卡片名称" />
            <button className="primary-button compact" type="submit"><Plus size={15} />新建</button>
          </form>
          <div className="card-grid">
            {cards.map((card) => {
              const Icon = kindIcon[card.kind];
              return (
                <button
                  key={card.id}
                  className={`bible-card ${selected?.id === card.id ? 'is-selected' : ''}`}
                  type="button"
                  onClick={() => setSelectedId(card.id)}
                >
                  <span className={`bible-card-icon ${card.kind}`}><Icon size={16} /></span>
                  <span className="bible-card-copy">
                    <strong>{card.name}</strong>
                    <small>{card.summary || `${kindLabel[card.kind]}设定待补充`}</small>
                  </span>
                  <span className="bible-kind">{kindLabel[card.kind]}</span>
                </button>
              );
            })}
            {cards.length === 0 && (
              <div className="module-empty">
                <Sparkles size={20} />
                <strong>还没有匹配的设定卡</strong>
                <p>从上方创建第一张卡片，或换一个搜索条件。</p>
              </div>
            )}
          </div>
        </section>
        {selected ? <CardEditor card={selected} /> : (
          <section className="bible-editor bible-editor-empty">
            <Sparkles size={24} />
            <h2>建立你的故事事实层</h2>
            <p>设定卡会和正文、时间线、伏笔共用项目级稳定 ID，后续可被 AI 上下文包直接引用。</p>
          </section>
        )}
      </div>
    </main>
  );
}
