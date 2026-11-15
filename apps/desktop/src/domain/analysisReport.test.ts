// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseAnalysisReport } from './analysisReport';

describe('analysis report Markdown parsing', () => {
  it('removes raw Markdown controls and preserves report structure', () => {
    const blocks = parseAnalysisReport(`# 拆书报告

> 来源：测试.docx  
> 生成时间：2026-11-16

---

## 一、全书概述

**结论：** 这是一段正文，带 \`文件名.docx\`。

| 人物 | 问题 |
|---|---|
| 甲 | 动机不清 |
| 乙 | 时间冲突 |

- 第一条证据
- 第二条证据

1. 第一步
2. 第二步`);

    expect(blocks.map((block) => block.type)).toEqual(['heading', 'quote', 'heading', 'paragraph', 'table', 'list', 'list']);
    expect(blocks.some((block) => JSON.stringify(block).includes('---'))).toBe(false);
    expect(blocks[1]).toEqual({ type: 'quote', lines: ['来源：测试.docx', '生成时间：2026-11-16'] });
    expect(blocks[4]).toMatchObject({ type: 'table', headers: ['人物', '问题'], rows: [['甲', '动机不清'], ['乙', '时间冲突']] });
    expect(blocks[5]).toMatchObject({ type: 'list', ordered: false, items: ['第一条证据', '第二条证据'] });
  });
});