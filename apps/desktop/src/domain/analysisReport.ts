export type AnalysisReportBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'table'; headers: string[]; rows: string[][] };

const HEADING_RE = /^(#{1,4})\s+(.+?)\s*#*\s*$/;
const RULE_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const LIST_RE = /^\s*([-*+]|\d+[.)])\s+(.+)$/;

function tableCells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function isTableStart(lines: string[], index: number): boolean {
  const line = lines[index]?.trim() ?? '';
  return line.startsWith('|') && line.endsWith('|') && isTableSeparator(lines[index + 1] ?? '');
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index]?.trim() ?? '';
  return HEADING_RE.test(line) || RULE_RE.test(line) || line.startsWith('>') || LIST_RE.test(line) || isTableStart(lines, index);
}

/** Convert the model's constrained Markdown report into semantic blocks. */
export function parseAnalysisReport(text: string): AnalysisReportBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: AnalysisReportBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line || RULE_RE.test(line)) { index += 1; continue; }

    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3 | 4, text: heading[2].trim() });
      index += 1;
      continue;
    }

    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        const content = lines[index].trim().replace(/^>\s?/, '').trim();
        if (content) quoteLines.push(content);
        index += 1;
      }
      if (quoteLines.length) blocks.push({ type: 'quote', lines: quoteLines });
      continue;
    }

    if (isTableStart(lines, index)) {
      const headers = tableCells(lines[index]);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    const list = line.match(LIST_RE);
    if (list) {
      const ordered = /\d/.test(list[1]);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(LIST_RE);
        if (!item || /\d/.test(item[1]) !== ordered) break;
        items.push(item[2].trim());
        index += 1;
      }
      if (items.length) blocks.push({ type: 'list', ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length) blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
  }

  return blocks;
}