import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { parseAnalysisReport, type AnalysisReportBlock } from '../domain/analysisReport';

const INLINE_RE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;

function inlineNodes(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  const pattern = new RegExp(INLINE_RE.source, 'g');

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) nodes.push(<strong key={`strong-${match.index}`}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith('`') && token.endsWith('`')) nodes.push(<code key={`code-${match.index}`}>{token.slice(1, -1)}</code>);
    else nodes.push(<em key={`em-${match.index}`}>{token.slice(1, -1)}</em>);
    cursor = match.index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function heading(block: Extract<AnalysisReportBlock, { type: 'heading' }>, key: string) {
  const content = inlineNodes(block.text);
  if (block.level === 1) return <h1 key={key}>{content}</h1>;
  if (block.level === 2) return <h2 key={key}>{content}</h2>;
  if (block.level === 3) return <h3 key={key}>{content}</h3>;
  return <h4 key={key}>{content}</h4>;
}

function blockNode(block: AnalysisReportBlock, index: number): ReactNode {
  const key = `${block.type}-${index}`;
  if (block.type === 'heading') return heading(block, key);
  if (block.type === 'paragraph') return <p key={key}>{inlineNodes(block.text)}</p>;
  if (block.type === 'quote') return <aside className="analysis-report-meta" key={key}>{block.lines.map((line, lineIndex) => <p key={`${key}-${lineIndex}`}>{inlineNodes(line)}</p>)}</aside>;
  if (block.type === 'list') {
    const List = block.ordered ? 'ol' : 'ul';
    return <List key={key}>{block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}>{inlineNodes(item)}</li>)}</List>;
  }
  return (
    <div className="analysis-report-table-wrap" key={key}>
      <table>
        <caption className="sr-only">分析报告表格 {index + 1}</caption>
        <thead><tr>{block.headers.map((header, column) => <th key={`${key}-h-${column}`}>{inlineNodes(header)}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={`${key}-r-${rowIndex}`}>{block.headers.map((_, column) => <td key={`${key}-r-${rowIndex}-c-${column}`}>{inlineNodes(row[column] ?? '')}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export function AnalysisReport({ text }: { text: string }) {
  const blocks = useMemo(() => parseAnalysisReport(text), [text]);
  return <article className="analysis-report-document" aria-label="分析报告正文">{blocks.map(blockNode)}</article>;
}