"use client";
import { SimpleOperationsShell } from "@/components/operations/simple-shell";
import { InstructorDashboard } from "@/components/operations/instructor-dashboard";
import { instructorRoutes } from "@/lib/operations/routes";
export default function InstructorPage(){return <SimpleOperationsShell title="H2OBOOK Instructor" subtitle="Teaching Workspace" homeHref="/instructor" routes={instructorRoutes} accentLabel="Instructor Workspace"><InstructorDashboard/></SimpleOperationsShell>;}
