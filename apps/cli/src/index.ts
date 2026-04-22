#!/usr/bin/env bun
import { defineCommand, runMain } from "@nocoo/cli-base";
import { authCommand } from "./commands/auth.js";
import { membersCommand } from "./commands/members.js";
import { insurersCommand } from "./commands/insurers.js";
import { assetsCommand } from "./commands/assets.js";
import { hospitalsCommand } from "./commands/hospitals.js";
import { doctorsCommand } from "./commands/doctors.js";
import { medicalVisitsCommand } from "./commands/medical-visits.js";
import { policiesCommand } from "./commands/policies.js";

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
    members: membersCommand,
    insurers: insurersCommand,
    assets: assetsCommand,
    hospitals: hospitalsCommand,
    doctors: doctorsCommand,
    "medical-visits": medicalVisitsCommand,
    policies: policiesCommand,
  },
});

runMain(main);
