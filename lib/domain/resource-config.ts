export const DOMAIN_RESOURCES = {
  brands: { table: "brand_profiles", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "designer"] },
  templates: { table: "templates", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "designer"] },
  clones: { table: "book_clones", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "designer", "partner"] },
  classes: { table: "classes", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "teacher"] },
  assignments: { table: "assignments", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "teacher"] },
  quizzes: { table: "quizzes", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "teacher", "designer"] },
  reviews: { table: "review_requests", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "designer", "teacher"] },
  automations: { table: "automation_rules", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin"] },
  licenses: { table: "license_agreements", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin"] },
  royalties: { table: "royalty_payouts", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin"] },
  portals: { table: "white_label_portals", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin"] },
  notifications: { table: "notifications", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "designer", "partner", "teacher", "student"] },
  learningGoals: { table: "learning_goals", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "teacher", "student"] },
  flashcards: { table: "flashcards", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "teacher", "student"] },
  knowledgeSources: { table: "knowledge_sources", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "designer", "teacher"] },
  reusableBlocks: { table: "reusable_blocks", orgColumn: "organization_id", orderColumn: "created_at", ownerRoles: ["owner", "admin", "designer", "teacher"] }
} as const;

export type DomainResource = keyof typeof DOMAIN_RESOURCES;

export function isDomainResource(value: string): value is DomainResource {
  return Object.prototype.hasOwnProperty.call(DOMAIN_RESOURCES, value);
}
