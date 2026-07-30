export type KnowledgeUniverseAccess = "public" | "student" | "workspace";
export type KnowledgeUniverseOrbit = 1 | 2 | 3;
export type KnowledgeUniverseIcon =
  | "books"
  | "courses"
  | "strategy"
  | "roadmap"
  | "student"
  | "mentor"
  | "design"
  | "studio"
  | "input"
  | "publish";

export interface KnowledgeUniverseNode {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  href: string;
  access: KnowledgeUniverseAccess;
  orbit: KnowledgeUniverseOrbit;
  angle: number;
  color: string;
  icon: KnowledgeUniverseIcon;
  eyebrow: string;
  output: string;
  metrics: Array<{ label: string; value: string }>;
}

export interface KnowledgeUniverseStage {
  id: "ingest" | "connect" | "personalize" | "act";
  index: string;
  label: string;
  title: string;
  description: string;
  progress: number;
  status: string;
}
