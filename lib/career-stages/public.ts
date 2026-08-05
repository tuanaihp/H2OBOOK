import "server-only";
import { learningPaths } from "@/lib/public-site/content";
import { configuredAcademyOrganizationId } from "@/lib/academy/service";
import { loadCareerStages } from "./service";
import type { CareerStage } from "./types";

export interface PublicStageResource {
  id: string;
  resourceType: string;
  resourceId: string;
  title: string;
  summary: string;
  href: string;
}

export interface PublicStageDetail {
  slug: string;
  indexLabel: string;
  title: string;
  description: string;
  durationLabel: string;
  skills: string[];
  /** Openable by anyone, no account. */
  freeResources: PublicStageResource[];
  /** Everything else, counted rather than listed — the reason to sign up. */
  lockedCount: number;
  configured: boolean;
}

function resourceHref(resourceType: string, resourceId: string, href: string): string {
  if (href) return href;
  if (resourceType === "course") return `/academy/courses/${resourceId}`;
  if (resourceType === "publication" || resourceType === "book") return `/reader/${resourceId}`;
  return `/academy/books`;
}

function fromStage(stage: CareerStage): PublicStageDetail {
  const free = stage.resources.filter((resource) => resource.access === "free_preview");
  return {
    slug: stage.slug,
    indexLabel: stage.indexLabel,
    title: stage.title,
    description: stage.description,
    durationLabel: stage.durationLabel,
    skills: stage.skills,
    freeResources: free.map((resource) => ({
      id: resource.id,
      resourceType: resource.resourceType,
      resourceId: resource.resourceId,
      title: resource.title || resource.resourceId,
      summary: resource.summary,
      href: resourceHref(resource.resourceType, resource.resourceId, resource.href)
    })),
    lockedCount: stage.resources.length - free.length,
    configured: true
  };
}

/**
 * Falls back to the shipped hardcoded stage so the public page still renders a real stage before
 * anyone opens the admin panel — but reports configured:false so the page can be honest that no
 * material has been attached yet rather than showing an empty shelf as if that were the answer.
 */
function fromHardcoded(slug: string): PublicStageDetail | null {
  const path = learningPaths.find((candidate) => candidate.id === slug);
  if (!path) return null;
  return {
    slug: path.id,
    indexLabel: path.index,
    title: path.title,
    description: path.description,
    durationLabel: path.duration,
    skills: path.skills,
    freeResources: [],
    lockedCount: 0,
    configured: false
  };
}

export async function loadPublicStage(slug: string): Promise<PublicStageDetail | null> {
  const organizationId = await configuredAcademyOrganizationId();
  if (organizationId) {
    const stages = await loadCareerStages(organizationId);
    const stage = stages.find((candidate) => candidate.slug === slug);
    if (stage) return fromStage(stage);
  }
  return fromHardcoded(slug);
}

export async function listPublicStageSlugs(): Promise<string[]> {
  const organizationId = await configuredAcademyOrganizationId();
  if (organizationId) {
    const stages = await loadCareerStages(organizationId);
    if (stages.length > 0) return stages.map((stage) => stage.slug);
  }
  return learningPaths.map((path) => path.id);
}
