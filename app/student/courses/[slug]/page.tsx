import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { findPublicCourse } from "@/lib/public-site/content";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getStudentCourse } from "@/lib/academy/student-course";
import { CoursePlayer } from "@/components/student/course-player";
export const dynamic="force-dynamic";
export default async function StudentCourseDetail({params}:{params:Promise<{slug:string}>}){const {slug}=await params;if(!findPublicCourse(slug))notFound();const user=await requireCurrentUser();const course=await getStudentCourse(user,slug);if(!course)notFound();if(!course.access)return <section className="h2o-course-access-denied"><LockKeyhole/><span>COURSE ACCESS</span><h1>Bạn chưa có quyền học khóa này.</h1><p>Quyền truy cập được cấp sau khi hồ sơ được duyệt hoặc thanh toán được xác nhận.</p><div><Link href={`/academy/courses/${slug}#academy-enrollment`}>Đăng ký khóa học</Link><Link href="/student/courses"><ArrowLeft/>Quay lại khóa học của tôi</Link></div></section>;return <CoursePlayer initialCourse={course}/>}
