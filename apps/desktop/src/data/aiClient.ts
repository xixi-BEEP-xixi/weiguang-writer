import { Channel, invoke } from '@tauri-apps/api/core';
import { createId } from '../domain/ids';
import type { AIContextPack, AIOperation } from './contextPack';
import { chatEndpoint, isTauriRuntime, loadAiApiKey, loadAiSettings, type AiSettings } from './aiSettings';
import { buildAiMemoryContext, saveAiOperation } from './aiMemoryStore';
import { addMemoryCandidates, buildApprovedMemoryContext, updateMemoryEvidenceBlock, type MemoryCandidateInput, type MemoryItem } from './memoryStore';
import { useWriterStore } from './writerStore';
import {
  assertAiBudget,
  calculateCost,
  estimateMessageTokens,
  estimateRequestBudget,
  estimateTokens,
  recordAiUsage,
  type AiCost,
  type AiRequestEstimate,
} from './aiUsage';

export interface AIUsage {
  input_tokens: number;
  output_tokens: number;
  input_limit: number;
  output_limit: number;
}

export interface AIStreamResult {
  requestId: string;
  text: string;
  provider: string;
  model: string;
  usage: AIUsage | null;
  cost: AiCost | null;
  operationId: string | null;
}

export interface AICallMetadata {
  projectId: string;
  sceneId?: string | null;
  chapterId?: string | null;
  operation: string;
  instruction?: string;
  record?: boolean;
  useMemory?: boolean;
}
export interface AIConflict {
  id: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  confidence: number;
  entity: string;
  field: string;
  suggestion: string;
  evidence: { scene_id: string; quote: string; start: number | null; end: number | null };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface StreamCallbacks {
  onDelta?: (chunk: string) => void;
  onMeta?: (meta: { provider: string; model: string; usage: AIUsage }) => void;
  signal?: AbortSignal;
}

interface ProviderResponse {
  id?: string;
  choices?: Array<{ message?: { content?: string }; delta?: { content?: string }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string } | string;
}

interface NativeHttpEvent {
  kind: 'status' | 'chunk' | 'complete';
  status?: number;
  data?: number[];
}

interface NativeHttpResponse {
  status: number;
  body: string;
}

function collectText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const value = node as { type?: string; text?: string; content?: unknown[] };
  if (value.type === 'text') return value.text ?? '';
  if (!Array.isArray(value.content)) return '';
  return value.content.map(collectText).join('');
}

function contextText(context: AIContextPack): string {
  const cards = context.story_cards
    .slice(0, 20)
    .map((card) => `- [${card.type}] ${card.name}：${card.summary}${card.details ? `\n  ${card.details}` : ''}`)
    .join('\n');
  const foreshadows = context.foreshadows
    .slice(0, 40)
    .map((item) => `- ${item.title}（${item.status}）`)
    .join('\n');
  const timeline = context.timeline_events
    .slice(0, 24)
    .map((item) => `- ${item.story_time ? `${item.story_time} · ` : ''}${item.title}（${item.status}）${item.description ? `：${item.description}` : ''}`)
    .join('\n');
  const scene = collectText(context.scene_snapshot.doc_json);
  const selection = context.selection?.text ?? '';
  return [
    '【当前场景正文】',
    scene.slice(-12000) || '（空场景）',
    selection ? `\n【当前选区】\n${selection}` : '',
    context.nearby_text ? `\n【附近文本】\n${context.nearby_text.slice(-3000)}` : '',
    cards ? `\n【故事设定】\n${cards}` : '',
    foreshadows ? `\n【伏笔状态】\n${foreshadows}` : '',
  ].filter(Boolean).join('\n');
}

function operationInstruction(operation: AIOperation, instruction: string, targetLength: number): string {
  const common = `你是一位严谨的中文小说创作助手。不要解释创作过程，直接给出可供作者选择的中文正文或建议。目标长度约 ${targetLength} 字。`;
  if (operation === 'rewrite') return `${common}\n任务：在保持人物、事实和叙事视角不变的前提下改写当前选区。作者要求：${instruction || '提升语言节奏和画面感'}`;
  if (operation === 'outline') return `${common}\n任务：基于当前上下文生成可执行的章节或情节大纲。作者要求：${instruction || '给出清晰的情节推进和转折'}`;
  if (operation === 'character') return `${common}\n任务：生成与现有设定一致的人物小传，不能擅自改变既有事实。作者要求：${instruction || '补全人物动机、关系与弧光'}`;
  if (operation === 'ask') return `${common}\n任务：回答作者关于故事、人物或情节的问题，并指出依据。作者问题：${instruction || '当前情节下一步怎么写？'}`;
  return `${common}\n任务：从当前场景结尾自然续写，不得重复已有段落。作者要求：${instruction || '保持原有风格并推进情节'}`;
}

