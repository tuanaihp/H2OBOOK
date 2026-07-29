import type { CSSProperties } from "react";
import type { NeuralSurfacePreset } from "@/lib/global-neural/types";
const nodes=[[8,18],[18,72],[28,35],[39,83],[50,20],[61,60],[73,31],[84,76],[93,16],[96,51]];
export function NeuralAmbientLayer({preset}:{preset:NeuralSurfacePreset}){
  if(!preset.showAmbient)return null;
  return <div className="h2o-neural-ambient" aria-hidden="true" style={{"--h2o-motion-scale":preset.motionScale} as CSSProperties}>
    <div className="h2o-neural-aurora"/>
    <svg className="h2o-neural-network" viewBox="0 0 100 100" preserveAspectRatio="none"><g className="h2o-neural-lines"><path d="M8 18 28 35 50 20 73 31 93 16"/><path d="M18 72 39 83 61 60 84 76 96 51"/><path d="M28 35 39 83M50 20 61 60M73 31 84 76"/></g><g className="h2o-neural-nodes">{nodes.map(([cx,cy],i)=><circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={i%3===0?.7:.45}/>)}</g></svg>
    <span className="h2o-neural-data-stream stream-a"/><span className="h2o-neural-data-stream stream-b"/><span className="h2o-neural-data-stream stream-c"/>
  </div>;
}
