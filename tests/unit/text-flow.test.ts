import { describe, expect, it } from "vitest";
import { deterministicTextMeasure, fitTextToFrame, flowTextAcrossFrames } from "@/lib/editor/text-flow";
import type { H2OElement } from "@/types/editor";

const frame = (id: string, height = 100): H2OElement => ({
  id, type: "text", name: id, x: 0, y: 0, width: 220, height,
  rotation: 0, opacity: 1, locked: false, hidden: false, text: "",
  fontSize: 20, fontFamily: "Arial", fontWeight: 400, lineHeight: 1.2,
  permissions: { canEditContent: true, canMove: true, canResize: true, canDelete: true, canChangeColor: true },
});

describe("Text Flow Engine", () => {
  it("fits text into a finite frame and keeps the remainder", () => {
    const result = fitTextToFrame("Một đoạn nội dung dài cần được chảy qua nhiều khung văn bản khác nhau.", frame("a", 55), deterministicTextMeasure);
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.remainder.length).toBeGreaterThan(0);
    expect(result.overflow).toBe(true);
  });

  it("flows source text across ordered frames without losing content", () => {
    const source = "Dòng thứ nhất của giáo trình. Dòng thứ hai tiếp tục giải thích. Dòng thứ ba hoàn tất nội dung.";
    const frames = [frame("a", 65), frame("b", 65), frame("c", 65)].map((element, index) => ({ id: element.id, pageId: `p${index}`, pageIndex: index, elementIndex: 0, element }));
    const result = flowTextAcrossFrames("chain", source, frames, deterministicTextMeasure);
    const reconstructed = `${result.segments.map((item) => item.text).join(" ")} ${result.remainingText}`.replace(/\s+/g, " ").trim();
    expect(reconstructed).toBe(source.replace(/\s+/g, " ").trim());
    expect(result.segments).toHaveLength(3);
  });
});
