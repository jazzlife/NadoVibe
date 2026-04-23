#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const output = resolve(process.argv[2] ?? "generated/app-server/schema.json");
const command = process.argv.includes("--typescript") ? ["codex", "app-server", "generate-ts"] : ["codex", "app-server", "generate-json-schema"];
const result = spawnSync(command[0], command.slice(1), { encoding: "utf8" });

if (result.status !== 0) {
  process.stderr.write(
    [
      "Failed to generate app-server schema with Codex CLI.",
      `Command: ${command.join(" ")}`,
      result.stderr.trim(),
      "Install or authenticate the Codex CLI before using a live generated schema artifact."
    ]
      .filter(Boolean)
      .join("\n") + "\n"
  );
  process.exit(result.status ?? 1);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, result.stdout);
process.stdout.write(`Wrote ${output}\n`);
