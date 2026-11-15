import { collectPlainText } from './blocks';
import type { Chapter, Project, Scene, WorkspaceData } from './types';

export interface WorkspaceSearchResult {
  scene: Scene;
  project: Project;
  chapter: Chapter | null;
  snippet: string;
  score: number;
}

function queryTerms(rawQuery: string): string[] {
  const normalized = rawQuery.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const segments = normalized.match(/[\p{Script=Han}]{2,}|[a-z0-9_-]{2,}/gu) ?? [];
  const terms = new Set<string>();
  for (const segment of segments) {
    terms.add(segment);
    if (segment.length > 4 && /^[\p{Script=Han}]+$/u.test(segment)) {
      for (let index = 0; index < segment.length - 1; index += 2) terms.add(segment.slice(index, index + 2));
    }
  }
  return [...terms].slice(0, 16);
}

function countOccurrences(haystack: string, term: string): number {
  if (!term) return 0;
  let count = 0;
  let from = 0;
  while (from < haystack.length && count < 20) {
    const index = haystack.indexOf(term, from);
    if (index < 0) break;
    count += 1;
    from = index + Math.max(1, term.length);
  }
  return count;
}

function snippetAround(text: string, terms: string[]): string {
  const lower = text.toLocaleLowerCase();
  const index = terms.map((term) => lower.indexOf(term)).filter((value) => value >= 0).sort((a, b) => a - b)[0] ?? 0;
  return text.slice(Math.max(0, index - 42), index + 110).replace(/\s+/g, ' ').trim();
}

export function searchWorkspaceScenes(data: WorkspaceData, rawQuery: string, limit = 60): WorkspaceSearchResult[] {
  const terms = queryTerms(rawQuery);
  if (terms.length === 0) return [];
  const normalizedQuery = rawQuery.toLocaleLowerCase();
  const aliases = new Set(terms);
  for (const card of data.bibleCards) {
    const names = [card.name, ...card.aliases].map((value) => value.toLocaleLowerCase()).filter(Boolean);
    if (names.some((name) => normalizedQuery.includes(name))) names.forEach((name) => aliases.add(name));
  }
  for (const character of data.characters) {
    const names = [character.name, ...character.aliases].map((value) => value.toLocaleLowerCase()).filter(Boolean);
    if (names.some((name) => normalizedQuery.includes(name))) names.forEach((name) => aliases.add(name));
  }
  const effectiveTerms = [...aliases].slice(0, 24);
  const projects = new Map(data.projects.map((project) => [project.id, project]));
  const chapters = new Map(data.chapters.map((chapter) => [chapter.id, chapter]));
  const results: WorkspaceSearchResult[] = [];
  for (const scene of data.scenes) {
    const project = projects.get(scene.projectId);
    const chapter = chapters.get(scene.chapterId) ?? null;
    if (!project) continue;
    const text = collectPlainText(scene.doc);
    const lowerText = text.toLocaleLowerCase();
    const lowerTitle = scene.title.toLocaleLowerCase();
    const lowerChapter = chapter?.title.toLocaleLowerCase() ?? '';
    let score = 0;
    for (const term of effectiveTerms) {
      score += countOccurrences(lowerTitle, term) * 20;
      score += countOccurrences(lowerChapter, term) * 8;
      score += countOccurrences(lowerText, term) * 2;
    }
    if (score <= 0) continue;
    results.push({ scene, project, chapter, snippet: snippetAround(text, effectiveTerms), score });
  }
  return results.sort((a, b) => b.score - a.score || b.scene.updatedAt.localeCompare(a.scene.updatedAt)).slice(0, limit);
}