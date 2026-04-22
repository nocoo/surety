#!/usr/bin/env bun
import { defineCommand, runMain } from "@nocoo/cli-base";
import { authCommand } from "./commands/auth.js";

const main = defineCommand({
  meta: {
    name: "surety",
    version: "0.1.0",
    description: "Surety CLI — AI-facing interface for household policies",
  },
  subCommands: {
    login: authCommand.login,
    logout: authCommand.logout,
    whoami: authCommand.whoami,
  },
});

runMain(main);
