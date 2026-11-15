import mammoth from 'mammoth';
import { createId } from './ids';
import type { Chapter, Project, Scene, Volume, WorkspaceData } from './types';

interface Section { title: string; body: string }

function splitSections(text: string): Section[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const lines = normalized.split('\n');
  const sections: Section[] = [];
  let current: Section | null = null;
  const heading = /^(?:#{1,4}\s+|第[0-9零一二三四五六七八九十百千万两]+[章节回卷]\s*)(.+)$/;
  for (const line of lines) {
    const match = line.trim().match(heading);
    if (match) {
      if (current && current.body.trim()) sections.push(current);
      current = { title: match[1].trim() || line.trim(), body: '' };
    } else {
      if (!current) current = { title: '正文', body: '' };
      current.body += `${line}\n`;
    }
  }
  if (current && current.body.trim()) sections.push(current);
  return sections.length ? sections : [{ title: '正文', body: normalized }];
}

function paragraphs(body: string) {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\n+/g, ' ').trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: 'paragraph',
      attrs: { blockId: createId() },
      content: paragraph ? [{ type: 'text', text: paragraph }] : [],
    }));
}

export function importManuscript(data: WorkspaceData, filename: string, text: string): WorkspaceData {
  const stamp = new Date().toISOString();
  const projectName = filename.replace(/\.(txt|md|markdown)$/i, '').trim() || '导入项目';
  const project: Project = {
    id: createId(), name: projectName, type: 'webnovel', goalWords: 1_000_000,
    status: 'writing', aiMemoryEnabled: false, rev: 1, createdAt: stamp, updatedAt: stamp,
  };
  const volume: Volume = {
    id: createId(), projectId: project.id, title: '第一卷', sort: 1, goalWords: 300_000,
    rev: 1, createdAt: stamp, updatedAt: stamp,
  };
  const chapters: Chapter[] = [];
  const scenes: Scene[] = [];
  const sections = splitSections(text);
  sections.forEach((section, index) => {
    const chapter: Chapter = {
      id: createId(), projectId: project.id, volumeId: volume.id,
      title: section.title, sort: index + 1, status: 'draft', defaultSceneId: '',
      rev: 1, createdAt: stamp, updatedAt: stamp,
    };
    const scene: Scene = {
      id: createId(), projectId: project.id, chapterId: chapter.id, title: '正文', sort: 1,
      status: 'draft', rev: 1, createdAt: stamp, updatedAt: stamp,
      doc: { type: 'doc', content: paragraphs(section.body) },
      wordCount: section.body.replace(/\s/g, '').length,
    };
    chapter.defaultSceneId = scene.id;
    chapters.push(chapter);
    scenes.push(scene);
  });
  return {
    ...data,
    projects: [...data.projects, project],
    volumes: [...data.volumes, volume],
    chapters: [...data.chapters, ...chapters],
    scenes: [...data.scenes, ...scenes],
    activeProjectId: project.id,
    activeSceneId: scenes[0]?.id ?? data.activeSceneId,
  };
}
export async function docxToManuscriptText(file: File): Promise<string> {
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  const document = new DOMParser().parseFromString(result.value, 'text/html');
  const lines: string[] = [];
  for (const element of Array.from(document.body.children)) {
    const text = element.textContent?.trim() ?? '';
    if (!text) continue;
    const tag = element.tagName.toLowerCase();
    if (/^h[1-4]$/.test(tag)) lines.push(`${'#'.repeat(Number(tag.slice(1)))} ${text}`);
    else if (tag === 'ul' || tag === 'ol') {
      for (const item of Array.from(element.querySelectorAll('li'))) lines.push(`- ${item.textContent?.trim() ?? ''}`);
    } else {
      lines.push(text, '');
    }
  }
  return lines.join('\n').trim();
}
