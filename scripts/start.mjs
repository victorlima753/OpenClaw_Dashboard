import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const command = existsSync("server.js")
  ? { bin: "node", args: ["server.js"] }
  : { bin: process.platform === "win32" ? "npx.cmd" : "npx", args: ["next", "start"] };

const child = spawn(command.bin, command.args, { stdio: "inherit", env: process.env });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
