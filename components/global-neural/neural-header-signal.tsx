"use client";
import {usePathname} from "next/navigation";
import {NeuralBrainMark} from "./neural-brain-mark";
import {resolveNeuralSurface} from "@/lib/global-neural/routes";
import {NEURAL_SURFACE_PRESETS} from "@/lib/global-neural/presets";
import {isGlobalNeuralDesignEnabled} from "@/lib/global-neural/feature";
export function NeuralHeaderSignal({compact=false,className=""}:{compact?:boolean;className?:string}){
  const pathname=usePathname();
  if(!isGlobalNeuralDesignEnabled())return null;
  const preset=NEURAL_SURFACE_PRESETS[resolveNeuralSurface(pathname)];
  if(!preset.showHeaderSignal)return null;
  return <div className={`h2o-neural-header-signal ${compact?"is-compact":""} ${className}`.trim()} title={preset.description}><NeuralBrainMark size={compact?23:28}/><span><strong>{preset.shortLabel}</strong>{!compact&&<small>{preset.description}</small>}</span><i aria-label="Đang hoạt động"/></div>;
}
