import {Activity,Database,Network,Sparkles} from "lucide-react";
import {NeuralBrainMark} from "./neural-brain-mark";
export interface NeuralMetric{label:string;value:string}
export function NeuralPageIntelligence({eyebrow="H2O INTELLIGENCE",title,description,metrics=[]}:{eyebrow?:string;title:string;description?:string;metrics?:NeuralMetric[]}){
  const icons=[Database,Network,Activity,Sparkles];
  return <section className="h2o-neural-page-intelligence"><div className="h2o-neural-page-copy"><span>{eyebrow}</span><h1>{title}</h1>{description&&<p>{description}</p>}</div><div className="h2o-neural-page-core"><NeuralBrainMark size={56}/><div><strong>Neural Core</strong><small>Đang đồng bộ dữ liệu theo ngữ cảnh trang</small></div></div>{metrics.length>0&&<div className="h2o-neural-page-metrics">{metrics.map((m,i)=>{const Icon=icons[i%icons.length];return <article key={m.label}><Icon/><span><strong>{m.value}</strong><small>{m.label}</small></span></article>;})}</div>}</section>;
}
