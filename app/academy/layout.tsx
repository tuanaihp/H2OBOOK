import { redirect } from "next/navigation";
export default function AcademyLayout({children}:{children:React.ReactNode}){if(process.env.NEXT_PUBLIC_PUBLIC_SITE_V2 === "false")redirect("/dashboard");return children}
