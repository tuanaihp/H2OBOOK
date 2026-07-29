import type { NeuralSurface } from "./types";
const startsWithAny = (pathname:string, prefixes:string[]) => prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
export function resolveNeuralSurface(pathname:string): NeuralSurface {
  if (startsWithAny(pathname,["/login","/signup","/auth","/forgot-password"])) return "auth";
  if (startsWithAny(pathname,["/student"])) return "student";
  if (startsWithAny(pathname,["/editor","/design-library","/templates","/brand-kit","/assets","/blocks"])) return "creative";
  if (startsWithAny(pathname,["/reader","/embed"])) return "reader";
  if (startsWithAny(pathname,["/portal"])) return "portal";
  if (pathname === "/" || startsWithAny(pathname,["/academy"])) return "public";
  return "workspace";
}
