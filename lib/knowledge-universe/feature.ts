export function isKnowledgeUniverseHeroEnabled(): boolean {
  return process.env.NEXT_PUBLIC_KNOWLEDGE_UNIVERSE_HERO_V1 !== "false";
}
