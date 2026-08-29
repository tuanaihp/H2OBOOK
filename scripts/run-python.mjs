import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Windows commonly provides `python` or the Python launcher (`py`), while Linux
// CI images conventionally expose `python3`. Keep the Python validation scripts
// runnable in both environments without masking a failure from the script itself.
const candidates = process.platform === "win32"
  ? ["python", "py", "python3"]
  : ["python3", "python"];

export function runPython(script, args = [], options = {}) {
  for (const command of candidates) {
    const result = spawnSync(command, [script, ...args], options);
    if (result.error?.code === "ENOENT") continue;
    return result;
  }
  return {
    status: 127,
    stderr: "Python 3 was not found. Install Python 3 and ensure `python3`, `python`, or `py` is on PATH."
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [script, ...args] = process.argv.slice(2);
  if (!script) {
    console.error("Usage: node scripts/run-python.mjs <script.py> [...args]");
    process.exit(2);
  }

  const result = runPython(script, args, { stdio: "inherit" });
  process.exit(result.status ?? 1);
}
