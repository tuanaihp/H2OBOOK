import { redirect } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
import { requireCurrentUser } from "@/lib/auth/current-user";
export const dynamic="force-dynamic";
export const metadata={title:{default:"Học viên | H2OBOOK",template:"%s | H2OBOOK Student"}};
export default async function StudentLayout({children}:{children:React.ReactNode}){if(process.env.NEXT_PUBLIC_STUDENT_EXPERIENCE_V2 === "false")redirect("/learn");const user=await requireCurrentUser();return <StudentShell currentUser={{name:user.name,email:user.email,role:user.role,demo:user.demo}}>{children}</StudentShell>}
