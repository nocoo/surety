# Source-map security repair — 2026-10-06

## Atomic scope

Patch source-map-js 1.2.1 to the compatible 1.2.2 resolution for GHSA-68fv-2mgg-jv7q. Add one root override and preserve every other effective dependency version. Keep the numbered plan at docs/22-source-map-security.md.

The same coherent security commit also makes the existing CLI client unit tests safe to run: mock only node:os.homedir in that test module so ConfigManager uses a fresh owned mkdtemp directory. Do not change HOME, production configuration resolution, application code, test inclusion or quality floors. Clean only that recorded temporary directory after each test; reject an unset or redirected fixture path. Verify a synthetic fixture token is read through the real ConfigManager and keep the missing-token case. No network request or browser login is performed.

## Validation

Use normal hooks and their index snapshot. Run frozen install, strict types/lint, all unit coverage with the existing four 95.5% thresholds, in-memory SQLite integration, local HTTP7017, web build, OSV and full-history redacted Gitleaks. Before HTTP cleanup, record initially absent owned persistence and schema paths, validate canonical/symlink ownership and free port, force NODE_ENV=test and strip real service credentials. Preserve the complete suite.

Independent readonly reviews apply to the final committed base/head. Require all current-head CI, including existing remote browser coverage, protection and conflict checks before commit-preserving merge. No local browser, live family data, personal credential access, manual deployment or hook bypass. Existing source-state closures and not-planned removal decisions remain separate from this new issue565 repair. This plan claims no passed tests.
