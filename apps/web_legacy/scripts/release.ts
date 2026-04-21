#!/usr/bin/env bun
/**
 * Automated release script for surety.
 *
 * Bumps version in root package.json, syncs lockfile, generates CHANGELOG
 * entries from conventional commits, commits, tags, pushes, and creates
 * a GitHub release.
 *
 * Usage:
 *   bun run release              # patch bump (default)
 *   bun run release -- minor     # minor bump
 *   bun run release -- major     # major bump
 *   bun run release -- 2.0.0     # explicit version
 *   bun run release -- --dry-run # preview without side effects
 *
 * Env:
 *   Requires `gh` CLI authenticated for GitHub release creation.
 *
 * Adapted from pew/scripts/release.ts for single-package use.
 */

import { spawn } from "child_process";
import { resolve as pathResolve } from "path";
import { readFileSync, writeFileSync } from "fs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = pathResolve(import.meta.dirname as string, "../../..");
const PACKAGE_JSON = pathResolve(PROJECT_ROOT, "package.json");
const CHANGELOG_MD = pathResolve(PROJECT_ROOT, "CHANGELOG.md");

const BUMP_TYPES = ["patch", "minor", "major"] as const;
type BumpType = (typeof BUMP_TYPES)[number];

interface Commit {
  hash: string;
  subject: string;
}

interface ChangelogSections {
  added: string[];
  changed: string[];
  fixed: string[];
  removed: string[];
}

const COMMIT_TYPE_MAP: Record<string, keyof ChangelogSections> = {
  feat: "added",
  fix: "fixed",
  refactor: "changed",
  chore: "changed",
  docs: "changed",
  test: "changed",
  perf: "changed",
  style: "changed",
  ci: "changed",
  build: "changed",
};

