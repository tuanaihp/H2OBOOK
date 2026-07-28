import type { H2OBook, H2OElement, H2OPage, TextFlowMetrics } from "@/types/editor";

export type TextMeasure = (text: string, style: Pick<H2OElement, "fontFamily" | "fontSize" | "fontWeight" | "fontStyle" | "letterSpacing">) => number;

export type TextFlowFrame = {
  id: string;
  pageId: string;
  pageIndex: number;
  elementIndex: number;
  element: H2OElement;
};

export type TextFlowSegment = {
  frameId: string;
  text: string;
  consumedCharacters: number;
  remainingCharacters: number;
  lineCount: number;
  usedHeight: number;
  availableHeight: number;
  overflow: boolean;
};

export type TextFlowResult = {
  chainId: string;
  sourceText: string;
  segments: TextFlowSegment[];
  remainingText: string;
  overflow: boolean;
};

function fontDescriptor(element: H2OElement) {
  return `${element.fontStyle === "italic" ? "italic " : ""}${element.fontWeight ?? 400} ${element.fontSize ?? 22}px ${element.fontFamily ?? "Arial"}`;
}

export const browserTextMeasure: TextMeasure = (text, style) => {
  if (typeof document === "undefined") {
    return text.length * (style.fontSize ?? 22) * 0.54 + Math.max(0, text.length - 1) * (style.letterSpacing ?? 0);
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return text.length * (style.fontSize ?? 22) * 0.54;
  context.font = `${style.fontStyle === "italic" ? "italic " : ""}${style.fontWeight ?? 400} ${style.fontSize ?? 22}px ${style.fontFamily ?? "Arial"}`;
  return context.measureText(text).width + Math.max(0, text.length - 1) * (style.letterSpacing ?? 0);
};

export const deterministicTextMeasure: TextMeasure = (text, style) => {
  const size = style.fontSize ?? 22;
  return [...text].reduce((width, character) => {
    if (/\s/.test(character)) return width + size * 0.28;
    if (/[MW@#%]/.test(character)) return width + size * 0.82;
    if (/[ilI1.,'`]/.test(character)) return width + size * 0.28;
    return width + size * 0.54;
  }, 0) + Math.max(0, text.length - 1) * (style.letterSpacing ?? 0);
};

function frameGeometry(element: H2OElement) {
  const padding = Math.max(0, element.flowPadding ?? 8);
  const fontSize = Math.max(6, element.fontSize ?? 22);
  const lineHeightPx = fontSize * Math.max(0.8, element.lineHeight ?? 1.35);
  const availableWidth = Math.max(8, element.width - padding * 2);
  const availableHeight = Math.max(lineHeightPx, element.height - padding * 2);
  const maxLines = Math.max(1, Math.floor(availableHeight / lineHeightPx));
  return { padding, fontSize, lineHeightPx, availableWidth, availableHeight, maxLines };
}

function nextTokenEnd(text: string, start: number) {
  if (text[start] === "\n") return start + 1;
  let cursor = start;
  const whitespace = /[\t ]/.test(text[start] ?? "");
  while (cursor < text.length && text[cursor] !== "\n" && /[\t ]/.test(text[cursor]) === whitespace) cursor += 1;
  return cursor;
}

/**
 * Fits a plain-text source into one positioned text frame using real Canvas
 * measurements in the browser and a deterministic fallback in tests/workers.
 */
export function fitTextToFrame(source: string, element: H2OElement, measure: TextMeasure = browserTextMeasure) {
  const geometry = frameGeometry(element);
  let cursor = 0;
  let line = "";
  let lineCount = 1;
  let consumed = 0;

  const fits = (value: string) => measure(value, element) <= geometry.availableWidth;

  while (cursor < source.length) {
    if (source[cursor] === "\n") {
      if (lineCount >= geometry.maxLines) break;
      cursor += 1;
      consumed = cursor;
      line = "";
      lineCount += 1;
      continue;
    }

    const tokenEnd = nextTokenEnd(source, cursor);
    const token = source.slice(cursor, tokenEnd);
    const candidate = line + token;
    if (fits(candidate)) {
      line = candidate;
      cursor = tokenEnd;
      consumed = cursor;
      continue;
    }

    if (line.trim().length > 0) {
      if (lineCount >= geometry.maxLines) break;
      lineCount += 1;
      line = "";
      continue;
    }

    // A single token is wider than the frame. Split it character by character.
    let local = cursor;
    let fragment = "";
    while (local < tokenEnd) {
      const candidateFragment = fragment + source[local];
      if (fragment && !fits(candidateFragment)) break;
      fragment = candidateFragment;
      local += 1;
    }
    if (local === cursor) local += 1;
    line = source.slice(cursor, local);
    cursor = local;
    consumed = cursor;
    if (cursor < tokenEnd) {
      if (lineCount >= geometry.maxLines) break;
      lineCount += 1;
      line = "";
    }
  }

  const rawSegment = source.slice(0, consumed);
  const segment = rawSegment.replace(/[\t ]+$/g, "");
  const remainder = source.slice(consumed).replace(/^[\t ]+/g, "");
  const actualLines = source.length === 0 ? 0 : Math.min(geometry.maxLines, lineCount);
  return {
    text: segment,
    remainder,
    consumedCharacters: consumed,
    lineCount: actualLines,
    usedHeight: actualLines * geometry.lineHeightPx,
    availableHeight: geometry.availableHeight,
    overflow: remainder.length > 0,
    font: fontDescriptor(element),
  };
}

export function collectTextFlowFrames(book: H2OBook, chainId: string): TextFlowFrame[] {
  const frames: TextFlowFrame[] = [];
  book.pages.forEach((page, pageIndex) => page.elements.forEach((element, elementIndex) => {
    if (element.type === "text" && element.flowChainId === chainId) frames.push({ id: element.id, pageId: page.id, pageIndex, elementIndex, element });
  }));
  return frames.sort((a, b) => (a.element.flowOrder ?? Number.MAX_SAFE_INTEGER) - (b.element.flowOrder ?? Number.MAX_SAFE_INTEGER)
    || a.pageIndex - b.pageIndex || a.element.y - b.element.y || a.element.x - b.element.x || a.elementIndex - b.elementIndex);
}

export function flowTextAcrossFrames(chainId: string, sourceText: string, frames: TextFlowFrame[], measure: TextMeasure = browserTextMeasure): TextFlowResult {
  let remainingText = sourceText;
  const segments: TextFlowSegment[] = [];
  frames.forEach((frame) => {
    const fit = fitTextToFrame(remainingText, frame.element, measure);
    remainingText = fit.remainder;
    segments.push({
      frameId: frame.id,
      text: fit.text,
      consumedCharacters: fit.consumedCharacters,
      remainingCharacters: remainingText.length,
      lineCount: fit.lineCount,
      usedHeight: fit.usedHeight,
      availableHeight: fit.availableHeight,
      overflow: remainingText.length > 0,
    });
  });
  return { chainId, sourceText, segments, remainingText, overflow: remainingText.length > 0 };
}

function sourceForFrames(frames: TextFlowFrame[]) {
  const explicit = frames.find((frame) => typeof frame.element.flowSourceText === "string")?.element.flowSourceText;
  if (typeof explicit === "string") return explicit;
  return frames.map((frame) => frame.element.text ?? "").filter(Boolean).join("\n\n");
}

export function applyTextFlow(book: H2OBook, chainId: string, measure: TextMeasure = browserTextMeasure): H2OBook {
  const frames = collectTextFlowFrames(book, chainId);
  if (!frames.length) return book;
  const sourceText = sourceForFrames(frames);
  const result = flowTextAcrossFrames(chainId, sourceText, frames, measure);
  const segmentById = new Map(result.segments.map((segment) => [segment.frameId, segment]));
  const orderById = new Map(frames.map((frame, index) => [frame.id, index]));
  const now = new Date().toISOString();
  return {
    ...book,
    updatedAt: now,
    pages: book.pages.map((page) => ({
      ...page,
      elements: page.elements.map((element) => {
        const segment = segmentById.get(element.id);
        if (!segment) return element;
        const frameIndex = orderById.get(element.id) ?? 0;
        const metrics: TextFlowMetrics = {
          chainId,
          frameIndex,
          lineCount: segment.lineCount,
          usedHeight: segment.usedHeight,
          availableHeight: segment.availableHeight,
          consumedCharacters: segment.consumedCharacters,
          remainingCharacters: segment.remainingCharacters,
          overflow: frameIndex === frames.length - 1 && result.overflow,
          lastReflowAt: now,
        };
        return {
          ...element,
          text: segment.text,
          flowOrder: frameIndex,
          flowSourceText: frameIndex === 0 ? sourceText : undefined,
          flowOverflow: metrics.overflow,
          flowMetrics: metrics,
          overflowBehavior: "flow",
          localRevision: (element.localRevision ?? 0) + 1,
        };
      }),
    })),
  };
}

export function linkTextFrames(book: H2OBook, elementIds: string[], chainId: string): H2OBook {
  const idSet = new Set(elementIds);
  const selected: TextFlowFrame[] = [];
  book.pages.forEach((page, pageIndex) => page.elements.forEach((element, elementIndex) => {
    if (idSet.has(element.id) && element.type === "text") selected.push({ id: element.id, pageId: page.id, pageIndex, elementIndex, element });
  }));
  selected.sort((a, b) => a.pageIndex - b.pageIndex || a.element.y - b.element.y || a.element.x - b.element.x || a.elementIndex - b.elementIndex);
  if (selected.length < 2) return book;
  const sourceText = selected.map((frame) => frame.element.flowSourceText ?? frame.element.text ?? "").filter(Boolean).join("\n\n");
  const selectedOrder = new Map(selected.map((frame, index) => [frame.id, index]));
  const linked: H2OBook = {
    ...book,
    pages: book.pages.map((page) => ({
      ...page,
      elements: page.elements.map((element) => selectedOrder.has(element.id) ? {
        ...element,
        flowChainId: chainId,
        flowOrder: selectedOrder.get(element.id),
        flowSourceText: selectedOrder.get(element.id) === 0 ? sourceText : undefined,
        overflowBehavior: "flow",
      } : element),
    })),
  };
  return applyTextFlow(linked, chainId);
}

export function setTextFlowSource(book: H2OBook, chainId: string, sourceText: string): H2OBook {
  const frames = collectTextFlowFrames(book, chainId);
  if (!frames.length) return book;
  const firstId = frames[0].id;
  const next = {
    ...book,
    pages: book.pages.map((page) => ({ ...page, elements: page.elements.map((element) => element.id === firstId ? { ...element, flowSourceText: sourceText } : element) })),
  };
  return applyTextFlow(next, chainId);
}

export function unlinkTextFrame(book: H2OBook, elementId: string): H2OBook {
  const element = book.pages.flatMap((page) => page.elements).find((item) => item.id === elementId);
  const chainId = element?.flowChainId;
  const next = {
    ...book,
    pages: book.pages.map((page) => ({ ...page, elements: page.elements.map((item) => item.id === elementId ? {
      ...item,
      flowChainId: undefined,
      flowOrder: undefined,
      flowSourceText: undefined,
      flowOverflow: undefined,
      flowMetrics: undefined,
      overflowBehavior: "warn" as const,
    } : item) })),
  };
  return chainId ? applyTextFlow(next, chainId) : next;
}

export function appendFlowContinuation(book: H2OBook, chainId: string, pageIdFactory: () => string, elementIdFactory: () => string): H2OBook {
  const frames = collectTextFlowFrames(book, chainId);
  if (!frames.length) return book;
  const last = frames[frames.length - 1];
  const sourcePage = book.pages[last.pageIndex];
  const newPage: H2OPage = {
    id: pageIdFactory(),
    name: `${sourcePage.name} — tiếp theo`,
    width: sourcePage.width,
    height: sourcePage.height,
    background: sourcePage.background,
    pageType: "content",
    masterPageId: sourcePage.masterPageId,
    elements: [{
      ...last.element,
      id: elementIdFactory(),
      name: `${last.element.name} — tiếp theo`,
      text: "",
      flowOrder: frames.length,
      flowSourceText: undefined,
      flowOverflow: false,
      flowMetrics: undefined,
      localRevision: 0,
    }],
  };
  const pages = [...book.pages];
  pages.splice(last.pageIndex + 1, 0, newPage);
  return applyTextFlow({ ...book, pages }, chainId);
}
