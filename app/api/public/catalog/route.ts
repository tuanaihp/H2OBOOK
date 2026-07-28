import { NextResponse } from "next/server";
import { learningPaths, membershipPlans, publicBooks, publicCourses, publicStrategies, successStories } from "@/lib/public-site/content";
export async function GET(){return NextResponse.json({version:"4.14.0",books:publicBooks,courses:publicCourses,strategies:publicStrategies,learningPaths,membershipPlans,successStories},{headers:{"cache-control":"public, max-age=300, stale-while-revalidate=3600"}})}
