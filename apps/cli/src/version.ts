import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readVersion } from "@nocoo/base-cli";

/** Root of the `@nocoo/surety` package (contains package.json next to `src/`). */
export function cliPackageRoot(): string {
	return join(dirname(fileURLToPath(import.meta.url)), "..");
}

/** Version from this package's package.json (monorepo checkout or npm install). */
export const CLI_PACKAGE_VERSION: string = readVersion(cliPackageRoot());