function streamMessages(operation: AIOperation, instruction: string, targetLength: number, contextPack: AIContextPack): ChatMessage[] {
  return [
    { role: 'system', content: operationInstruction(operation, instruction, targetLength) },
    { role: 'user', content: contextText(contextPack) },
  ];
}

function parseSseBlock(block: string): string[] {
  return block
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
}

function errorFromRaw(status: number, raw: string): Error {
  try {
    const body = JSON.parse(raw) as ProviderResponse;
    const message = typeof body.error === 'string' ? body.error : body.error?.message;
    return new Error(message || `模型请求失败 HTTP ${status}`);
  } catch {
    return new Error(raw.slice(0, 300) || `模型请求失败 HTTP ${status}`);
  }
}

function usageFromResponse(provider: ProviderResponse['usage'], settings: AiSettings): AIUsage | null {
  if (!provider) return null;
  return {
    input_tokens: Number(provider.prompt_tokens ?? 0),
    output_tokens: Number(provider.completion_tokens ?? 0),
    input_limit: 8000,
    output_limit: settings.max_output_tokens,
  };
}

interface ParsedResponseState {
  text: string;
  requestId: string;
  usage: AIUsage | null;
  sseSeen: boolean;
  onChunk?: (chunk: string) => void;
}

function consumePayload(payload: ProviderResponse, state: ParsedResponseState, settings: AiSettings): void {
  state.requestId = String(payload.id ?? state.requestId);
  const chunk = payload.choices?.[0]?.delta?.content ?? payload.choices?.[0]?.message?.content ?? '';
  if (chunk) {
    state.text += chunk;
    state.onChunk?.(chunk);
  }
  const usage = usageFromResponse(payload.usage, settings);
  if (usage) state.usage = usage;
}

type ParsedStateWithCallback = ParsedResponseState;

function consumeSseBlock(block: string, state: ParsedStateWithCallback, settings: AiSettings): void {
  for (const data of parseSseBlock(block)) {
    if (data === '[DONE]') continue;
    try {
      consumePayload(JSON.parse(data) as ProviderResponse, state, settings);
    } catch {
      // Some compatible providers emit keepalive or non-JSON data frames.
    }
  }
}

async function requestViaFetch(
  endpoint: string,
  body: string,
  apiKey: string,
  settings: AiSettings,
  callbacks: StreamCallbacks,
): Promise<{ text: string; requestId: string; usage: AIUsage | null }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body,
    signal: callbacks.signal,
  });
  const raw = await response.text();
  if (!response.ok) throw errorFromRaw(response.status, raw);

  if (!settings.stream || !raw.includes('data:')) {
    let payload: ProviderResponse;
    try { payload = JSON.parse(raw) as ProviderResponse; } catch { throw errorFromRaw(response.status, raw); }
    if (payload.error) throw errorFromRaw(response.status, raw);
    const state: ParsedStateWithCallback = { text: '', requestId: createId(), usage: null, sseSeen: false };
    consumePayload(payload, state, settings);
    if (!state.text.trim()) throw new Error('模型未返回内容');
    return state;
  }

  const state: ParsedStateWithCallback = {
    text: '',
    requestId: createId(),
    usage: null,
    sseSeen: true,
    onChunk: callbacks.onDelta,
  };
  const normalized = raw.replace(/\r\n/g, '\n');
  for (const block of normalized.split('\n\n')) consumeSseBlock(block, state, settings);
  if (!state.text.trim()) throw new Error('模型未返回内容');
  return state;
}

