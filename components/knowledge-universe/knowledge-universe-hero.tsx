"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bot,
  BrainCircuit,
  Compass,
  Database,
  FileUp,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  Network,
  Palette,
  Pause,
  Play,
  Send,
  Sparkles,
  Wand2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { knowledgeUniverseNodes, knowledgeUniverseStages } from "@/lib/knowledge-universe/data";
import type { KnowledgeUniverseIcon, KnowledgeUniverseNode } from "@/lib/knowledge-universe/types";
import styles from "./knowledge-universe-hero.module.css";

const iconMap: Record<KnowledgeUniverseIcon, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  books: BookOpen,
  courses: GraduationCap,
  strategy: LineChart,
  roadmap: Compass,
  student: LayoutDashboard,
  mentor: Bot,
  design: Palette,
  studio: Wand2,
  input: FileUp,
  publish: Send,
};

const accessLabel: Record<KnowledgeUniverseNode["access"], string> = {
  public: "Truy cập công khai",
  student: "Không gian học viên",
  workspace: "Không gian vận hành",
};

export interface KnowledgeUniverseHeroProps {
  className?: string;
  autoPlay?: boolean;
}

export function KnowledgeUniverseHero({ className = "", autoPlay = true }: KnowledgeUniverseHeroProps) {
  const [activeNodeId, setActiveNodeId] = useState(knowledgeUniverseNodes[0].id);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [motionEnabled, setMotionEnabled] = useState(autoPlay);
  const [isInteracting, setIsInteracting] = useState(false);

  const activeNode = useMemo(
    () => knowledgeUniverseNodes.find((node) => node.id === activeNodeId) ?? knowledgeUniverseNodes[0],
    [activeNodeId],
  );
  const activeStage = knowledgeUniverseStages[activeStageIndex];

  useEffect(() => {
    if (!motionEnabled || isInteracting) return;
    const timer = window.setInterval(() => {
      setActiveStageIndex((value) => (value + 1) % knowledgeUniverseStages.length);
    }, 4600);
    return () => window.clearInterval(timer);
  }, [isInteracting, motionEnabled]);

  useEffect(() => {
    if (!motionEnabled || isInteracting) return;
    const timer = window.setInterval(() => {
      setActiveNodeId((currentId) => {
        const index = knowledgeUniverseNodes.findIndex((node) => node.id === currentId);
        return knowledgeUniverseNodes[(index + 1) % knowledgeUniverseNodes.length].id;
      });
    }, 6200);
    return () => window.clearInterval(timer);
  }, [isInteracting, motionEnabled]);

  return (
    <section
      className={`${styles.hero} ${className}`}
      aria-labelledby="h2o-knowledge-universe-title"
      onMouseEnter={() => setIsInteracting(true)}
      onMouseLeave={() => setIsInteracting(false)}
      onFocusCapture={() => setIsInteracting(true)}
      onBlurCapture={() => setIsInteracting(false)}
    >
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.auroraOne} />
        <span className={styles.auroraTwo} />
        <span className={styles.starField} />
      </div>

      <div className={styles.container}>
        <div className={styles.copyColumn}>
          <div className={styles.liveBadge}>
            <BrainCircuit size={15} />
            <span>H2O NEURAL KNOWLEDGE UNIVERSE</span>
            <i aria-hidden="true" />
          </div>

          <h1 id="h2o-knowledge-universe-title">
            Một <em>bộ não tri thức</em> kết nối toàn bộ hành trình nghề Makeup.
          </h1>
          <p>
            H2O Brain thu nhận sách, khóa học, bài thực hành và dữ liệu nghề; sau đó kết nối chúng thành
            Skill Map, lộ trình học và bước hành động tiếp theo cho từng học viên.
          </p>

          <div className={styles.actions}>
            <Link href="/academy/learning-paths" className={styles.primaryAction}>
              Khám phá vũ trụ tri thức <ArrowRight size={17} />
            </Link>
            <Link href="/academy/books" className={styles.secondaryAction}>
              <BookOpen size={17} /> Xem nguồn kiến thức
            </Link>
          </div>

          <div className={styles.systemMetrics} aria-label="Trạng thái hệ thống mô phỏng">
            <article>
              <Database size={16} />
              <div><strong>126</strong><span>Nguồn đã nạp</span></div>
            </article>
            <article>
              <Network size={16} />
              <div><strong>1.842</strong><span>Liên kết tri thức</span></div>
            </article>
            <article>
              <Sparkles size={16} />
              <div><strong>184</strong><span>Learning Twin</span></div>
            </article>
          </div>

          <div className={styles.stageControl}>
            <div className={styles.stageHead}>
              <div>
                <small>{activeStage.index} · {activeStage.label}</small>
                <strong>{activeStage.title}</strong>
              </div>
              <button
                type="button"
                className={styles.motionButton}
                aria-pressed={!motionEnabled}
                aria-label={motionEnabled ? "Tạm dừng chuyển động" : "Bật chuyển động"}
                onClick={() => setMotionEnabled((value) => !value)}
              >
                {motionEnabled ? <Pause size={15} /> : <Play size={15} />}
              </button>
            </div>
            <p>{activeStage.description}</p>
            <div className={styles.stageProgress}>
              <span><i style={{ width: `${activeStage.progress}%` }} /></span>
              <small>{activeStage.status}</small>
            </div>
            <div className={styles.stageTabs} role="tablist" aria-label="Chu trình H2O Brain">
              {knowledgeUniverseStages.map((stage, index) => (
                <button
                  key={stage.id}
                  type="button"
                  role="tab"
                  aria-selected={index === activeStageIndex}
                  className={index === activeStageIndex ? styles.stageTabActive : ""}
                  onClick={() => setActiveStageIndex(index)}
                >
                  {stage.index}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.visualColumn}>
          <div className={`${styles.universe} ${motionEnabled ? "" : styles.paused}`}>
            <div className={styles.gridPlane} aria-hidden="true" />
            <div className={styles.energyHalo} aria-hidden="true" />

            {[1, 2, 3].map((orbit) => (
              <div key={orbit} className={`${styles.orbit} ${styles[`orbit${orbit}`]}`} aria-hidden="true">
                <span /><span /><span />
              </div>
            ))}

            <svg className={styles.connectionField} viewBox="0 0 720 720" aria-hidden="true">
              <defs>
                <radialGradient id="h2o-core-beam" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#63f1ff" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="#8f7cf7" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#8f7cf7" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="360" cy="360" r="116" fill="url(#h2o-core-beam)" opacity="0.24" />
              {Array.from({ length: 12 }).map((_, index) => {
                const angle = (Math.PI * 2 * index) / 12;
                // Math.sin/Math.cos are not required to be correctly rounded, so Node and the
                // browser can disagree in the last ULP (e.g. ...143504 vs ...143506) and React
                // reports a hydration mismatch. Rounding to 3dp makes both sides emit the same
                // string; the visual difference is far below one device pixel.
                const round = (value: number) => Math.round(value * 1000) / 1000;
                const x = round(360 + Math.cos(angle) * 285);
                const y = round(360 + Math.sin(angle) * 285);
                return <line key={index} x1="360" y1="360" x2={x} y2={y} />;
              })}
            </svg>

            {knowledgeUniverseNodes.map((node) => {
              const Icon = iconMap[node.icon];
              const style = {
                "--planet-angle": `${node.angle}deg`,
                "--planet-angle-negative": `${-node.angle}deg`,
                "--planet-color": node.color,
              } as CSSProperties;
              return (
                <div key={node.id} className={`${styles.planetOrbitWrapper} ${styles[`planetOrbit${node.orbit}`]}`}>
                  <div className={styles.planetAnchor} style={style}>
                    <Link
                      href={node.href}
                      className={styles.planet}
                      onMouseEnter={() => setActiveNodeId(node.id)}
                      onFocus={() => setActiveNodeId(node.id)}
                      aria-label={`${node.label}. ${accessLabel[node.access]}`}
                    >
                      <span className={`${styles.planetFace} ${node.id === activeNodeId ? styles.planetActive : ""}`}>
                        <span className={styles.planetIcon}><Icon size={18} strokeWidth={1.9} /></span>
                        <span className={styles.planetText}>{node.shortLabel}</span>
                        <i aria-hidden="true" />
                      </span>
                    </Link>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              className={styles.core}
              onClick={() => setActiveStageIndex((value) => (value + 1) % knowledgeUniverseStages.length)}
              aria-label="Chuyển trạng thái hoạt động của H2O Brain"
            >
              <span className={styles.coreRingOne} aria-hidden="true" />
              <span className={styles.coreRingTwo} aria-hidden="true" />
              <span className={styles.coreRingThree} aria-hidden="true" />
              <NeuralBrainGlyph />
              <strong>H₂</strong>
              <small>{activeStage.label}</small>
              <i className={styles.corePulse} aria-hidden="true" />
            </button>

            <div className={styles.coreCaption}>
              <span><Sparkles size={13} /> H2O Brain AI</span>
              <small>Local-first · AI bên ngoài tùy chọn</small>
            </div>
          </div>

          <aside className={styles.nodeDetail} aria-live="polite">
            <header>
              <span style={{ background: activeNode.color }}><NodeIcon node={activeNode} /></span>
              <div><small>{activeNode.eyebrow}</small><h2>{activeNode.label}</h2></div>
              <b>{accessLabel[activeNode.access]}</b>
            </header>
            <p>{activeNode.description}</p>
            <strong className={styles.output}>{activeNode.output}</strong>
            <div className={styles.nodeMetrics}>
              {activeNode.metrics.map((metric) => <span key={metric.label}><b>{metric.value}</b><small>{metric.label}</small></span>)}
            </div>
            <Link href={activeNode.href}>Mở chức năng <ArrowRight size={15} /></Link>
          </aside>

          <div className={styles.mobilePlanetRail} aria-label="Các hành tinh tri thức">
            {knowledgeUniverseNodes.map((node) => {
              const Icon = iconMap[node.icon];
              return (
                <button
                  key={node.id}
                  type="button"
                  className={node.id === activeNodeId ? styles.mobilePlanetActive : ""}
                  onClick={() => setActiveNodeId(node.id)}
                >
                  <span style={{ background: node.color }}><Icon size={15} /></span>{node.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.orbitLegend}>
        <span><i className={styles.legendOne} />Quỹ đạo tri thức công khai</span>
        <span><i className={styles.legendTwo} />Quỹ đạo học tập cá nhân</span>
        <span><i className={styles.legendThree} />Quỹ đạo sáng tạo và vận hành</span>
      </div>
    </section>
  );
}

function NodeIcon({ node }: { node: KnowledgeUniverseNode }) {
  const Icon = iconMap[node.icon];
  return <Icon size={18} strokeWidth={1.9} />;
}

function NeuralBrainGlyph() {
  return (
    <svg className={styles.brainGlyph} viewBox="0 0 160 120" aria-hidden="true">
      <path d="M78 19C58 8 35 21 35 43c-14 5-20 22-12 34 4 7 12 11 20 11 3 16 21 24 35 14V19Z" />
      <path d="M82 19c20-11 43 2 43 24 14 5 20 22 12 34-4 7-12 11-20 11-3 16-21 24-35 14V19Z" />
      <path d="M45 41c12 2 18 10 20 21M34 69c14-3 24 1 31 12M114 41c-12 2-18 10-20 21M126 69c-14-3-24 1-31 12M80 25v70" />
      <circle cx="45" cy="41" r="3" /><circle cx="65" cy="62" r="3" /><circle cx="34" cy="69" r="3" />
      <circle cx="114" cy="41" r="3" /><circle cx="94" cy="62" r="3" /><circle cx="126" cy="69" r="3" />
    </svg>
  );
}
