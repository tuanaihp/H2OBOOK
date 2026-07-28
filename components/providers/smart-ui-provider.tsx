"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/app-store";

export function SmartUIProvider() {
  const settings = useAppStore((state) => state.smartSettings);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("reduce-motion", settings.reduceMotion);
    root.classList.toggle("high-contrast", settings.highContrast);
    root.classList.toggle("focus-mode", settings.focusMode);
    root.dataset.assistMode = settings.aiEnabled ? settings.assistMode : "off";
  }, [settings]);
  return null;
}
