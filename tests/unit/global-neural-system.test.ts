import {describe,expect,it} from "vitest";
import {resolveNeuralSurface} from "../../lib/global-neural/routes";
import {NEURAL_SURFACE_PRESETS} from "../../lib/global-neural/presets";
describe("global neural route resolver",()=>{
  it.each([["/","public"],["/academy/books","public"],["/student/courses","student"],["/dashboard","workspace"],["/store","workspace"],["/editor/book-1","creative"],["/design-library/beauty-authority","creative"],["/reader/book-1","reader"],["/login","auth"],["/portal/thuyh2o","portal"]])("maps %s to %s",(path,surface)=>expect(resolveNeuralSurface(path)).toBe(surface));
  it("defines all surface presets",()=>{for(const surface of ["public","student","workspace","creative","reader","auth","portal"] as const)expect(NEURAL_SURFACE_PRESETS[surface].surface).toBe(surface)});
});
