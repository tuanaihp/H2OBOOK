"use client";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { PlatformDashboard } from "@/components/operations/platform-dashboard";
import { platformRoutes } from "@/lib/operations/routes";
export default function PlatformAdminPage(){return <SimpleOperationsShell title="H2OBOOK Platform" subtitle="Super Admin Control" homeHref="/platform-admin" routes={platformRoutes} accentLabel="Platform Super Admin"><PlatformDashboard/></SimpleOperationsShell>;}
