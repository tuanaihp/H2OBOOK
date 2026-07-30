# Operations Expansion Architecture

## Purpose

The current H2OBOOK already has Public Academy, Student Experience and Workspace/Admin. This module adds the four missing operational boundaries without restructuring existing routes or stores.

## Spaces

### Customer / Admissions Portal
For leads and customers who are not yet fully provisioned as students. It covers application status, documents, deposits, orders and account provisioning.

### Instructor Workspace
For teachers and assistants. It covers class command, assessment queue, student progress and teaching resources without exposing all admin tools.

### Operations Center
For admissions, support, finance, content and admin teams. It unifies CRM, tickets, approvals, notifications, data migration, automation, product configuration and service health.

### Platform Super Admin
For SaaS operation across organizations. It must remain separated from workspace admin and disabled until a real `platform_admin` contract exists.

### Certificate Verification
A public read-only route backed by certificate records and revocation status.

## Non-destructive rules

- Do not replace `useAppStore`.
- Keep `useOperationsStore` isolated until production adapters are ready.
- Do not run the optional SQL before comparing existing tables and RLS helpers.
- Do not expose platform routes to workspace roles.
- Do not merge customer and student account states.
- Later page upgrades must preserve the route manifest in `lib/operations/routes.ts`.
