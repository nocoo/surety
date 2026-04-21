#!/usr/bin/env bun
/**
 * Coverage Check Script
 * 
 * Runs unit tests with coverage and fails if coverage falls below threshold.
 */

const THRESHOLD = 90; // Minimum line coverage percentage

async function main() {
  console.log("🧪 Running unit tests with coverage...\n");

  // Run tests with coverage (auto-discover, E2E excluded via bunfig.toml)
  const repoRoot = import.meta.dir + "/../../..";

  // Run web tests from apps/web (for @/* path resolution) then MCP tests
  const proc = Bun.spawn(
    [
      "bash", "-c",
      `cd "${repoRoot}/apps/web" && bun test src/__tests__ --coverage && cd "${repoRoot}" && bun test packages/mcp/__tests__ --coverage`,
    ],
    {
      stdout: "pipe",
      stderr: "pipe",
      cwd: repoRoot,
    }
  );

  const output = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  
  // Print output
  console.log(output);
  if (stderr) console.error(stderr);

  await proc.exited;

  // Combine stdout and stderr for parsing
  const fullOutput = output + stderr;

  // Parse coverage from output - look for "All files" line
  const lines = fullOutput.split("\n");
  const allFilesLine = lines.find(line => line.includes("All files"));
  
  if (!allFilesLine) {
    console.error("❌ Could not parse coverage output");
    process.exit(1);
  }

  // Parse line coverage percentage (3rd column after "All files")
  // Format: "All files                                |   90.77 |   95.61 |"
  const match = allFilesLine.match(/All files\s*\|\s*[\d.]+\s*\|\s*([\d.]+)\s*\|/);
  if (!match) {
    console.error("❌ Could not parse coverage percentage from:", allFilesLine);
    process.exit(1);
  }

  const lineCoverage = parseFloat(match[1] ?? "0");
  console.log(`\n📊 Line Coverage: ${lineCoverage.toFixed(2)}%`);
  console.log(`   Threshold: ${THRESHOLD}%`);

  if (lineCoverage < THRESHOLD) {
    console.error(`\n❌ Coverage ${lineCoverage.toFixed(2)}% is below threshold ${THRESHOLD}%`);
    process.exit(1);
  }

  console.log("\n✅ Coverage check passed!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
