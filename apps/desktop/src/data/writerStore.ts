import { create } from 'zustand';
import { ensureBlockIds } from '../domain/blocks';
import { createId } from '../domain/ids';
import { createInitialWorkspace, createProjectBundle, createScene } from '../domain/defaults';
import { countDocumentCharacters } from '../domain/wordCount';
import type { BibleCard, Character, Foreshadow, NavKey, OutlineEntityType, OutlineItem, SaveState, Scene, TimelineEvent, WorkspaceData } from '../domain/types';


interface WriterStore {
  data: WorkspaceData;
  activeNav: NavKey;
  saveState: SaveState;
  lastSavedAt: string | null;
  error: string | null;
  setActiveNav: (nav: NavKey) => void;
  selectScene: (sceneId: string) => void;
  selectProject: (projectId: string) => void;
  setProjectMemoryEnabled: (projectId: string, enabled: boolean) => void;
  updateSceneDoc: (sceneId: string, doc: Scene['doc']) => void;
  updateSceneTitle: (sceneId: string, title: string) => void;
  addChapter: () => void;
  addScene: () => void;
  addProject: (name: string, aiMemoryEnabled?: boolean) => void;
  deleteProject: (projectId: string) => void;
  deleteChapter: (chapterId: string) => void;
  deleteScene: (sceneId: string) => void;
  updateChapterTitle: (chapterId: string, title: string) => void;
  cycleChapterStatus: (chapterId: string) => void;
  upsertOutlineItem: (
    entityType: OutlineEntityType,
    entityId: string,
    patch: Partial<Pick<OutlineItem, 'goal' | 'conflict' | 'turn' | 'outcome' | 'characters' | 'notes' | 'status'>>,
  ) => void;
  addCharacter: (name: string) => void;
  deleteCharacter: (id: string) => void;
  addBibleCard: (kind: BibleCard['kind'], name: string) => void;
  updateBibleCard: (id: string, patch: Partial<Pick<BibleCard, 'name' | 'aliases' | 'summary' | 'details' | 'tags' | 'kind'>>) => void;
  deleteBibleCard: (id: string) => void;
  addTimelineEvent: () => void;
  updateTimelineEvent: (id: string, patch: Partial<Pick<TimelineEvent, 'title' | 'description' | 'storyTime' | 'chapterId' | 'sceneId' | 'status'>>) => void;
  deleteTimelineEvent: (id: string) => void;
  addForeshadow: (title: string) => void;
  updateForeshadow: (id: string, patch: Partial<Pick<Foreshadow, 'title' | 'description' | 'plantedChapterId' | 'resolvedChapterId' | 'plannedPayoff' | 'status'>>) => void;
  deleteForeshadow: (id: string) => void;
  hydrate: (data: WorkspaceData) => void;
  markSaving: () => void;
  markSaved: () => void;
  markError: (message: string) => void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function replaceScene(data: WorkspaceData, sceneId: string, updater: (scene: Scene, stamp: string) => Scene): WorkspaceData {
  const stamp = nowIso();
  return {
    ...data,
    scenes: data.scenes.map((scene) => (scene.id === sceneId ? updater(scene, stamp) : scene)),
  };
}

function normalizeWorkspace(data: WorkspaceData): WorkspaceData {
  const projects = data.projects.map((project) => ({
    ...project,
    aiMemoryEnabled: project.aiMemoryEnabled === true,
  }));
  const activeProject = projects.find((project) => project.id === data.activeProjectId) ?? projects[0];
  const projectScenes = activeProject ? data.scenes.filter((scene) => scene.projectId === activeProject.id) : [];
  const activeScene = projectScenes.find((scene) => scene.id === data.activeSceneId) ?? projectScenes[0];
  return {
    ...data,
    projects,
    outlineItems: data.outlineItems ?? [],
    activeProjectId: activeProject?.id ?? data.activeProjectId,
    activeSceneId: activeScene?.id ?? data.activeSceneId,
  };
}
export const useWriterStore = create<WriterStore>((set) => ({
  data: createInitialWorkspace(),
  activeNav: 'shelf',
  saveState: 'saved',
  lastSavedAt: null,
  error: null,
  setActiveNav: (activeNav) => set({ activeNav }),
  selectScene: (activeSceneId) => set((state) => {
    const scene = state.data.scenes.find((item) => item.id === activeSceneId);
    if (!scene) return {};
    return {
      data: {
        ...state.data,
        activeProjectId: scene.projectId,
        activeSceneId: scene.id,
      },
    };
  }),
  selectProject: (projectId) => set((state) => {
    const project = state.data.projects.find((item) => item.id === projectId);
    if (!project) return {};
    const projectScenes = state.data.scenes.filter((scene) => scene.projectId === projectId);
    const activeScene = projectScenes.find((scene) => scene.id === state.data.activeSceneId);
    const fallbackScene = activeScene
      ?? state.data.chapters
        .filter((chapter) => chapter.projectId === projectId)
        .sort((a, b) => a.sort - b.sort)
        .map((chapter) => projectScenes.find((scene) => scene.chapterId === chapter.id) ?? null)
        .find((scene): scene is Scene => Boolean(scene))
      ?? projectScenes[0];
    return {
      activeNav: 'writing',
      data: {
        ...state.data,
        activeProjectId: projectId,
        activeSceneId: fallbackScene?.id ?? '',
      },
    };
  }),
  setProjectMemoryEnabled: (projectId, enabled) => set((state) => ({
    saveState: 'saving',
    data: {
      ...state.data,
      projects: state.data.projects.map((project) => project.id === projectId
        ? { ...project, aiMemoryEnabled: enabled, rev: project.rev + 1, updatedAt: nowIso() }
        : project),
    },
  })),
  updateSceneDoc: (sceneId, doc) => set((state) => {
    const normalized = ensureBlockIds(doc);
    const wordCount = countDocumentCharacters(normalized);
    return {
      saveState: 'saving',
      data: replaceScene(state.data, sceneId, (scene, stamp) => ({
        ...scene,
        doc: normalized,
        wordCount,
        rev: scene.rev + 1,
        updatedAt: stamp,
      })),
    };
  }),
  updateSceneTitle: (sceneId, title) => set((state) => ({
    saveState: 'saving',
    data: replaceScene(state.data, sceneId, (scene, stamp) => ({
      ...scene,
      title: title || '未命名场景',
      rev: scene.rev + 1,
      updatedAt: stamp,
    })),
  })),
  addChapter: () => set((state) => {
    const data = state.data;
    const project = data.projects.find((item) => item.id === data.activeProjectId);
    const volume = data.volumes.find((item) => item.projectId === project?.id);
    if (!project || !volume) return {};
    const chapters = data.chapters.filter((item) => item.volumeId === volume.id);
    const stamp = nowIso();
    const chapterId = createId();
    const scene = createScene(project.id, chapterId, '正文', 1);
    const chapter = {
      id: chapterId,
      projectId: project.id,
      volumeId: volume.id,
      title: `第${chapters.length + 1}章`,
      sort: chapters.length + 1,
      status: 'draft' as const,
      defaultSceneId: scene.id,
      rev: 1,
      createdAt: stamp,
      updatedAt: stamp,
    };
    const outlineItems: OutlineItem[] = [
      { id: createId(), projectId: project.id, entityType: 'chapter', entityId: chapter.id, goal: '', conflict: '', turn: '', outcome: '', characters: [], notes: '', status: 'planned', createdAt: stamp, updatedAt: stamp },
      { id: createId(), projectId: project.id, entityType: 'scene', entityId: scene.id, goal: '', conflict: '', turn: '', outcome: '', characters: [], notes: '', status: 'planned', createdAt: stamp, updatedAt: stamp },
    ];
    return {
      saveState: 'saving',
      data: {
        ...data,
        chapters: [...data.chapters, chapter],
        scenes: [...data.scenes, scene],
        outlineItems: [...data.outlineItems, ...outlineItems],
        activeSceneId: scene.id,
      },
    };
  }),
  addScene: () => set((state) => {
    const data = state.data;
    const current = data.scenes.find((scene) => scene.id === data.activeSceneId);
    if (!current) return {};
    const siblings = data.scenes.filter((scene) => scene.chapterId === current.chapterId);
    const scene = createScene(current.projectId, current.chapterId, `场景 ${siblings.length + 1}`, siblings.length + 1);
    const stamp = nowIso();
    const outline: OutlineItem = { id: createId(), projectId: scene.projectId, entityType: 'scene', entityId: scene.id, goal: '', conflict: '', turn: '', outcome: '', characters: [], notes: '', status: 'planned', createdAt: stamp, updatedAt: stamp };
    return {
      saveState: 'saving',
      data: { ...data, scenes: [...data.scenes, scene], outlineItems: [...data.outlineItems, outline], activeSceneId: scene.id },
    };
  }),
  addProject: (name, aiMemoryEnabled = false) => set((state) => {
    const bundle = createProjectBundle(name.trim() || '未命名长篇', aiMemoryEnabled);
    const stamp = nowIso();
    const outlineItems: OutlineItem[] = [
      { id: createId(), projectId: bundle.project.id, entityType: 'volume', entityId: bundle.volume.id, goal: '', conflict: '', turn: '', outcome: '', characters: [], notes: '', status: 'planned', createdAt: stamp, updatedAt: stamp },
      { id: createId(), projectId: bundle.project.id, entityType: 'chapter', entityId: bundle.chapter.id, goal: '', conflict: '', turn: '', outcome: '', characters: [], notes: '', status: 'planned', createdAt: stamp, updatedAt: stamp },
      { id: createId(), projectId: bundle.project.id, entityType: 'scene', entityId: bundle.scene.id, goal: '', conflict: '', turn: '', outcome: '', characters: [], notes: '', status: 'planned', createdAt: stamp, updatedAt: stamp },
    ];
    return {
      saveState: 'saving',
      data: {
        ...state.data,
        projects: [...state.data.projects, bundle.project],
        volumes: [...state.data.volumes, bundle.volume],
        chapters: [...state.data.chapters, bundle.chapter],
        scenes: [...state.data.scenes, bundle.scene],
        outlineItems: [...state.data.outlineItems, ...outlineItems],
        activeProjectId: bundle.project.id,
        activeSceneId: bundle.scene.id,
      },
    };
  }),
  deleteProject: (projectId) => set((state) => {
    const remainingProjects = state.data.projects.filter((project) => project.id !== projectId);
    const nextProject = remainingProjects[0] ?? null;
    const nextScene = nextProject
      ? state.data.scenes.filter((scene) => scene.projectId === nextProject.id).sort((a, b) => a.sort - b.sort)[0] ?? null
      : null;
    return {
      activeNav: 'shelf',
      saveState: 'saving',
      data: {
        ...state.data,
        projects: remainingProjects,
        volumes: state.data.volumes.filter((item) => item.projectId !== projectId),
        chapters: state.data.chapters.filter((item) => item.projectId !== projectId),
        scenes: state.data.scenes.filter((item) => item.projectId !== projectId),
        characters: state.data.characters.filter((item) => item.projectId !== projectId),
        bibleCards: state.data.bibleCards.filter((item) => item.projectId !== projectId),
        timelineEvents: state.data.timelineEvents.filter((item) => item.projectId !== projectId),
        foreshadows: state.data.foreshadows.filter((item) => item.projectId !== projectId),
        outlineItems: state.data.outlineItems.filter((item) => item.projectId !== projectId),
        activeProjectId: nextProject?.id ?? '',
        activeSceneId: nextScene?.id ?? '',
      },
    };
  }),
  deleteChapter: (chapterId) => set((state) => {
    const chapter = state.data.chapters.find((item) => item.id === chapterId);
    if (!chapter) return {};
    const remainingChapters = state.data.chapters.filter((item) => item.id !== chapterId);
    const remainingScenes = state.data.scenes.filter((item) => item.chapterId !== chapterId);
    const currentScene = state.data.scenes.find((item) => item.id === state.data.activeSceneId);
    const activeWasDeleted = currentScene?.chapterId === chapterId;
    const fallbackScene = activeWasDeleted
      ? remainingScenes.filter((item) => item.projectId === chapter.projectId).sort((a, b) => a.sort - b.sort)[0] ?? null
      : currentScene;
    const removedSceneIds = new Set(state.data.scenes.filter((item) => item.chapterId === chapterId).map((item) => item.id));
    return {
      saveState: 'saving',
      data: {
        ...state.data,
        chapters: remainingChapters,
        scenes: remainingScenes,
        outlineItems: state.data.outlineItems.filter((item) => !(item.entityType === 'chapter' && item.entityId === chapterId) && !(item.entityType === 'scene' && removedSceneIds.has(item.entityId))),
        activeSceneId: activeWasDeleted ? fallbackScene?.id ?? '' : state.data.activeSceneId,
      },
    };
  }),
  deleteScene: (sceneId) => set((state) => {
    const scene = state.data.scenes.find((item) => item.id === sceneId);
    if (!scene) return {};
    const remainingScenes = state.data.scenes.filter((item) => item.id !== sceneId);
    const fallbackScene = remainingScenes
      .filter((item) => item.chapterId === scene.chapterId)
      .sort((a, b) => a.sort - b.sort)[0]
      ?? remainingScenes.filter((item) => item.projectId === scene.projectId).sort((a, b) => a.sort - b.sort)[0]
      ?? null;
    return {
      saveState: 'saving',
      data: {
        ...state.data,
        scenes: remainingScenes,
        outlineItems: state.data.outlineItems.filter((item) => !(item.entityType === 'scene' && item.entityId === sceneId)),
        activeSceneId: state.data.activeSceneId === sceneId ? fallbackScene?.id ?? '' : state.data.activeSceneId,
      },
    };
  }),
  updateChapterTitle: (chapterId, title) => set((state) => ({
    saveState: 'saving',
    data: {
      ...state.data,
      chapters: state.data.chapters.map((chapter) => chapter.id === chapterId
        ? { ...chapter, title: title.trim() || chapter.title, rev: chapter.rev + 1, updatedAt: nowIso() }
        : chapter),
    },
  })),
  upsertOutlineItem: (entityType, entityId, patch) => set((state) => {
    const data = state.data;
    const projectId = entityType === 'volume'
      ? data.volumes.find((item) => item.id === entityId)?.projectId
      : entityType === 'chapter'
        ? data.chapters.find((item) => item.id === entityId)?.projectId
        : data.scenes.find((item) => item.id === entityId)?.projectId;
    if (!projectId) return {};
    const stamp = nowIso();
    const existing = data.outlineItems.find((item) => item.projectId === projectId && item.entityType === entityType && item.entityId === entityId);
    if (existing) {
      return {
        saveState: 'saving',
        data: {
          ...data,
          outlineItems: data.outlineItems.map((item) => item.id === existing.id ? { ...item, ...patch, updatedAt: stamp } : item),
        },
      };
    }
    const item: OutlineItem = {
      id: createId(), projectId, entityType, entityId, goal: '', conflict: '', turn: '', outcome: '',
      characters: [], notes: '', status: 'planned', ...patch, createdAt: stamp, updatedAt: stamp,
    };
    return { saveState: 'saving', data: { ...data, outlineItems: [...data.outlineItems, item] } };
  }),
  cycleChapterStatus: (chapterId) => set((state) => {
    const order = ['draft', 'revising', 'done'] as const;
    return {
      saveState: 'saving',
      data: {
        ...state.data,
        chapters: state.data.chapters.map((chapter) => {
          if (chapter.id !== chapterId) return chapter;
          const next = order[(order.indexOf(chapter.status) + 1) % order.length];
          return { ...chapter, status: next, rev: chapter.rev + 1, updatedAt: nowIso() };
        }),
      },
    };
  }),
  deleteCharacter: (id) => set((state) => ({
    saveState: 'saving',
    data: { ...state.data, characters: state.data.characters.filter((character) => character.id !== id) },
  })),
  addCharacter: (name) => set((state) => {
    const trimmed = name.trim();
    if (!trimmed) return {};
    const character: Character = {
      id: createId(),
      projectId: state.data.activeProjectId,
      name: trimmed,
      aliases: [],
      role: '待补充',
      notes: '',
      rev: 1,
      updatedAt: nowIso(),
    };
    return { saveState: 'saving', data: { ...state.data, characters: [...state.data.characters, character] } };
  }),
  addBibleCard: (kind, name) => set((state) => {
    const trimmed = name.trim();
    if (!trimmed) return {};
    const stamp = nowIso();
    const card: BibleCard = {
      id: createId(), projectId: state.data.activeProjectId, kind, name: trimmed, aliases: [],
      summary: '', details: '', tags: [], rev: 1, createdAt: stamp, updatedAt: stamp,
    };
    return { saveState: 'saving', data: { ...state.data, bibleCards: [...state.data.bibleCards, card] } };
  }),
  updateBibleCard: (id, patch) => set((state) => {
    const stamp = nowIso();
    return {
      saveState: 'saving',
      data: {
        ...state.data,
        bibleCards: state.data.bibleCards.map((card) => card.id === id
          ? { ...card, ...patch, name: patch.name?.trim() || card.name, rev: card.rev + 1, updatedAt: stamp }
          : card),
      },
    };
  }),
  deleteBibleCard: (id) => set((state) => ({
    saveState: 'saving',
    data: { ...state.data, bibleCards: state.data.bibleCards.filter((card) => card.id !== id) },
  })),
  addTimelineEvent: () => set((state) => {
    const events = state.data.timelineEvents.filter((event) => event.projectId === state.data.activeProjectId);
    const stamp = nowIso();
    const event: TimelineEvent = {
      id: createId(), projectId: state.data.activeProjectId, chapterId: null, sceneId: null,
      title: `事件 ${events.length + 1}`, description: '', storyTime: '', sort: events.length + 1,
      status: 'planned', rev: 1, createdAt: stamp, updatedAt: stamp,
    };
    return { saveState: 'saving', data: { ...state.data, timelineEvents: [...state.data.timelineEvents, event] } };
  }),
  updateTimelineEvent: (id, patch) => set((state) => {
    const stamp = nowIso();
    return {
      saveState: 'saving',
      data: {
        ...state.data,
        timelineEvents: state.data.timelineEvents.map((event) => event.id === id
          ? { ...event, ...patch, title: patch.title?.trim() || event.title, rev: event.rev + 1, updatedAt: stamp }
          : event),
      },
    };
  }),
  deleteTimelineEvent: (id) => set((state) => ({
    saveState: 'saving',
    data: { ...state.data, timelineEvents: state.data.timelineEvents.filter((event) => event.id !== id) },
  })),
  addForeshadow: (title) => set((state) => {
    const trimmed = title.trim();
    if (!trimmed) return {};
    const stamp = nowIso();
    const foreshadow: Foreshadow = {
      id: createId(), projectId: state.data.activeProjectId, title: trimmed, description: '',
      plantedChapterId: null, resolvedChapterId: null, plannedPayoff: '', status: 'planted',
      rev: 1, createdAt: stamp, updatedAt: stamp,
    };
    return { saveState: 'saving', data: { ...state.data, foreshadows: [...state.data.foreshadows, foreshadow] } };
  }),
  updateForeshadow: (id, patch) => set((state) => {
    const stamp = nowIso();
    return {
      saveState: 'saving',
      data: {
        ...state.data,
        foreshadows: state.data.foreshadows.map((item) => item.id === id
          ? { ...item, ...patch, title: patch.title?.trim() || item.title, rev: item.rev + 1, updatedAt: stamp }
          : item),
      },
    };
  }),
  deleteForeshadow: (id) => set((state) => ({
    saveState: 'saving',
    data: { ...state.data, foreshadows: state.data.foreshadows.filter((item) => item.id !== id) },
  })),
  hydrate: (data) => set({ data: normalizeWorkspace(data), saveState: 'saved', error: null }),
  markSaving: () => set({ saveState: 'saving' }),
  markSaved: () => set({ saveState: 'saved', lastSavedAt: nowIso(), error: null }),
  markError: (message) => set({ saveState: 'error', error: message }),
}));

export function getActiveScene(data: WorkspaceData): Scene | undefined {
  return data.scenes.find((scene) => scene.id === data.activeSceneId);
}

export { createInitialWorkspace };
