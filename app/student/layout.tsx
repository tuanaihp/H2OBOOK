import { redirect } from "next/navigation";
import { StudentShell } from "@/components/student/student-shell";
export const metadata={title:{default:"Học viên | H2OBOOK",template:"%s | H2OBOOK Student"}};
export default function StudentLayout({children}:{children:React.ReactNode}){if(process.env.NEXT_PUBLIC_STUDENT_EXPERIENCE_V2 === "false")redirect("/learn");return <StudentShell>{children}</StudentShell>}
