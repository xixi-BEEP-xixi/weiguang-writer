export type TextDiffKind = 'same' | 'added' | 'removed';

export interface TextDiffLine {
  kind: TextDiffKind;
  text: string;
}

export function textToParagraphs(value: string): string[] {
  return value
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function diffParagraphs(previous: string[], current: string[]): TextDiffLine[] {
  const rows = previous.slice(0, 1500);
  const columns = current.slice(0, 1500);
  const table = Array.from({ length: rows.length + 1 }, () => new Uint32Array(columns.length + 1));
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    for (let j = columns.length - 1; j >= 0; j -= 1) {
      table[i][j] = rows[i] === columns[j]
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  const result: TextDiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < rows.length && j < columns.length) {
    if (rows[i] === columns[j]) {
      result.push({ kind: 'same', text: columns[j] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      result.push({ kind: 'removed', text: rows[i] });
      i += 1;
    } else {
      result.push({ kind: 'added', text: columns[j] });
      j += 1;
    }
  }
  while (i < rows.length) { result.push({ kind: 'removed', text: rows[i] }); i += 1; }
  while (j < columns.length) { result.push({ kind: 'added', text: columns[j] }); j += 1; }
  return result;
}