async function requestViaNativeBridge(
  endpoint: string,
  body: string,
  apiKey: string,
  settings: AiSettings,
  callbacks: StreamCallbacks,
): Promise<{ text: string; requestId: string; usage: AIUsage | null }> {
  const requestId = createId();
  const decoder = new TextDecoder();
  const state: ParsedStateWithCallback = {
    text: '',
    requestId,
    usage: null,
    sseSeen: false,
    onChunk: callbacks.onDelta,
  };
  let buffer = '';
  let status = 0;
  let bodyText = '';

  const consumeBuffer = (final = false) => {
    buffer = buffer.replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      consumeSseBlock(buffer.slice(0, boundary), state, settings);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
    }
    if (final && buffer.trim()) {
      consumeSseBlock(buffer, state, settings);
      buffer = '';
    }
  };

  const channel = new Channel<NativeHttpEvent>((event) => {
    if (event.kind === 'status') {
      status = Number(event.status ?? 0);
      return;
    }
    if (event.kind === 'chunk' && Array.isArray(event.data)) {
      const decoded = decoder.decode(Uint8Array.from(event.data), { stream: true });
      if (!decoded) return;
      bodyText += decoded;
      if (settings.stream) {
        state.sseSeen ||= decoded.includes('data:');
        buffer += decoded;
        consumeBuffer(false);
      }
    }
  });

  const invokePromise = invoke<NativeHttpResponse>('ai_http_request', {
    request: {
      request_id: requestId,
      url: endpoint,
      body,
      api_key: apiKey,
      timeout_ms: Math.round(settings.request_timeout_seconds * 1000),
    },
    onEvent: channel,
  });

  if (callbacks.signal) {
    if (callbacks.signal.aborted) {
      void invoke('cancel_ai_http', { requestId }).catch(() => undefined);
      throw new DOMException('请求已取消', 'AbortError');
    }
    const onAbort = () => { void invoke('cancel_ai_http', { requestId }).catch(() => undefined); };
    callbacks.signal.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await invokePromise;
      status = response.status || status;
      bodyText = response.body;
    } finally {
      callbacks.signal.removeEventListener('abort', onAbort);
    }
  } else {
    const response = await invokePromise;
    status = response.status || status;
    bodyText = response.body;
  }

  if (callbacks.signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
  if (status >= 400) throw errorFromRaw(status, bodyText);
  const tail = decoder.decode();
  if (tail && settings.stream) buffer += tail;

  if (!settings.stream || !state.sseSeen) {
    let payload: ProviderResponse;
    try { payload = JSON.parse(bodyText) as ProviderResponse; } catch { throw errorFromRaw(status, bodyText); }
    if (payload.error) throw errorFromRaw(status, bodyText);
    state.text = '';
    consumePayload(payload, state, settings);
  } else {
    consumeBuffer(true);
  }
  if (!state.text.trim()) throw new Error('模型未返回内容');
  return state;
}

function responseBody(messages: ChatMessage[], settings: AiSettings): string {
  return JSON.stringify({
    model: settings.model,
    messages,
    temperature: settings.temperature,
    max_tokens: settings.max_output_tokens,
    stream: settings.stream,
  });
}

