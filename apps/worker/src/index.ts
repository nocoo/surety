import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import type { AppEnv } from "./lib/types";
import { accessAuth } from "./middleware/access-auth";
import { apiKeyAuth } from "./middleware/api-key-auth";
import { dbMiddleware } from "./middleware/db";
import { originGuard } from "./middleware/origin-guard";
import assetsRoutes from "./routes/assets";
import authRoutes from "./routes/auth";
import authCliRoutes from "./routes/auth-cli";
import backupRoutes from "./routes/backup";
import coverageLookupRoutes from "./routes/coverage-lookup";
import dashboardRoutes from "./routes/dashboard";
import doctorsRoutes from "./routes/doctors";
import hospitalsRoutes from "./routes/hospitals";
import insurersRoutes from "./routes/insurers";
import liveRoutes from "./routes/live";
import meRoutes from "./routes/me";
import medicalVisitsRoutes from "./routes/medical-visits";
import membersRoutes from "./routes/members";
import policiesRoutes from "./routes/policies";
import renewalCalendarRoutes from "./routes/renewal-calendar";
import settingsRoutes from "./routes/settings";

const app = new Hono<AppEnv>();

app.use("*", secureHeaders());

app.use("/api/*", dbMiddleware);
app.use("/api/*", accessAuth);
app.use("/api/*", apiKeyAuth);
app.use("/api/*", originGuard);

app.route("/", liveRoutes);
app.route("/", membersRoutes);
app.route("/", policiesRoutes);
app.route("/", insurersRoutes);
app.route("/", assetsRoutes);
app.route("/", hospitalsRoutes);
app.route("/", doctorsRoutes);
app.route("/", medicalVisitsRoutes);
app.route("/", dashboardRoutes);
app.route("/", settingsRoutes);
app.route("/", backupRoutes);
app.route("/", coverageLookupRoutes);
app.route("/", renewalCalendarRoutes);
app.route("/", authRoutes);
app.route("/", authCliRoutes);
app.route("/", meRoutes);

export default app;