const REMOVED_KEYWORDS = /\b(remove|delete|drop)\b/i;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const CONVENTIONAL_RE = /^(\w+)(?:\(.+?\))?!?:\s*(.+)$/;

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function run(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; inherit?: boolean },
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd: opts?.cwd ?? PROJECT_ROOT,
      stdio: opts?.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    if (!opts?.inherit) {
      child.stdout?.on("data", (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on("data", (d: Buffer) => {
        stderr += d.toString();
      });
    }

    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function runOrDie(
  cmd: string,
  args: string[],
  errorMsg: string,
): Promise<string> {
  const result = await run(cmd, args);
  if (result.code !== 0) {
    console.error(`❌ ${errorMsg}`);
    if (result.stderr.trim()) {
      console.error(result.stderr.trim());
    }
    process.exit(1);
  }
  return result.stdout.trim();
}

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

function parseSemver(version: string): [number, number, number] {
  if (!SEMVER_RE.test(version)) {
    console.error(`❌ Invalid semver: "${version}"`);
    process.exit(1);
  }
  return version.split(".").map(Number) as [number, number, number];
}

function compareSemver(a: string, b: string): number {
  const [a0, a1, a2] = parseSemver(a);
  const [b0, b1, b2] = parseSemver(b);
  if (a0 !== b0) return a0 - b0;
  if (a1 !== b1) return a1 - b1;
  return a2 - b2;
}

function bumpVersion(current: string, bumpArg: string): string {
  if (SEMVER_RE.test(bumpArg)) {
    if (compareSemver(bumpArg, current) <= 0) {
      console.error(
        `❌ Explicit version ${bumpArg} must be greater than current ${current}`,
      );
      process.exit(1);
    }
    return bumpArg;
  }

  if (!BUMP_TYPES.includes(bumpArg as BumpType)) {
    console.error(`❌ Invalid bump type: "${bumpArg}"`);
    console.error("   Use: patch | minor | major | x.y.z");
    process.exit(1);
  }

  const [major, minor, patch] = parseSemver(current);
  switch (bumpArg as BumpType) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

function readCurrentVersion(): string {
  const raw = readFileSync(PACKAGE_JSON, "utf-8");
  const pkg = JSON.parse(raw);
  return pkg.version;
}

function updatePackageVersion(oldVersion: string, newVersion: string): void {
  const content = readFileSync(PACKAGE_JSON, "utf-8");
  const pattern = `"version": "${oldVersion}"`;
  const replacement = `"version": "${newVersion}"`;
  if (!content.includes(pattern)) {
    console.error(`❌ Version pattern not found in package.json: ${pattern}`);
    process.exit(1);
  }
  writeFileSync(PACKAGE_JSON, content.replace(pattern, replacement), "utf-8");
  console.log("  ✓ package.json");
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

async function getLastTag(): Promise<string | undefined> {
  const result = await run("git", ["describe", "--tags", "--abbrev=0"]);
  if (result.code !== 0) return undefined;
  return result.stdout.trim();
}

async function getCommitsSinceTag(
  tag: string | undefined,
): Promise<Commit[]> {
  const range = tag ? `${tag}..HEAD` : "HEAD";
  const args = ["log", range, "--format=%H|||%s"];
  const stdout = await runOrDie("git", args, "Failed to read git log");

  if (!stdout) return [];

  return stdout
    .split("\n")
    .filter((line) => line.includes("|||"))
    .map((line) => {
      const sepIdx = line.indexOf("|||");
      return {
        hash: line.slice(0, sepIdx),
        subject: line.slice(sepIdx + 3),
      };
    })
    .filter((c) => !c.subject.startsWith("release: v"));
}

// ---------------------------------------------------------------------------
// CHANGELOG helpers
// ---------------------------------------------------------------------------

function classifyCommits(commits: Commit[]): ChangelogSections {
  const sections: ChangelogSections = {
    added: [],
    changed: [],
    fixed: [],
    removed: [],
  };

  for (const commit of commits) {
    const { subject } = commit;

    // Skip merge commits
    if (subject.startsWith("Merge ")) continue;

    let description: string;
    let section: keyof ChangelogSections;

    const match = CONVENTIONAL_RE.exec(subject);
    if (match) {
      const type = (match[1] as string).toLowerCase();
      description = capitalizeFirst((match[2] as string).trim());
      section = COMMIT_TYPE_MAP[type] ?? "changed";
    } else {
      description = capitalizeFirst(subject.trim());
      section = "changed";
    }

    // Override: keywords indicating removal (only when type is ambiguous)
    if (REMOVED_KEYWORDS.test(subject) && section === "changed") {
      section = "removed";
    }

    if (!sections[section].includes(description)) {
      sections[section].push(description);
    }
  }

  return sections;
}

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatChangelogSection(
  version: string,
  sections: ChangelogSections,
): string {
  const lines: string[] = [`## v${version}`];

  const sectionOrder: [keyof ChangelogSections, string][] = [
    ["added", "Added"],
    ["changed", "Changed"],
    ["fixed", "Fixed"],
    ["removed", "Removed"],
  ];

  for (const [key, heading] of sectionOrder) {
    const items = sections[key];
    if (items.length > 0) {
      lines.push("");
      lines.push(`### ${heading}`);
      for (const item of items) {
        lines.push(`- ${item}`);
      }
    }
  }

  return lines.join("\n");
}

function updateChangelog(newSection: string): void {
  const content = readFileSync(CHANGELOG_MD, "utf-8");
  const marker = "## v";
  const idx = content.indexOf(marker);

  let updated: string;
  if (idx === -1) {
    // No existing entries — append after header
    updated = content.trimEnd() + "\n\n" + newSection + "\n";
  } else {
    updated =
      content.slice(0, idx) + newSection + "\n\n" + content.slice(idx);
  }

  writeFileSync(CHANGELOG_MD, updated);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // --- Parse args ---
  const rawArgs = process.argv.slice(2).filter((a) => a !== "--");
  const isDryRun = rawArgs.includes("--dry-run");
  const bumpArg = rawArgs.find((a) => a !== "--dry-run") ?? "patch";

  if (isDryRun) {
    console.log("🏜️  Dry-run mode — no changes will be made\n");
  }

  // --- Phase 0: Preflight ---
  console.log("📋 Preflight checks...\n");

  // Clean working tree
  const status = await runOrDie(
    "git",
    ["status", "--porcelain"],
    "Failed to check git status",
  );
  if (status) {
    console.error(
      "❌ Working tree is not clean. Commit or stash changes first.",
    );
    console.error(status);
    process.exit(1);
  }

  // On a branch
  const branch = await runOrDie(
    "git",
    ["symbolic-ref", "--short", "HEAD"],
    "Detached HEAD — checkout a branch first",
  );

  // gh auth
  const ghResult = await run("gh", ["auth", "status"]);
  const ghAuthed = ghResult.code === 0;
  if (!ghAuthed) {
    console.log("⚠️  gh CLI not authenticated — will skip GitHub release");
  }

  // Current version & bump
  const currentVersion = readCurrentVersion();
  const newVersion = bumpVersion(currentVersion, bumpArg);
  const lastTag = await getLastTag();

  console.log("📦 surety release");
  console.log(`   Current version: ${currentVersion}`);
  console.log(`   New version:     ${newVersion}`);
  console.log(`   Bump type:       ${bumpArg}`);
  console.log(`   Branch:          ${branch}`);
  console.log(`   Last tag:        ${lastTag ?? "(none)"}`);
  console.log("");

  // --- Phase 1: Version bump ---
  console.log("📝 Phase 1: Updating version in package.json...\n");

  if (isDryRun) {
    console.log(
      `   [dry-run] Would update package.json: ${currentVersion} → ${newVersion}`,
    );
    console.log("   [dry-run] Would run bun install to sync lockfile");
  } else {
    updatePackageVersion(currentVersion, newVersion);
    console.log(
      `\n   ✅ Version updated: ${currentVersion} → ${newVersion}`,
    );

    console.log("   🔄 Running bun install to sync lockfile...");
    const installResult = await run("bun", ["install"], { inherit: true });
    if (installResult.code !== 0) {
      console.error("❌ bun install failed");
      process.exit(1);
    }
    console.log("   ✅ Lockfile synced");
  }
  console.log("");

  // --- Phase 2: CHANGELOG ---
  console.log("📝 Phase 2: Generating CHANGELOG...\n");

  const commits = await getCommitsSinceTag(lastTag);
  if (commits.length === 0) {
    console.log(
      "   ⚠️  No commits since last tag — CHANGELOG section will be empty",
    );
  }

  const sections = classifyCommits(commits);
  const changelogSection = formatChangelogSection(newVersion, sections);

  console.log("   --- Generated CHANGELOG section ---");
  console.log(changelogSection);
  console.log("   --- End ---\n");

  if (isDryRun) {
    console.log(
      "   [dry-run] Would prepend above section to CHANGELOG.md",
    );
  } else {
    updateChangelog(changelogSection);
    console.log("   ✅ CHANGELOG.md updated");
  }
  console.log("");

  // --- Phase 3: Commit ---
  console.log("💾 Phase 3: Committing...\n");

  const filesToStage = ["package.json", "bun.lock", "CHANGELOG.md"];

  if (isDryRun) {
    console.log(
      `   [dry-run] Would commit: release: v${newVersion}`,
    );
    console.log(`   [dry-run] Files: ${filesToStage.join(", ")}`);
  } else {
    await runOrDie("git", ["add", ...filesToStage], "Failed to stage files");
    const commitResult = await run("git", [
      "commit",
      "-m",
      `release: v${newVersion}`,
    ]);
    if (commitResult.code !== 0) {
      console.error("❌ Commit failed (pre-commit hooks?)");
      if (commitResult.stderr.trim()) {
        console.error(commitResult.stderr.trim());
      }
      console.error("   Fix the issues and retry.");
      process.exit(1);
    }
    console.log(`   ✅ Committed: release: v${newVersion}`);
  }
  console.log("");

  // --- Phase 4: Tag + Push + Release ---
  console.log("🚀 Phase 4: Tag, push & release\n");

  console.log("   The following actions will be performed:");
  console.log(`     • git tag -a v${newVersion} -m "v${newVersion}"`);
  console.log("     • git push");
  console.log("     • git push --tags");
  if (ghAuthed) {
    console.log(
      `     • gh release create v${newVersion} --title "v${newVersion}"`,
    );
  }
  console.log("");

  if (isDryRun) {
    console.log("   [dry-run] Would perform the above actions");
    console.log(`\n✅ Dry run complete for v${newVersion}`);
    process.exit(0);
  }

  // Tag
  console.log(`   🔄 Creating tag v${newVersion}...`);
  const tagResult = await run("git", [
    "tag",
    "-a",
    `v${newVersion}`,
    "-m",
    `v${newVersion}`,
  ]);
  if (tagResult.code !== 0) {
    console.error(`❌ Failed to create tag v${newVersion}`);
    if (tagResult.stderr.includes("already exists")) {
      console.error(
        `   Tag already exists. Delete with: git tag -d v${newVersion}`,
      );
    }
    process.exit(1);
  }
  console.log(`   ✅ Tag v${newVersion} created`);

  // Push
  console.log("   🔄 Pushing...");
  const pushResult = await run("git", ["push"], { inherit: true });
  if (pushResult.code !== 0) {
    console.error("❌ git push failed");
    console.error("   Recovery commands:");
    console.error("     git push");
    console.error("     git push --tags");
    console.error(
      `     gh release create v${newVersion} --title "v${newVersion}" --notes "..."`,
    );
    process.exit(1);
  }
  console.log("   ✅ Pushed");

  // Push tags
  console.log("   🔄 Pushing tags...");
  const pushTagResult = await run("git", ["push", "--tags"], {
    inherit: true,
  });
  if (pushTagResult.code !== 0) {
    console.error("❌ git push --tags failed");
    console.error("   Recovery: git push --tags");
    process.exit(1);
  }
  console.log(`   ✅ Tag v${newVersion} pushed`);

  // GitHub Release
  if (ghAuthed) {
    console.log(`   🔄 Creating GitHub release v${newVersion}...`);
    const releaseResult = await run("gh", [
      "release",
      "create",
      `v${newVersion}`,
      "--title",
      `v${newVersion}`,
      "--notes",
      changelogSection,
    ]);

    if (releaseResult.code !== 0) {
      console.error("⚠️  GitHub release creation failed (tag is pushed)");
      console.error(
        `   Create manually: gh release create v${newVersion} --title "v${newVersion}"`,
      );
    } else {
      const releaseUrl = releaseResult.stdout.trim();
      console.log("   ✅ GitHub release created");
      if (releaseUrl) {
        console.log(`   🔗 ${releaseUrl}`);
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`✅ Released v${newVersion}`);
  console.log(`   📋 Commit:  release: v${newVersion}`);
  console.log(`   🏷️  Tag:     v${newVersion}`);
  if (ghAuthed) {
    const repoUrl = await run("gh", [
      "repo",
      "view",
      "--json",
      "url",
      "-q",
      ".url",
    ]);
    const repo = repoUrl.stdout.trim();
    if (repo) {
      console.log(
        `   🔗 Release: ${repo}/releases/tag/v${newVersion}`,
      );
    }
  }
  console.log("=".repeat(50));
}

main().catch((err: unknown) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});
