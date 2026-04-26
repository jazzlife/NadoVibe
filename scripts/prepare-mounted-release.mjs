#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { relative, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync, execSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const sourceRoot = resolve(String(args.source ?? "."));
const runtimeRoot = resolve(String(args["runtime-root"] ?? "/data/docker_data/nadovibe/runtime"));
const releasesDir = resolve(String(args["releases-dir"] ?? join(runtimeRoot, "releases")));
const currentDir = resolve(String(args["current-dir"] ?? join(runtimeRoot, "current")));
const packageJson = JSON.parse(readFileSync(join(sourceRoot, "package.json"), "utf8"));
const gitSha = String(args["git-sha"] ?? readGitSha(sourceRoot));
const releaseId = String(args["release-id"] ?? `${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "")}-${gitSha.slice(0, 7)}`);
const releaseDir = join(releasesDir, releaseId);
const installRuntimeDependencies = args["install-runtime-deps"] === true;
const runtimeInstallImage = String(args["runtime-install-image"] ?? "node:22-alpine");

if (!existsSync(join(sourceRoot, "packages/core-operations/dist/index.js"))) {
  throw new Error("packages/core-operations/dist/index.js is missing. Run `npm run build` before preparing a mounted release.");
}
if (!existsSync(join(sourceRoot, "node_modules"))) {
  throw new Error("node_modules is missing. Run `npm install` before preparing a mounted release.");
}

const operations = await import(pathToFileURL(join(sourceRoot, "packages/core-operations/dist/index.js")).href);
const manifest = operations.createMountedReleaseManifest({
  releaseId,
  gitSha,
  sourceRoot: releaseDir,
  envProfile: String(args.profile ?? "production"),
  platformVersion: String(args.version ?? packageJson.version ?? "0.1.0"),
  preparedAt: new Date(),
  nodeVersion: "22"
});
const validation = operations.validateMountedReleaseManifest(manifest);
if (!validation.ok) {
  throw new Error(`release manifest is invalid: ${validation.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ")}`);
}

rmSync(releaseDir, { recursive: true, force: true });
mkdirSync(releaseDir, { recursive: true });

const releaseEntries = ["package.json", "package-lock.json", "tsconfig.json", "tsconfig.base.json", "apps", "packages", "services", "infra"];
if (!installRuntimeDependencies) {
  releaseEntries.push("node_modules");
}

for (const entry of releaseEntries) {
  const source = join(sourceRoot, entry);
  if (!existsSync(source)) continue;
  cpSync(source, join(releaseDir, entry), { recursive: true, dereference: false, filter: copyFilter });
}

if (installRuntimeDependencies) {
  const installOutput = execFileSync("docker", ["run", "--rm", "-v", `${releaseDir}:/app`, "-w", "/app", runtimeInstallImage, "npm", "ci"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"]
  });
  process.stderr.write(installOutput);
}

repairWorkspaceSymlinks(releaseDir);
writeFileSync(join(releaseDir, "nadovibe.release.json"), JSON.stringify(manifest, null, 2) + "\n");

if (args.activate === true) {
  replaceDirectoryContents(releaseDir, currentDir);
  repairWorkspaceSymlinks(currentDir);
}

process.stdout.write(JSON.stringify({ ok: true, releaseId, releaseDir, currentDir: args.activate === true ? currentDir : undefined }, null, 2) + "\n");

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (next === undefined || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function readGitSha(cwd) {
  try {
    return execSync("git rev-parse --short=12 HEAD", { cwd, encoding: "utf8" }).trim();
  } catch {
    throw new Error("git sha is required. Run inside a git repository or pass --git-sha.");
  }
}

function copyFilter(source) {
  const name = source.split(/[\\/]/).at(-1) ?? "";
  if (name === ".git" || name === ".DS_Store" || name.endsWith(".tsbuildinfo")) {
    return false;
  }
  if (source.includes(`${"reports"}${"/"}artifacts`) || source.includes(`${"reports"}${"\\/"}artifacts`)) {
    return false;
  }
  return true;
}

function repairWorkspaceSymlinks(root) {
  const scopeDir = join(root, "node_modules", "@nadovibe");
  rmSync(scopeDir, { recursive: true, force: true });
  mkdirSync(scopeDir, { recursive: true });
  for (const workspaceRoot of ["packages", "services", "apps"]) {
    const dir = join(root, workspaceRoot);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const packageJsonPath = join(dir, entry.name, "package.json");
      if (!existsSync(packageJsonPath)) continue;
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
      if (typeof packageJson.name !== "string" || !packageJson.name.startsWith("@nadovibe/")) continue;
      const name = packageJson.name.slice("@nadovibe/".length);
      const target = join(dir, entry.name);
      symlinkSync(relative(scopeDir, target), join(scopeDir, name), "dir");
    }
  }
}

function replaceDirectoryContents(sourceDir, targetDir) {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
    rmSync(join(targetDir, entry.name), { recursive: true, force: true });
  }
  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    cpSync(join(sourceDir, entry.name), join(targetDir, entry.name), { recursive: true, dereference: false });
  }
}
