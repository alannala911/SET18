import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../frontend");
const run = (command) => execSync(command, { cwd: frontend, stdio: "inherit" });

if (!existsSync(path.join(frontend, "node_modules"))) {
  run("npm install --include=dev");
}
run("npm run build");
