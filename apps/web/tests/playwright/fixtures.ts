import { test as base, expect } from "@playwright/test";

/**
 * Shared L3 fixtures. For now this is just a re-export — placeholder for
 * future page objects (e.g. nav helper, login state). Importing from one
 * place keeps later refactors cheap.
 */

export const test = base;
export { expect };
