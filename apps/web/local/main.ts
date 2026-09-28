import { createServer, preview } from "vite";
import { type Mode, resetDemo } from "../../worker/local/native";
import { localGateway } from "./gateway";

const args = process.argv.slice(2);
function value(name: string) {
	const i = args.indexOf(name);
	return i < 0 ? undefined : args[i + 1];
}
if (args.includes("--reset-demo")) {
	await resetDemo();
	console.log("Demo storage reset. Start Demo to seed the catalog.");
	process.exit(0);
}
const initial = value("--mode");
if (initial && !["demo", "e2e", "prod"].includes(initial)) throw new Error("Invalid startup mode");
const automated = args.includes("--automated");
if (automated) {
	for (const key of Object.keys(process.env))
		if (/SURETY_.*(?:TOKEN|SECRET|URL)|CLOUDFLARE_.*(?:TOKEN|KEY|ID)/.test(key))
			delete process.env[key];
}
const gateway = await localGateway({
	automated,
	dataset: value("--dataset") === "empty" ? "empty" : "demo",
	...(initial ? { initial: initial as Mode } : {}),
});
const port = Number(value("--port") ?? 7012);
const config = {
	root: gateway.root,
	plugins: [gateway.plugin],
	server: { port, host: "127.0.0.1", strictPort: true },
	preview: { port, host: "127.0.0.1", strictPort: true },
};
const server = args.includes("--built") ? await preview(config) : await createServer(config);
if ("listen" in server) await server.listen();
server.printUrls();
let stopping = false;
async function stop() {
	if (stopping) return;
	stopping = true;
	await server.close();
	await gateway.stop();
	process.exit(0);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
