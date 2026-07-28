"use client";import {installAnalyticsFlush} from "@/lib/analytics/client";import {useEffect} from "react";export function AnalyticsProvider(){useEffect(()=>installAnalyticsFlush(),[]);return null;}
