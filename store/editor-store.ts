"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultBrand, demoBook } from "@/lib/mock-data";
import { applyBrandToBook } from "@/lib/brand-resolver";
import { uid } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import type { BrandProfile, H2OBook, H2OElement, H2OPage, PageType } from "@/types/editor";
import { applyJsonPatch, diffJson, type JsonPatchOperation } from "@/lib/editor/json-patch";
import { appendFlowContinuation, applyTextFlow, collectTextFlowFrames, linkTextFrames, setTextFlowSource, unlinkTextFrame as unlinkTextFrameFromBook } from "@/lib/editor/text-flow";

type HistoryEntry = { forward: JsonPatchOperation[]; backward: JsonPatchOperation[]; pageId: string; selectedIds: string[]; createdAt: string };
type TextPreset = "heading" | "subheading" | "body" | "quote" | "caption";
type ShapePreset = "rectangle" | "pill" | "circle" | "callout";
type AlignMode = "left" | "center" | "right" | "top" | "middle" | "bottom";

type EditorState = {
  book: H2OBook;
  brand: BrandProfile;
  activePageId: string;
  selectedIds: string[];
  zoom: number;
  savedAt: string;
  dirty: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  history: HistoryEntry[];
  historyIndex: number;
  committedBook: H2OBook;
  loadBook: (bookId: string) => void;
  saveToLibrary: () => void;
  replaceBook: (book: H2OBook) => void;
  setSelected: (id: string | null, additive?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setActivePage: (id: string) => void;
  setZoom: (zoom: number) => void;
  setShowGrid: (value: boolean) => void;
  setSnapToGrid: (value: boolean) => void;
  updateElement: (id: string, patch: Partial<H2OElement>, record?: boolean) => void;
  updateSelected: (patch: Partial<H2OElement>, record?: boolean) => void;
  addText: (preset?: TextPreset) => void;
  addShape: (preset?: ShapePreset) => void;
  addLine: () => void;
  addQr: (value?: string) => void;
  addImage: (asset: string | { assetId: string; previewUrl: string; metadata?: H2OElement["imageMetadata"]; fileName?: string }) => void;
  duplicateElement: () => void;
  deleteElement: () => void;
  toggleLock: (id: string) => void;
  toggleVisibility: (id: string) => void;
  moveLayer: (id: string, direction: "up" | "down" | "top" | "bottom") => void;
  alignSelected: (mode: AlignMode) => void;
  linkSelectedTextFrames: () => void;
  reflowTextChain: (chainId: string) => void;
  reflowAllText: () => void;
  updateFlowSource: (chainId: string, sourceText: string, record?: boolean) => void;
  unlinkTextFrame: (elementId: string) => void;
  appendFlowContinuation: (chainId: string) => void;
  addPage: (type?: PageType) => void;
  applyPageTemplate: (type: PageType) => void;
  addImportedPage: (page: H2OPage) => void;
  importTextDocument: (title: string, text: string) => void;
  duplicatePage: (id: string) => void;
  deletePage: (id: string) => void;
  reorderPage: (id: string, direction: "up" | "down") => void;
  renamePage: (id: string, name: string) => void;
  setPageBackground: (value: string) => void;
  setBookTitle: (title: string) => void;
  applyBrand: (brand: BrandProfile) => void;
  resetDemo: () => void;
  undo: () => void;
  redo: () => void;
  checkpoint: () => void;
};

const permissions = (overrides: Partial<H2OElement["permissions"]> = {}): H2OElement["permissions"] => ({
  canEditContent: true,
  canMove: true,
  canResize: true,
  canDelete: true,
  canChangeColor: true,
  canReplaceAsset: true,
  canChangeFont: true,
  canRotate: true,
  ...overrides
});

const activePage = (state: EditorState) => state.book.pages.find((page) => page.id === state.activePageId);
const now = () => new Date().toISOString();

function makeText(preset: TextPreset = "body"): H2OElement {
  const options: Record<TextPreset, Pick<H2OElement, "name" | "text" | "fontSize" | "fontWeight" | "fontFamily" | "align" | "width" | "height">> = {
    heading: { name: "Tiêu đề lớn", text: "Tiêu đề bài học", fontSize: 48, fontWeight: 800, fontFamily: "Georgia", align: "left", width: 610, height: 130 },
    subheading: { name: "Tiêu đề phụ", text: "Tiêu đề phụ", fontSize: 30, fontWeight: 700, fontFamily: "Arial", align: "left", width: 560, height: 80 },
    body: { name: "Nội dung", text: "Nhập nội dung của bạn tại đây. Có thể thay đổi font chữ, màu sắc, căn lề và liên kết Smart Field.", fontSize: 22, fontWeight: 400, fontFamily: "Arial", align: "left", width: 600, height: 220 },
    quote: { name: "Trích dẫn", text: "“Một câu nói nổi bật giúp người đọc ghi nhớ nội dung quan trọng.”", fontSize: 30, fontWeight: 600, fontFamily: "Georgia", align: "center", width: 570, height: 150 },
    caption: { name: "Chú thích", text: "Chú thích hình ảnh hoặc nguồn tài liệu", fontSize: 15, fontWeight: 400, fontFamily: "Arial", align: "center", width: 480, height: 44 }
  };
  const presetValue = options[preset];
  return {
    id: uid("text"), type: "text", x: 95, y: preset === "heading" ? 110 : 210, rotation: 0, opacity: 1,
    locked: false, hidden: false, fill: "#3f2531", lineHeight: 1.35, letterSpacing: 0, verticalAlign: "top",
    ...presetValue,
    permissions: permissions()
  };
}

function makeShape(preset: ShapePreset = "rectangle"): H2OElement {
  const circular = preset === "circle";
  return {
    id: uid("shape"), type: "shape", name: preset === "callout" ? "Khung ghi nhớ" : preset === "pill" ? "Nhãn bo tròn" : preset === "circle" ? "Hình tròn" : "Hình chữ nhật",
    x: 170, y: 260, width: circular ? 220 : 420, height: circular ? 220 : preset === "pill" ? 90 : 210,
    rotation: 0, opacity: 1, locked: false, hidden: false, fill: preset === "callout" ? "#f3e5eb" : "#ead4dc",
    stroke: "transparent", strokeWidth: 0, cornerRadius: circular ? 999 : preset === "pill" ? 999 : 24,
    shadow: preset === "callout" ? { color: "#5c243e", blur: 18, offsetX: 0, offsetY: 8, opacity: 0.12 } : undefined,
    permissions: permissions({ canEditContent: false })
  };
}

function makePage(type: PageType = "blank"): H2OPage {
  const page: H2OPage = { id: uid("page"), name: "Trang mới", pageType: type, width: 794, height: 1123, background: "#fffdfb", elements: [] };
  if (type === "cover") {
    page.name = "Bìa sách"; page.background = "#6f1d46";
    page.elements = [
      { ...makeText("caption"), id: uid("text"), name: "Tên thương hiệu", text: "{{brand.name}}", bindingKey: "brand.name", x: 85, y: 80, width: 624, height: 45, fontSize: 18, fontWeight: 700, fill: "#f7dce5", align: "center", permissions: permissions({ canDelete: false }) },
      { ...makeText("heading"), id: uid("text"), name: "Tên sách", text: "TÊN CUỐN SÁCH\nCỦA BẠN", x: 85, y: 300, width: 624, height: 220, fontSize: 58, fill: "#ffffff", align: "center", permissions: permissions({ canDelete: false }) },
      { ...makeText("caption"), id: uid("text"), name: "Tác giả", text: "{{expert.name}} — {{expert.title}}", bindingKey: "expert.name", x: 100, y: 920, width: 594, height: 70, fontSize: 19, fill: "#ffffff", align: "center", permissions: permissions({ canDelete: false }) }
    ];
  }
  if (type === "content") {
    page.name = "Trang nội dung";
    page.elements = [
      { ...makeText("caption"), id: uid("text"), name: "Nhãn chương", text: "CHƯƠNG 01", x: 70, y: 70, width: 650, height: 35, fontSize: 15, fontWeight: 700, fill: "#a44e73", align: "left" },
      { ...makeText("heading"), id: uid("text"), x: 70, y: 125, width: 650, height: 130 },
      { ...makeText("body"), id: uid("text"), x: 70, y: 300, width: 650, height: 650 }
    ];
  }
  if (type === "chapter") {
    page.name = "Trang mở chương"; page.background = "#f1e5ea";
    page.elements = [
      { ...makeText("caption"), id: uid("text"), text: "CHƯƠNG 01", x: 110, y: 300, width: 574, height: 45, fontSize: 18, fontWeight: 800, fill: "#9b4f70", align: "center" },
      { ...makeText("heading"), id: uid("text"), text: "TÊN CHƯƠNG", x: 90, y: 400, width: 614, height: 170, fontSize: 60, fill: "#541b37", align: "center" }
    ];
  }
  if (type === "checklist") {
    page.name = "Checklist"; page.background = "#f4ece7";
    page.elements = [
      { ...makeText("heading"), id: uid("text"), text: "CHECKLIST THỰC HÀNH", x: 70, y: 75, width: 654, height: 80, fontSize: 40, align: "center" },
      { ...makeShape("callout"), id: uid("shape"), x: 70, y: 195, width: 654, height: 740, fill: "#ffffff" },
      { ...makeText("body"), id: uid("text"), text: "01  Nội dung cần chuẩn bị\n\n02  Quy trình thực hành\n\n03  Tiêu chí kiểm tra\n\n04  Ghi chú sau buổi học", x: 120, y: 260, width: 554, height: 570, fontSize: 25, fontWeight: 500 }
    ];
  }
  if (type === "gallery") {
    page.name = "Trang hình ảnh";
    page.elements = [
      { ...makeText("heading"), id: uid("text"), text: "HÌNH ẢNH MINH HỌA", x: 70, y: 70, width: 654, height: 80, fontSize: 38, align: "center" },
      { ...makeShape("rectangle"), id: uid("shape"), name: "Vị trí ảnh 1", x: 70, y: 200, width: 315, height: 360, fill: "#eadfe3" },
      { ...makeShape("rectangle"), id: uid("shape"), name: "Vị trí ảnh 2", x: 409, y: 200, width: 315, height: 360, fill: "#eadfe3" },
      { ...makeText("body"), id: uid("text"), text: "Mô tả kỹ thuật, điểm cần quan sát hoặc hướng dẫn thực hành.", x: 90, y: 630, width: 614, height: 250, align: "center" }
    ];
  }
  return page;
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      book: structuredClone(demoBook), brand: structuredClone(defaultBrand), activePageId: demoBook.pages[0].id,
      selectedIds: [], zoom: 0.62, savedAt: now(), dirty: false, showGrid: false, snapToGrid: true, gridSize: 10,
      history: [], historyIndex: -1, committedBook: structuredClone(demoBook),
      loadBook: (bookId) => {
        const source = useAppStore.getState().books.find((item) => item.id === bookId);
        if (!source) return;
        const brand = useAppStore.getState().brands.find((item) => item.id === source.brandId) ?? useAppStore.getState().brands[0] ?? defaultBrand;
        const book = structuredClone(source);
        set({ book, committedBook: structuredClone(book), brand: structuredClone(brand), activePageId: book.pages[0]?.id ?? "", selectedIds: [], history: [], historyIndex: -1, savedAt: now(), dirty: false });
      },
      saveToLibrary: () => {
        const book = { ...get().book, updatedAt: now() };
        const workspace = useAppStore.getState().workspace;
        useAppStore.getState().upsertBook(book);
        set({ savedAt: now(), dirty: false });
        if (process.env.NEXT_PUBLIC_APP_MODE === "production") {
          void fetch("/api/books/cloud-save", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId: workspace.id, book }) })
            .then(async (response) => { if (!response.ok) throw new Error((await response.json()).error ?? "CLOUD_SAVE_FAILED"); })
            .catch((error) => console.error("[H2OBOOK cloud save]", error));
        }
      },
      replaceBook: (book) => set({ book: structuredClone(book), committedBook: structuredClone(book), activePageId: book.pages[0]?.id ?? "", selectedIds: [], history: [], historyIndex: -1, savedAt: now(), dirty: true }),
      setSelected: (id, additive = false) => set((state) => ({ selectedIds: id ? additive ? state.selectedIds.includes(id) ? state.selectedIds.filter((item) => item !== id) : [...state.selectedIds, id] : [id] : [] })),
      selectAll: () => set((state) => ({ selectedIds: activePage(state)?.elements.filter((item) => !item.locked).map((item) => item.id) ?? [] })),
      clearSelection: () => set({ selectedIds: [] }),
      setActivePage: (id) => set({ activePageId: id, selectedIds: [] }),
      setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(1.4, zoom)) }),
      setShowGrid: (value) => set({ showGrid: value }),
      setSnapToGrid: (value) => set({ snapToGrid: value }),
      checkpoint: () => {
        set((state) => {
          const forward = diffJson(state.committedBook, state.book);
          if (!forward.length) return state;
          const backward = diffJson(state.book, state.committedBook);
          const trimmed = state.history.slice(0, state.historyIndex + 1);
          const entry: HistoryEntry = { forward, backward, pageId: state.activePageId, selectedIds: [...state.selectedIds], createdAt: now() };
          const history = [...trimmed, entry].slice(-200);
          return { history, historyIndex: history.length - 1, committedBook: structuredClone(state.book), savedAt: now(), dirty: true };
        });
      },
      updateElement: (id, patch, record = true) => {
        const before = activePage(get())?.elements.find((element) => element.id === id);
        const chainId = before?.flowChainId;
        set((state) => {
          let book = { ...state.book, updatedAt: now(), pages: state.book.pages.map((page) => page.id === state.activePageId ? { ...page, elements: page.elements.map((element) => element.id === id ? { ...element, ...patch, localRevision: (element.localRevision ?? 0) + 1 } : element) } : page) };
          const flowSensitive = ["width", "height", "fontSize", "fontFamily", "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "flowPadding"].some((key) => key in patch);
          if (chainId && flowSensitive) book = applyTextFlow(book, chainId);
          return { book, savedAt: now(), dirty: true };
        });
        if (record) queueMicrotask(() => get().checkpoint());
      },
      updateSelected: (patch, record = true) => {
        const ids = get().selectedIds;
        if (!ids.length) return;
        set((state) => ({ book: { ...state.book, updatedAt: now(), pages: state.book.pages.map((page) => page.id === state.activePageId ? { ...page, elements: page.elements.map((element) => ids.includes(element.id) ? { ...element, ...patch, localRevision: (element.localRevision ?? 0) + 1 } : element) } : page) }, dirty: true }));
        if (record) queueMicrotask(() => get().checkpoint());
      },
      addText: (preset = "body") => {
        const element = makeText(preset);
        set((state) => ({ selectedIds: [element.id], book: { ...state.book, pages: state.book.pages.map((page) => page.id === state.activePageId ? { ...page, elements: [...page.elements, element] } : page) }, dirty: true }));
        get().checkpoint();
      },
      addShape: (preset = "rectangle") => {
        const element = makeShape(preset);
        set((state) => ({ selectedIds: [element.id], book: { ...state.book, pages: state.book.pages.map((page) => page.id === state.activePageId ? { ...page, elements: [...page.elements, element] } : page) }, dirty: true }));
        get().checkpoint();
      },
      addLine: () => {
        const element: H2OElement = { id: uid("line"), type: "line", name: "Đường phân cách", x: 150, y: 350, width: 490, height: 4, rotation: 0, opacity: 1, locked: false, hidden: false, fill: "#a44e73", stroke: "#a44e73", strokeWidth: 4, cornerRadius: 4, permissions: permissions({ canEditContent: false }) };
        set((state) => ({ selectedIds: [element.id], book: { ...state.book, pages: state.book.pages.map((page) => page.id === state.activePageId ? { ...page, elements: [...page.elements, element] } : page) }, dirty: true }));
        get().checkpoint();
      },
      addQr: (value = "https://h2obook.vn") => {
        const element: H2OElement = { id: uid("qr"), type: "qr", name: "QR Code", x: 285, y: 340, width: 220, height: 220, rotation: 0, opacity: 1, locked: false, hidden: false, fill: "#3f2531", qrValue: value, text: value, cornerRadius: 10, permissions: permissions({ canChangeColor: true }) };
        set((state) => ({ selectedIds: [element.id], book: { ...state.book, pages: state.book.pages.map((page) => page.id === state.activePageId ? { ...page, elements: [...page.elements, element] } : page) }, dirty: true }));
        get().checkpoint();
      },
      addImage: (asset) => {
        const source = typeof asset === "string" ? { assetId: undefined, previewUrl: asset, metadata: undefined, fileName: undefined } : asset;
        const page = activePage(get());
        const pageWidth = page?.width ?? 794;
        const pageHeight = page?.height ?? 1123;
        const ratio = source.metadata?.pixelWidth && source.metadata?.pixelHeight ? source.metadata.pixelWidth / source.metadata.pixelHeight : 495 / 360;
        let width = Math.min(pageWidth * .72, 560);
        let height = width / Math.max(.05, ratio);
        const maxHeight = pageHeight * .64;
        if (height > maxHeight) { height = maxHeight; width = height * ratio; }
        const element: H2OElement = { id: uid("image"), type: "image", name: source.fileName || "Hình ảnh", x: (pageWidth - width) / 2, y: (pageHeight - height) / 2, width, height, rotation: 0, opacity: 1, locked: false, hidden: false, assetId: source.assetId, imageUrl: source.previewUrl, altText: (source.fileName || "Hình ảnh").replace(/\.[^.]+$/, ""), imageMetadata: source.metadata, imageFit: "contain", cornerRadius: 0, permissions: permissions({ canEditContent: false, canChangeColor: false }) };
        set((state) => ({ selectedIds: [element.id], book: { ...state.book, pages: state.book.pages.map((item) => item.id === state.activePageId ? { ...item, elements: [...item.elements, element] } : item) }, dirty: true }));
        get().checkpoint();
      },
      duplicateElement: () => {
        const state = get();
        const page = activePage(state);
        const sources = page?.elements.filter((element) => state.selectedIds.includes(element.id)) ?? [];
        if (!sources.length) return;
        const copies = sources.map((source) => ({ ...structuredClone(source), id: uid(source.type), name: `${source.name} bản sao`, x: source.x + 24, y: source.y + 24 }));
        set((current) => ({ selectedIds: copies.map((copy) => copy.id), book: { ...current.book, pages: current.book.pages.map((item) => item.id === current.activePageId ? { ...item, elements: [...item.elements, ...copies] } : item) }, dirty: true }));
        get().checkpoint();
      },
      deleteElement: () => {
        const state = get();
        if (!state.selectedIds.length) return;
        const deletable = new Set((activePage(state)?.elements ?? []).filter((element) => state.selectedIds.includes(element.id) && !element.locked && element.permissions.canDelete).map((element) => element.id));
        if (!deletable.size) return;
        set((current) => ({ selectedIds: [], book: { ...current.book, pages: current.book.pages.map((page) => page.id === current.activePageId ? { ...page, elements: page.elements.filter((element) => !deletable.has(element.id)) } : page) }, dirty: true }));
        get().checkpoint();
      },
      toggleLock: (id) => {
        const element = activePage(get())?.elements.find((item) => item.id === id);
        if (element) get().updateElement(id, { locked: !element.locked });
      },
      toggleVisibility: (id) => {
        const element = activePage(get())?.elements.find((item) => item.id === id);
        if (element) get().updateElement(id, { hidden: !element.hidden });
      },
      moveLayer: (id, direction) => {
        set((state) => ({ book: { ...state.book, pages: state.book.pages.map((page) => {
          if (page.id !== state.activePageId) return page;
          const items = [...page.elements];
          const index = items.findIndex((item) => item.id === id);
          if (index < 0) return page;
          const next = direction === "up" ? index + 1 : direction === "down" ? index - 1 : direction === "top" ? items.length - 1 : 0;
          if (next < 0 || next >= items.length || next === index) return page;
          const [item] = items.splice(index, 1); items.splice(next, 0, item);
          return { ...page, elements: items };
        }) }, dirty: true }));
        get().checkpoint();
      },
      alignSelected: (mode) => {
        const state = get(); const page = activePage(state); const selected = page?.elements.filter((item) => state.selectedIds.includes(item.id)) ?? [];
        if (!selected.length || !page) return;
        const left = Math.min(...selected.map((item) => item.x)); const right = Math.max(...selected.map((item) => item.x + item.width));
        const top = Math.min(...selected.map((item) => item.y)); const bottom = Math.max(...selected.map((item) => item.y + item.height));
        const patchById = new Map<string, Partial<H2OElement>>();
        selected.forEach((element) => {
          if (mode === "left") patchById.set(element.id, { x: selected.length === 1 ? 0 : left });
          if (mode === "center") patchById.set(element.id, { x: selected.length === 1 ? (page.width - element.width) / 2 : (left + right - element.width) / 2 });
          if (mode === "right") patchById.set(element.id, { x: selected.length === 1 ? page.width - element.width : right - element.width });
          if (mode === "top") patchById.set(element.id, { y: selected.length === 1 ? 0 : top });
          if (mode === "middle") patchById.set(element.id, { y: selected.length === 1 ? (page.height - element.height) / 2 : (top + bottom - element.height) / 2 });
          if (mode === "bottom") patchById.set(element.id, { y: selected.length === 1 ? page.height - element.height : bottom - element.height });
        });
        set((current) => ({ book: { ...current.book, pages: current.book.pages.map((item) => item.id === current.activePageId ? { ...item, elements: item.elements.map((element) => patchById.has(element.id) ? { ...element, ...patchById.get(element.id) } : element) } : item) }, dirty: true }));
        get().checkpoint();
      },
      linkSelectedTextFrames: () => {
        const state = get();
        const page = activePage(state);
        const textIds = page?.elements.filter((element) => state.selectedIds.includes(element.id) && element.type === "text").map((element) => element.id) ?? [];
        if (textIds.length < 2) return;
        const chainId = uid("flow");
        set({ book: linkTextFrames(state.book, textIds, chainId), dirty: true });
        get().checkpoint();
      },
      reflowTextChain: (chainId) => {
        set((state) => ({ book: applyTextFlow(state.book, chainId), dirty: true }));
        get().checkpoint();
      },
      reflowAllText: () => {
        const chainIds = new Set(get().book.pages.flatMap((page) => page.elements.map((element) => element.flowChainId).filter((value): value is string => Boolean(value))));
        set((state) => ({ book: [...chainIds].reduce((book, chainId) => applyTextFlow(book, chainId), state.book), dirty: true }));
        get().checkpoint();
      },
      updateFlowSource: (chainId, sourceText, record = true) => {
        set((state) => ({ book: setTextFlowSource(state.book, chainId, sourceText), dirty: true }));
        if (record) queueMicrotask(() => get().checkpoint());
      },
      unlinkTextFrame: (elementId) => {
        set((state) => ({ book: unlinkTextFrameFromBook(state.book, elementId), dirty: true }));
        get().checkpoint();
      },
      appendFlowContinuation: (chainId) => {
        const state = get();
        const nextBook = appendFlowContinuation(state.book, chainId, () => uid("page"), () => uid("text"));
        const frames = collectTextFlowFrames(nextBook, chainId);
        const last = frames[frames.length - 1];
        set({ book: nextBook, activePageId: last?.pageId ?? state.activePageId, selectedIds: last ? [last.id] : state.selectedIds, dirty: true });
        get().checkpoint();
      },
      addPage: (type = "blank") => {
        const page = makePage(type);
        set((state) => ({ activePageId: page.id, selectedIds: [], book: { ...state.book, pages: [...state.book.pages, page], updatedAt: now() }, dirty: true }));
        get().checkpoint();
      },
      applyPageTemplate: (type) => {
        const template = makePage(type);
        set((state) => ({ selectedIds: [], book: { ...state.book, pages: state.book.pages.map((page) => page.id === state.activePageId ? { ...template, id: page.id, name: page.name === "Trang mới" ? template.name : page.name } : page), updatedAt: now() }, dirty: true }));
        get().checkpoint();
      },
      addImportedPage: (page) => {
        set((state) => ({ activePageId: page.id, selectedIds: [], book: { ...state.book, pages: [...state.book.pages, { ...page, pageType: "imported" }], updatedAt: now() }, dirty: true }));
        get().checkpoint();
      },
      importTextDocument: (title, text) => {
        const normalized = text.replace(/\r/g, "").trim();
        const paragraphs = normalized.split(/\n{2,}/).filter(Boolean);
        const chunks: string[] = []; let buffer = "";
        for (const paragraph of paragraphs) {
          if ((buffer + "\n\n" + paragraph).length > 1700 && buffer) { chunks.push(buffer); buffer = paragraph; } else buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
        }
        if (buffer) chunks.push(buffer);
        if (!chunks.length) chunks.push(normalized || "Tài liệu trống");
        const pages = chunks.map((chunk, index) => {
          const page = makePage("content"); page.name = `${title} ${index + 1}`;
          const titleElement = page.elements.find((item) => item.name === "Tiêu đề lớn"); if (titleElement) titleElement.text = index === 0 ? title : `${title} — tiếp theo`;
          const body = page.elements.find((item) => item.name === "Nội dung"); if (body) body.text = chunk;
          return page;
        });
        set((state) => ({ activePageId: pages[0]?.id ?? state.activePageId, selectedIds: [], book: { ...state.book, title, pages: [...state.book.pages, ...pages], updatedAt: now() }, dirty: true }));
        get().checkpoint();
      },
      duplicatePage: (id) => {
        const source = get().book.pages.find((page) => page.id === id); if (!source) return;
        const page = structuredClone(source); page.id = uid("page"); page.name = `${source.name} bản sao`; page.elements = page.elements.map((element) => ({ ...element, id: uid(element.type) }));
        const state = get(); const index = state.book.pages.findIndex((item) => item.id === id); const pages = [...state.book.pages]; pages.splice(index + 1, 0, page);
        set({ book: { ...state.book, pages, updatedAt: now() }, activePageId: page.id, selectedIds: [], dirty: true }); get().checkpoint();
      },
      deletePage: (id) => {
        const state = get(); if (state.book.pages.length <= 1) return;
        const index = state.book.pages.findIndex((page) => page.id === id); const pages = state.book.pages.filter((page) => page.id !== id);
        const next = pages[Math.min(index, pages.length - 1)]; set({ book: { ...state.book, pages, updatedAt: now() }, activePageId: next.id, selectedIds: [], dirty: true }); get().checkpoint();
      },
      reorderPage: (id, direction) => {
        set((state) => { const pages = [...state.book.pages]; const index = pages.findIndex((page) => page.id === id); const next = direction === "up" ? index - 1 : index + 1; if (index < 0 || next < 0 || next >= pages.length) return state; [pages[index], pages[next]] = [pages[next], pages[index]]; return { book: { ...state.book, pages, updatedAt: now() }, dirty: true }; });
        get().checkpoint();
      },
      renamePage: (id, name) => { set((state) => ({ book: { ...state.book, pages: state.book.pages.map((page) => page.id === id ? { ...page, name } : page), updatedAt: now() }, dirty: true })); get().checkpoint(); },
      setPageBackground: (value) => { set((state) => ({ book: { ...state.book, pages: state.book.pages.map((page) => page.id === state.activePageId ? { ...page, background: value } : page), updatedAt: now() }, dirty: true })); get().checkpoint(); },
      setBookTitle: (title) => set((state) => ({ book: { ...state.book, title, updatedAt: now() }, savedAt: now(), dirty: true })),
      applyBrand: (brand) => { const book = applyBrandToBook(get().book, brand, true); set({ book, brand, activePageId: get().activePageId || book.pages[0]?.id || "", selectedIds: [], dirty: true }); get().checkpoint(); },
      resetDemo: () => set({ book: structuredClone(demoBook), committedBook: structuredClone(demoBook), brand: structuredClone(defaultBrand), activePageId: demoBook.pages[0].id, selectedIds: [], history: [], historyIndex: -1, dirty: false }),
      undo: () => set((state) => {
        if (state.historyIndex < 0) return state;
        const entry = state.history[state.historyIndex];
        const book = applyJsonPatch(state.book, entry.backward);
        return { book, committedBook: structuredClone(book), activePageId: entry.pageId, selectedIds: [...entry.selectedIds], historyIndex: state.historyIndex - 1, dirty: true };
      }),
      redo: () => set((state) => {
        const nextIndex = state.historyIndex + 1;
        const entry = state.history[nextIndex];
        if (!entry) return state;
        const book = applyJsonPatch(state.book, entry.forward);
        return { book, committedBook: structuredClone(book), activePageId: entry.pageId, selectedIds: [...entry.selectedIds], historyIndex: nextIndex, dirty: true };
      })
    }),
    { name: "h2obook-editor-v2", version: 3, migrate: (persistedState) => persistedState as { book: H2OBook; committedBook: H2OBook; brand: BrandProfile; activePageId: string; zoom: number; savedAt: string; showGrid: boolean; snapToGrid: boolean }, partialize: (state) => ({ book: state.book, committedBook: state.book, brand: state.brand, activePageId: state.activePageId, zoom: state.zoom, savedAt: state.savedAt, showGrid: state.showGrid, snapToGrid: state.snapToGrid }) }
  )
);
