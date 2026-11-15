import { Document as DocxDocument, HeadingLevel, Packer, Paragraph } from 'docx';
import JSZip from 'jszip';
import { collectPlainText } from './blocks';
import type { WorkspaceData } from './types';

export function projectToTxt(data: WorkspaceData, projectId: string): string {
  const volumes = data.volumes.filter((volume) => volume.projectId === projectId).sort((a, b) => a.sort - b.sort);
  const chapters = data.chapters.filter((chapter) => chapter.projectId === projectId).sort((a, b) => a.sort - b.sort);
  const scenes = data.scenes.filter((scene) => scene.projectId === projectId).sort((a, b) => a.sort - b.sort);
  const sections: string[] = [];

  for (const volume of volumes) {
    const volumeChapters = chapters.filter((chapter) => chapter.volumeId === volume.id);
    if (volumeChapters.length === 0) continue;
    sections.push(volume.title);
    for (const chapter of volumeChapters) {
      sections.push(chapter.title);
      for (const scene of scenes.filter((item) => item.chapterId === chapter.id)) {
        const text = collectPlainText(scene.doc).trim();
        if (text) sections.push(text);
      }
      sections.push('');
    }
  }

  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
export function projectToMarkdown(data: WorkspaceData, projectId: string): string {
  const project = data.projects.find((item) => item.id === projectId);
  const chapters = data.chapters.filter((chapter) => chapter.projectId === projectId).sort((a, b) => a.sort - b.sort);
  const scenes = data.scenes.filter((scene) => scene.projectId === projectId).sort((a, b) => a.sort - b.sort);
  const sections: string[] = [`# ${project?.name ?? '未命名项目'}`];
  for (const chapter of chapters) {
    sections.push(`## ${chapter.title}`);
    for (const scene of scenes.filter((item) => item.chapterId === chapter.id)) {
      const text = collectPlainText(scene.doc).trim();
      if (text) sections.push(text);
    }
  }
  return sections.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
export async function projectToDocx(data: WorkspaceData, projectId: string): Promise<Blob> {
  const project = data.projects.find((item) => item.id === projectId);
  const chapters = data.chapters.filter((chapter) => chapter.projectId === projectId).sort((a, b) => a.sort - b.sort);
  const scenes = data.scenes.filter((scene) => scene.projectId === projectId).sort((a, b) => a.sort - b.sort);
  const paragraphs: Paragraph[] = [new Paragraph({ text: project?.name ?? '未命名项目', heading: HeadingLevel.TITLE })];
  chapters.forEach((chapter, chapterIndex) => {
    paragraphs.push(new Paragraph({ text: chapter.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: chapterIndex > 0 }));
    for (const scene of scenes.filter((item) => item.chapterId === chapter.id)) {
      if (scene.title && scene.title !== '正文') paragraphs.push(new Paragraph({ text: scene.title, heading: HeadingLevel.HEADING_2 }));
      const text = collectPlainText(scene.doc).trim();
      if (text) {
        for (const paragraph of text.split(/\n+/).map((line) => line.trim()).filter(Boolean)) {
          paragraphs.push(new Paragraph({ text: paragraph }));
        }
      }
    }
  });
  const document = new DocxDocument({ sections: [{ properties: {}, children: paragraphs }] });
  return Packer.toBlob(document);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function projectToEpub(data: WorkspaceData, projectId: string): Promise<Blob> {
  const project = data.projects.find((item) => item.id === projectId);
  const title = project?.name ?? '未命名项目';
  const chapters = data.chapters.filter((chapter) => chapter.projectId === projectId).sort((a, b) => a.sort - b.sort);
  const scenes = data.scenes.filter((scene) => scene.projectId === projectId).sort((a, b) => a.sort - b.sort);
  const zip = new JSZip();
  const bookId = `urn:uuid:${crypto.randomUUID()}`;
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  zip.file('OEBPS/style.css', `body{font-family:serif;line-height:1.85;margin:6%;}h1{font-size:1.8em;margin:1.4em 0 .8em;}h2{font-size:1.3em;margin:1.2em 0 .7em;}p{text-indent:2em;margin:.7em 0;}`);
  const manifest: string[] = [];
  const spine: string[] = [];
  const toc: string[] = [];
  chapters.forEach((chapter, index) => {
    const chapterScenes = scenes.filter((scene) => scene.chapterId === chapter.id);
    const paragraphs = chapterScenes.flatMap((scene) => collectPlainText(scene.doc).split(/\n+/).map((line) => line.trim()).filter(Boolean));
    const filename = `chapter-${index + 1}.xhtml`;
    zip.file(`OEBPS/${filename}`, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN"><head><meta charset="utf-8"/><title>${xmlEscape(chapter.title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body><h1>${xmlEscape(chapter.title)}</h1>${paragraphs.map((text) => `<p>${xmlEscape(text)}</p>`).join('')}</body></html>`);
    manifest.push(`<item id="chapter-${index + 1}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="chapter-${index + 1}"/>`);
    toc.push(`<li><a href="${filename}">${xmlEscape(chapter.title)}</a></li>`);
  });
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN"><head><meta charset="utf-8"/><title>目录</title></head><body><nav epub:type="toc"><h1>目录</h1><ol>${toc.join('')}</ol></nav></body></html>`);
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${bookId}</dc:identifier><dc:title>${xmlEscape(title)}</dc:title><dc:language>zh-CN</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="style.css" media-type="text/css"/>${manifest.join('')}</manifest><spine>${spine.join('')}</spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}
