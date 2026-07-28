export async function loadTypeScript() {
  try {
    const module = await import("typescript");
    return module.default ?? module;
  } catch {
    const fallback = process.env.H2OBOOK_TYPESCRIPT_PATH || "/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js";
    const module = await import(fallback);
    return module.default ?? module;
  }
}
