import { Hono } from "hono";
import { accessAuth } from "./middleware/access-auth";
import { apiKeyAuth } from "./middleware/api-key-auth";
import { dbMiddleware } from "./middleware/db";
import liveRoutes from "./routes/live";
import membersRoutes from "./routes/members";
import policiesRoutes from "./routes/policies";
import insurersRoutes from "./routes/insurers";
import assetsRoutes from "./routes/assets";
import hospitalsRoutes from "./routes/hospitals";
import doctorsRoutes from "./routes/doctors";
import medicalVisitsRoutes from "./routes/medical-visits";
import dashboardRoutes from "./routes/dashboard";
import settingsRoutes from "./routes/settings";
import backupRoutes from "./routes/backup";
import coverageLookupRoutes from "./routes/coverage-lookup";
import renewalCalendarRoutes from "./routes/renewal-calendar";
import authRoutes from "./routes/auth";
import type { AppEnv } from "./lib/types";

const app = new Hono<AppEnv>();

app.use("/api/*", dbMiddleware);
app.use("/api/*", accessAuth);
app.use("/api/*", apiKeyAuth);

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

export default app;
