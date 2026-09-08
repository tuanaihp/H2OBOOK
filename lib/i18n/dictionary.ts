// Whole-app VI<->EN string table. Keys are the exact trimmed Vietnamese strings the app renders
// (harvested by scripts/harvest-i18n.mjs). components/providers/dom-translator.tsx swaps them at
// runtime when the locale is "en" (VI_EN) or, for stray English captions, when the locale is "vi"
// (EN_VI). Product/feature proper nouns (Skill Map, Brand Kit, Knowledge Space, Studio, …) are
// deliberately kept as-is. New strings can be added to lib/i18n/dict/part*.ts without touching any
// component.

import part1 from "./dict/part1";
import part2 from "./dict/part2";
import part3 from "./dict/part3";
import part4 from "./dict/part4";
export { EN_VI } from "./dict/part5";

export const VI_EN: Record<string, string> = { ...part1, ...part2, ...part3, ...part4 };
