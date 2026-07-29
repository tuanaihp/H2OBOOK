"use client";
import {useEffect,useMemo} from "react";
import {usePathname} from "next/navigation";
import {resolveNeuralSurface} from "@/lib/global-neural/routes";
import {NEURAL_SURFACE_PRESETS} from "@/lib/global-neural/presets";
import {isGlobalNeuralDesignEnabled,isGlobalNeuralMotionEnabled} from "@/lib/global-neural/feature";
import {NeuralAmbientLayer} from "./neural-ambient-layer";
export function NeuralRouteTheme(){
  const pathname=usePathname();const enabled=isGlobalNeuralDesignEnabled();const surface=useMemo(()=>resolveNeuralSurface(pathname),[pathname]);const preset=NEURAL_SURFACE_PRESETS[surface];
  useEffect(()=>{const root=document.documentElement;const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;root.dataset.h2oNeural=enabled?"on":"off";root.dataset.h2oSurface=surface;root.dataset.h2oNeuralIntensity=preset.intensity;root.dataset.h2oNeuralMotion=!isGlobalNeuralMotionEnabled()||reduced?"reduced":"full";root.style.setProperty("--h2o-neural-accent",preset.accent);root.style.setProperty("--h2o-neural-secondary",preset.secondary);return()=>{delete root.dataset.h2oSurface;delete root.dataset.h2oNeuralIntensity;root.style.removeProperty("--h2o-neural-accent");root.style.removeProperty("--h2o-neural-secondary");};},[enabled,preset,surface]);
  if(!enabled)return null;return <NeuralAmbientLayer preset={preset}/>;
}