async function withProjectMemory(messages: ChatMessage[], metadata?: AICallMetadata): Promise<{ messages: ChatMessage[]; memoryEnabled: boolean }> {
  if (!metadata?.projectId || metadata.useMemory === false) return { messages, memoryEnabled: false };
  const project = useWriterStore.getState().data.projects.find((item) => item.id === metadata.projectId);
  if (!project?.aiMemoryEnabled) return { messages, memoryEnabled: false };
  const last = messages[messages.length - 1];
  if (!last) return { messages, memoryEnabled: true };
  const query = `${metadata.instruction ?? ''}\n${last.content.slice(-3000)}`;
  const [operationsMemory, approvedMemory] = await Promise.all([
    buildAiMemoryContext(metadata.projectId, query).catch(() => ''),
    buildApprovedMemoryContext(metadata.projectId, query).catch(() => ''),
  ]);
  const memory = [operationsMemory, approvedMemory].filter(Boolean).join('\n\n');
  if (!memory) return { messages, memoryEnabled: true };
  return {
    messages: [...messages.slice(0, -1), { role: 'user', content: `${last.content}\n\n${memory}` }],
    memoryEnabled: true,
  };
}
export async function directChat(messages: ChatMessage[], settingsOverride?: AiSettings, callbacks: StreamCallbacks = {}, metadata?: AICallMetadata): Promise<AIStreamResult> {
  const settings = settingsOverride ?? loadAiSettings();
  if (!settings.model.trim()) throw new Error('请先填写模型名称');
  const endpoint = chatEndpoint(settings.base_url);
  const memoryContext = await withProjectMemory(messages, metadata);
  const finalMessages = memoryContext.messages;
  const budget = assertAiBudget(finalMessages, settings);
  const apiKey = (await loadAiApiKey())?.trim() ?? '';
  if (!apiKey) throw new Error('请先在设置中保存模型 API Key');
  const body = responseBody(finalMessages, settings);
  const response = isTauriRuntime()
    ? await requestViaNativeBridge(endpoint, body, apiKey, settings, callbacks)
    : await requestViaFetch(endpoint, body, apiKey, settings, callbacks);

  const usage = response.usage ?? {
    input_tokens: budget.input_tokens,
    output_tokens: estimateTokens(response.text),
    input_limit: 8000,
    output_limit: settings.max_output_tokens,
  };
  if (response.usage) callbacks.onMeta?.({ provider: 'byok', model: settings.model, usage: response.usage });
  if (callbacks.signal?.aborted) throw new DOMException('请求已取消', 'AbortError');
  const cost = calculateCost(usage.input_tokens, usage.output_tokens, settings);
  recordAiUsage(settings.model, usage.input_tokens, usage.output_tokens, settings);
  let operationId: string | null = null;
  if (memoryContext.memoryEnabled && metadata?.record !== false) {
    operationId = createId();
    void saveAiOperation({
      id: operationId,
      project_id: metadata!.projectId,
      scene_id: metadata!.sceneId ?? null,
      chapter_id: metadata!.chapterId ?? null,
      operation: metadata!.operation,
      instruction: metadata!.instruction ?? '',
      output: response.text,
      status: metadata!.operation.includes('analysis') || metadata!.operation.includes('scan') ? 'report' : 'generated',
      model: settings.model,
      created_at: new Date().toISOString(),
    }).catch(() => undefined);
  }
  return {
    requestId: response.requestId,
    text: response.text,
    provider: 'byok',
    model: settings.model,
    usage,
    cost,
    operationId,
  };
}

export function estimateStreamRequest(
  operation: AIOperation,
  instruction: string,
  targetLength: number,
  contextPack: AIContextPack,
  settingsOverride?: AiSettings,
): AiRequestEstimate {
  const settings = settingsOverride ?? loadAiSettings();
  return estimateRequestBudget(streamMessages(operation, instruction, targetLength, contextPack), settings);
}

export async function streamAI(
  operation: AIOperation,
  _projectId: string,
  _sceneId: string,
  _chapterId: string,
  instruction: string,
  targetLength: number,
  contextPack: AIContextPack,
  callbacks: StreamCallbacks = {},
): Promise<AIStreamResult> {
  return directChat(streamMessages(operation, instruction, targetLength, contextPack), undefined, callbacks, {
    projectId: _projectId,
    sceneId: _sceneId,
    chapterId: _chapterId,
    operation,
    instruction,
  });
}

function parseConflicts(text: string): AIConflict[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型体检结果不是有效 JSON');
  const parsed = JSON.parse(fenced.slice(start, end + 1)) as { conflicts?: Array<Record<string, unknown>> };
  return (parsed.conflicts ?? []).map((item, index) => {
    const severity = item.severity === 'high' || item.severity === 'medium' || item.severity === 'low' ? item.severity : 'medium';
    const evidence = (item.evidence ?? {}) as Record<string, unknown>;
    return {
      id: String(item.id ?? `local-${index}-${createId()}`),
      type: String(item.type ?? 'consistency'),
      severity,
      confidence: Math.min(1, Math.max(0, Number(item.confidence ?? 0.6))),
      entity: String(item.entity ?? ''),
      field: String(item.field ?? ''),
      suggestion: String(item.suggestion ?? '请核对相关设定。'),
      evidence: {
        scene_id: String(evidence.scene_id ?? ''),
        quote: String(evidence.quote ?? '').slice(0, 500),
        start: typeof evidence.start === 'number' ? evidence.start : null,
        end: typeof evidence.end === 'number' ? evidence.end : null,
      },
    };
  });
}

