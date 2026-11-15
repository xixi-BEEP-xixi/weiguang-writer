import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useWriterStore } from '../data/writerStore';
import type { NavKey } from '../domain/types';

export const ONBOARDING_STORAGE_KEY = 'weiguang.ui-tour.v2';
export const OPEN_ONBOARDING_EVENT = 'weiguang:open-ui-tour';

export function openOnboardingGuide(): void {
  window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT));
}

interface TourStep {
  target: string;
  nav?: NavKey;
  title: string;
  body: string;
}

const steps: TourStep[] = [
  { target: '[data-tour="shelf"]', nav: 'shelf', title: '书架在这里', body: '所有作品都集中在书架。左侧导航现在已经显示完整名称，不再只靠小图标辨认。' },
  { target: '[data-tour="shelf-grid"]', nav: 'shelf', title: '点一本书开始写', body: '点击封面卡片进入对应作品；右上角和书架都提供新建书籍入口。' },
  { target: '[data-tour="writing"]', nav: 'writing', title: '写作页', body: '进入作品后会打开写作页。左侧管理卷、章和场景，中间是正文编辑器。' },
  { target: '[data-tour="editor-toolbar"]', nav: 'writing', title: '常用写作工具', body: '格式、版本历史、AI 助手和专注模式都在这里。按 Ctrl+S 可手动保存版本。' },
  { target: '[data-tour="bible"]', nav: 'bible', title: '故事圣经', body: '人物、地点和设定集中放在这里。第一次进入会显示页面气泡，也可以点右下角“提示”重看。' },
  { target: '[data-tour="ai-assistant"]', nav: 'writing', title: 'AI 写作助手', body: '在 AI 面板中填写要求并生成建议。软件不内置模型，使用前需要配置你自己的 API。' },
  { target: '[data-tour="memory"]', nav: 'memory', title: '长期记忆', body: 'AI 提取的事实会先进入待确认区；只有你确认后的记忆才会参与后续上下文。' },
  { target: '[data-tour="settings"]', nav: 'settings', title: '设置与外观', body: '设置页只保留写作背景、界面导览和关于信息；AI 配置与数据备份在左侧独立入口。' },
];

interface BubblePosition { top: number; left: number }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function OnboardingGuide({ onClose }: { onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [position, setPosition] = useState<BubblePosition>({ top: 120, left: 120 });
  const setActiveNav = useWriterStore((state) => state.setActiveNav);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  useLayoutEffect(() => {
    if (step.nav) setActiveNav(step.nav);
    let target: HTMLElement | null = null;
    const update = () => {
      target = document.querySelector<HTMLElement>(step.target);
      if (!target) {
        setPosition({ top: Math.max(24, window.innerHeight / 2 - 100), left: Math.max(24, window.innerWidth / 2 - 170) });
        return;
      }
      const rect = target.getBoundingClientRect();
      const inRail = Boolean(target.closest('.nav-rail'));
      const bubbleWidth = 340;
      const bubbleHeight = 190;
      const left = inRail
        ? rect.right + 16
        : clamp(rect.left + rect.width / 2 - bubbleWidth / 2, 16, window.innerWidth - bubbleWidth - 16);
      const top = inRail
        ? clamp(rect.top - 20, 56, window.innerHeight - bubbleHeight - 16)
        : clamp(rect.bottom + 12, 56, window.innerHeight - bubbleHeight - 16);
      setPosition({ top, left });
    };
    const timer = window.setTimeout(update, 80);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [setActiveNav, step]);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(step.target);
    target?.classList.add('ui-tour-target');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' && !isLast) setStepIndex((current) => Math.min(current + 1, steps.length - 1));
      if (event.key === 'ArrowLeft') setStepIndex((current) => Math.max(current - 1, 0));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      target?.classList.remove('ui-tour-target');
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isLast, onClose, step]);

  return (
    <div className="ui-tour-layer" role="presentation">
      <section className="ui-tour-bubble" style={{ top: position.top, left: position.left }} role="dialog" aria-modal="true" aria-labelledby="ui-tour-title">
        <header>
          <span>{stepIndex + 1} / {steps.length}</span>
          <button className="icon-button" type="button" aria-label="关闭界面导览" onClick={onClose}><X size={15} /></button>
        </header>
        <h3 id="ui-tour-title">{step.title}</h3>
        <p>{step.body}</p>
        <footer>
          <button className="ui-tour-skip" type="button" onClick={onClose}>跳过</button>
          <div>
            {stepIndex > 0 && <button className="secondary-button" type="button" onClick={() => setStepIndex((current) => Math.max(0, current - 1))}><ArrowLeft size={14} />上一步</button>}
            <button className="primary-button" type="button" onClick={() => isLast ? onClose() : setStepIndex((current) => current + 1)}>{isLast ? '完成' : '下一步'}{!isLast && <ArrowRight size={14} />}</button>
          </div>
        </footer>
      </section>
    </div>
  );
}