import { PublicAcademyCoursesPage } from "@/components/public-academy-v5";
import { loadPublicAcademyV5 } from "@/lib/public-academy-v5/loader.server";
export default async function Page(){return <PublicAcademyCoursesPage viewModel={await loadPublicAcademyV5()} />;}
