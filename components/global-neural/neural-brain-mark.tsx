import type { CSSProperties } from "react";
export function NeuralBrainMark({size=30,title="H2O Neural Core"}:{size?:number;title?:string}){
  const style={"--h2o-neural-mark-size":`${size}px`} as CSSProperties;
  return <span className="h2o-neural-brain-mark" style={style} role="img" aria-label={title}>
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="h2o-brain-gradient" x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#43d9e8"/><stop offset=".52" stopColor="#758ff5"/><stop offset="1" stopColor="#a56ae9"/></linearGradient>
        <filter id="h2o-brain-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="2.4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path d="M31 12c-7-6-17-1-16 8-7 2-8 12-2 16-4 8 4 16 12 13 2 5 8 6 12 2V15c-1-3-3-4-6-3Z" fill="none" stroke="url(#h2o-brain-gradient)" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M33 12c7-6 17-1 16 8 7 2 8 12 2 16 4 8-4 16-12 13-2 5-8 6-12 2V15c1-3 3-4 6-3Z" fill="none" stroke="url(#h2o-brain-gradient)" strokeWidth="2.4" strokeLinecap="round"/>
      <g fill="#55dbe5" filter="url(#h2o-brain-glow)"><circle cx="20" cy="25" r="2"/><circle cx="25" cy="40" r="2"/><circle cx="44" cy="24" r="2"/><circle cx="42" cy="41" r="2"/><circle cx="32" cy="31" r="2.2"/></g>
      <g stroke="url(#h2o-brain-gradient)" strokeWidth="1.5" opacity=".9"><path d="m20 25 12 6 12-7M25 40l7-9 10 10M20 25l5 15M44 24l-2 17"/></g>
      <path d="M22 52c5-3 15-3 20 0M25 56c4-2 10-2 14 0" fill="none" stroke="url(#h2o-brain-gradient)" strokeWidth="1.6" strokeLinecap="round" opacity=".8"/>
      <circle cx="32" cy="31" r="7.2" fill="#101a2d" stroke="url(#h2o-brain-gradient)" strokeWidth="1.4"/><text x="32" y="34" textAnchor="middle" fill="white" fontSize="7.5" fontWeight="800">H₂</text>
    </svg>
  </span>;
}
