export type NeuralSurface = "public" | "student" | "workspace" | "creative" | "reader" | "auth" | "portal";
export type NeuralIntensity = "immersive" | "balanced" | "subtle" | "focus";
export interface NeuralSurfacePreset {
  surface: NeuralSurface;
  intensity: NeuralIntensity;
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
  secondary: string;
  showAmbient: boolean;
  showHeaderSignal: boolean;
  motionScale: number;
}
