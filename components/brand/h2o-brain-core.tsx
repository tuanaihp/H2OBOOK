import type { CSSProperties } from "react";
import styles from "./h2o-brain-core.module.css";

// The single H₂ sphere used across the product. Before this existed the real design lived only
// inside the Knowledge Universe hero, and four other screens each carried their own gradient
// circle that had drifted away from it — different palette, different rings, no brain glyph. Any
// new placement should render this rather than hand-rolling a fifth one.

export interface H2OBrainCoreProps {
  /** Diameter. A number is px; a string can be any CSS length, e.g. "min(320px,34vw)". */
  size?: number | string;
  /** Small uppercase line under the H₂, e.g. a stage name or a stat. Omit for a bare sphere. */
  label?: string;
  /** Orbiting rings. Turn off where the surrounding card is too tight for them to clear. */
  rings?: boolean;
  /** The expanding pulse ring. Follows `rings` unless set explicitly. */
  pulse?: boolean;
  className?: string;
  /** Supplying this renders a real <button>; without it the sphere is inert decoration. */
  onClick?: () => void;
  ariaLabel?: string;
}

function NeuralBrainGlyph() {
  return (
    <svg className={styles.glyph} viewBox="0 0 160 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d="M78 19C58 8 35 21 35 43c-14 5-20 22-12 34 4 7 12 11 20 11 3 16 21 24 35 14V19Z" />
      <path d="M82 19c20-11 43 2 43 24 14 5 20 22 12 34-4 7-12 11-20 11-3 16-21 24-35 14V19Z" />
      <path d="M45 41c12 2 18 10 20 21M34 69c14-3 24 1 31 12M114 41c-12 2-18 10-20 21M126 69c-14-3-24 1-31 12M80 25v70" />
      <circle cx="45" cy="41" r="3" /><circle cx="65" cy="62" r="3" /><circle cx="34" cy="69" r="3" />
      <circle cx="114" cy="41" r="3" /><circle cx="94" cy="62" r="3" /><circle cx="126" cy="69" r="3" />
    </svg>
  );
}

export function H2OBrainCore({ size, label, rings = true, pulse, className = "", onClick, ariaLabel }: H2OBrainCoreProps) {
  // Left undefined when no size is given so the stylesheet's own default applies, rather than
  // stamping an inline value that callers would then have to fight.
  const style = size === undefined ? undefined : { "--h2o-core-size": typeof size === "number" ? `${size}px` : size } as CSSProperties;
  const showPulse = pulse ?? rings;
  const body = <>
    {rings && <>
      <span className={styles.ringOne} aria-hidden="true" />
      <span className={styles.ringTwo} aria-hidden="true" />
      <span className={styles.ringThree} aria-hidden="true" />
    </>}
    <NeuralBrainGlyph />
    <strong className={styles.mark}>H₂</strong>
    {label && <small className={styles.label}>{label}</small>}
    {showPulse && <i className={styles.pulse} aria-hidden="true" />}
  </>;

  if (onClick) {
    return <button type="button" className={`${styles.core} ${styles.interactive} ${className}`} style={style} onClick={onClick} aria-label={ariaLabel}>{body}</button>;
  }
  return <div className={`${styles.core} ${className}`} style={style} aria-hidden={ariaLabel ? undefined : true} aria-label={ariaLabel} role={ariaLabel ? "img" : undefined}>{body}</div>;
}
