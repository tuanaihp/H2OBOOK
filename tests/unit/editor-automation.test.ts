import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/store/editor-store";

// Studio automation actions (audit upgrade A–D): book skeleton generation, chapter renumbering,
// distribution, grid duplication and the one-pass auto-complete. The store is Zustand — it runs
// fine in Node because persistence is deferred/no-op outside the browser.

const store = () => useEditorStore.getState();
const pages = () => store().book.pages;
const texts = (pageIndex: number) => pages()[pageIndex].elements.filter((el) => el.type === "text").map((el) => el.text ?? "");

beforeEach(() => {
  store().resetDemo();
  // Start from a single blank page so generation replaces instead of appending.
  const blank = pages()[0];
  const blankBook = { ...store().book, title: "Sách test", pages: [{ ...blank, pageType: "blank" as const, elements: [], name: "Trang mới", background: "#fffdfb" }] };
  useEditorStore.setState({
    book: blankBook,
    committedBook: structuredClone(blankBook),
    activePageId: blank.id,
    selectedIds: [],
    history: [],
    historyIndex: -1
  });
});

describe("generateBookStructure", () => {
  it("builds cover + intro + numbered chapters + content + checklist in one call", () => {
    store().generateBookStructure({
      title: "Giáo trình Makeup",
      chapters: ["Định hướng", "Kỹ thuật nền", "Dự tiệc"],
      includeIntro: true,
      includeChecklist: true,
      contentsPerChapter: 1
    });
    const book = store().book;
    expect(book.title).toBe("Giáo trình Makeup");
    expect(pages().map((p) => p.pageType)).toEqual([
      "cover", "content", "chapter", "content", "chapter", "content", "chapter", "content", "checklist"
    ]);
    // Chapter labels + the content page that follows each opener share the chapter number.
    expect(texts(2)).toContain("CHƯƠNG 01");
    expect(texts(2)).toContain("ĐỊNH HƯỚNG");
    expect(texts(3)).toContain("CHƯƠNG 01");
    expect(texts(4)).toContain("CHƯƠNG 02");
    expect(texts(6)).toContain("CHƯƠNG 03");
    // Cover carries the real title instead of the placeholder.
    expect(texts(0)).toContain("GIÁO TRÌNH MAKEUP");
    expect(store().dirty).toBe(true);
    // Whole generation is a single undoable step.
    store().undo();
    expect(pages()).toHaveLength(1);
  });

  it("appends instead of replacing when the book already has content", () => {
    store().addPage("content");
    const before = pages().length;
    store().generateBookStructure({ title: "X", chapters: ["A"], includeIntro: false, includeChecklist: false });
    expect(pages().length).toBe(before + 2); // chapter opener + 1 content page
  });
});

describe("chapter auto-renumbering", () => {
  it("renumbers chapter labels when pages are reordered or deleted", () => {
    store().generateBookStructure({ title: "T", chapters: ["Một", "Hai"], includeIntro: false, includeChecklist: false, contentsPerChapter: 0 });
    // pages: [cover, chapter1, content1, chapter2, content2]
    const chapter2 = pages()[3];
    store().reorderPage(chapter2.id, "up");
    // chapter2 moved before content of chapter 1 → it becomes CHƯƠNG 02 still (still second chapter)
    expect(texts(2)).toContain("CHƯƠNG 02");
    // Deleting the first chapter renumbers the remaining one to CHƯƠNG 01.
    const firstChapter = pages().find((p) => p.pageType === "chapter");
    store().deletePage(firstChapter!.id);
    const remainingChapter = pages().find((p) => p.pageType === "chapter");
    expect(remainingChapter!.elements.find((el) => el.name === "Nhãn chương")?.text).toBe("CHƯƠNG 01");
  });
});

describe("distribute + grid + brand style", () => {
  const addThree = () => {
    store().addText("body");
    const first = store().selectedIds[0];
    store().addText("body");
    const second = store().selectedIds[0];
    store().addText("body");
    const third = store().selectedIds[0];
    return [first, second, third];
  };

  it("distributes three elements with equal horizontal gaps", () => {
    const [a, b, c] = addThree();
    // All three share x=95 initially; spread them first.
    store().updateElement(b, { x: 200 }, false);
    store().updateElement(c, { x: 700 }, false);
    useEditorStore.setState({ selectedIds: [a, b, c] });
    const els = () => pages()[0].elements;
    const w = els().find((el) => el.id === a)!.width;
    store().distributeSelected("horizontal");
    const gap1 = els().find((el) => el.id === b)!.x - (els().find((el) => el.id === a)!.x + w);
    const gap2 = els().find((el) => el.id === c)!.x - (els().find((el) => el.id === b)!.x + w);
    expect(gap1).toBeCloseTo(gap2, 5);
  });

  it("duplicates a selection into an N×M grid", () => {
    store().addText("body");
    const id = store().selectedIds[0];
    store().duplicateSelectedGrid(2, 2, 20);
    const copies = pages()[0].elements.filter((el) => el.id !== id && el.type === "text");
    expect(copies).toHaveLength(3); // 2×2 grid minus the origin cell
    const original = pages()[0].elements.find((el) => el.id === id)!;
    expect(copies.every((el) => el.x !== original.x || el.y !== original.y)).toBe(true);
  });

  it("applies brand fonts and heading color to selected text", () => {
    const id = addThree()[0];
    store().updateElement(id, { fontSize: 48 }, false);
    useEditorStore.setState({ selectedIds: [id] });
    store().applyBrandStyleToSelected();
    const element = pages()[0].elements.find((el) => el.id === id)!;
    expect(element.fontFamily).toBe(store().brand.headingFont);
    expect(element.fill).toBe(store().brand.primaryColor);
  });
});

describe("autoCompleteBook", () => {
  it("resolves smart fields, renumbers chapters and reflows chains in one pass", () => {
    store().generateBookStructure({ title: "T", chapters: ["A", "B"], includeIntro: false, includeChecklist: false, contentsPerChapter: 0 });
    const summary = store().autoCompleteBook();
    expect(summary.filled).toBeGreaterThan(0);
    // Cover smart field is resolved to the real brand name, not the placeholder.
    const cover = pages()[0];
    expect(cover.elements.find((el) => el.bindingKey === "brand.name")?.text).toBe(store().brand.name);
  });
});