export async function analyzeChapter(
  _projectId: string,
  _chapterId: string,
  _sceneId: string,
  contextPack: AIContextPack,
  strict = false,
): Promise<AIConflict[]> {
  const response = await directChat([
    {
      role: 'system',
      content: '你是中文小说一致性检查器。只返回 JSON：{"conflicts":[{"id":"","type":"","severity":"high|medium|low","confidence":0.0,"entity":"","field":"","suggestion":"","evidence":{"scene_id":"","quote":"","start":null,"end":null}}]}。没有冲突时返回 {"conflicts":[]}。不要输出 Markdown。',
    },
    {
      role: 'user',
      content: `${contextText(contextPack)}\n\n${strict ? '请列出低置信度提示。' : '只列出中高置信度冲突。'}`,
    },
  ], undefined, {}, {
    projectId: _projectId,
    sceneId: _sceneId,
    chapterId: _chapterId,
    operation: 'scene_check',
    instruction: strict ? '列出低置信度提示' : '只列出中高置信度冲突',
  });
  return parseConflicts(response.text);
}

function findEvidenceBlockId(document: unknown, quote: string): string | null {
  const needle = quote.replace(/\s+/g, '').slice(0, 80);
  if (!needle) return null;
  const visit = (node: unknown): string | null => {
    if (!node || typeof node !== 'object') return null;
    const value = node as { type?: string; text?: string; attrs?: { blockId?: string }; content?: unknown[] };
    if (value.type === 'text') return null;
    const blockId = value.attrs?.blockId ? String(value.attrs.blockId) : '';
    const plain = collectText(value).replace(/\s+/g, '');
    if (blockId && plain.includes(needle)) return blockId;
    for (const child of value.content ?? []) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  return visit(document);
}

export interface MemoryExtractionResult {
  added: number;
  items: MemoryItem[];
}

export async function extractMemoryCandidates(
  projectId: string,
  sceneId: string,
  chapterId: string,
  contextPack: AIContextPack,
): Promise<MemoryExtractionResult> {
  const response = await directChat([
    {
      role: 'system',
      content: '你是中文小说长期记忆提取器。只提取正文中明确写出、可复核的事实，不推测人物心理，不把计划写成已发生。只返回 JSON：{"items":[{"kind":"character|relationship|location|item|event|foreshadow|cognition|rule","title":"简短标题","detail":"可执行的事实描述","confidence":0.0,"evidence":"不超过80字的原文短句"}]}。最多 12 条；没有可提取事实时返回 {"items":[]}。不要输出 Markdown。',
    },
    { role: 'user', content: contextText(contextPack) },
  ], undefined, {}, {
    projectId,
    sceneId,
    chapterId,
    operation: 'memory_extract',
    instruction: '提取可确认的长期记忆候选',
    record: false,
    useMemory: false,
  });
  const fenced = response.text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? response.text;
  const start = fenced.indexOf('{');
  const end = fenced.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有返回可解析的记忆候选');
  const parsed = JSON.parse(fenced.slice(start, end + 1)) as { items?: Array<Record<string, unknown>> };
  const candidates: MemoryCandidateInput[] = (parsed.items ?? []).slice(0, 12).map((item) => ({
    kind: String(item.kind ?? 'event') as MemoryCandidateInput['kind'],
    title: String(item.title ?? '').slice(0, 180),
    detail: String(item.detail ?? '').slice(0, 2400),
    confidence: Math.min(1, Math.max(0, Number(item.confidence ?? 0.65))),
    evidence: String(item.evidence ?? '').slice(0, 500),
  })).filter((item) => item.title.trim() && item.detail.trim());
  const added = await addMemoryCandidates(projectId, sceneId, chapterId, candidates);
  await Promise.all(added.map(async (item) => {
    const blockId = findEvidenceBlockId(contextPack.scene_snapshot.doc_json, item.evidence);
    if (blockId) await updateMemoryEvidenceBlock(projectId, item.id, blockId);
  }));
  return { added: added.length, items: added };
}
export async function testAiConnection(settingsOverride?: AiSettings): Promise<string> {
  const result = await directChat([
    { role: 'system', content: '你只需要回复“连接成功”四个字。' },
    { role: 'user', content: '请确认模型连接。' },
  ], { ...(settingsOverride ?? loadAiSettings()), stream: false, max_output_tokens: 20 });
  return result.text.trim() || '连接成功';
}
