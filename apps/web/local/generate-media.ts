import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const directory = resolve(import.meta.dirname, "../../worker/local/media");
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
try {
	const page = await browser.newPage({
		viewport: { width: 960, height: 600 },
		deviceScaleFactor: 1,
	});
	await page.setContent(
		`<html><body style="margin:0"><svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#edf0e5"/><circle cx="790" cy="135" r="160" fill="#d6e2d1"/><path d="M690 440V260L800 175 910 260V440Z" fill="#48765e"/><path d="M735 440V330H810V440" fill="#e2bb77"/><path d="M670 267 800 161 935 267" fill="none" stroke="#2c5343" stroke-width="18"/><text x="64" y="105" font-family="sans-serif" font-size="21" fill="#48765e">SURETY / SYNTHETIC FAMILY CATALOG</text><text x="64" y="215" font-family="sans-serif" font-size="52" fill="#253e35">A home, protected.</text><text x="64" y="274" font-family="sans-serif" font-size="24" fill="#48765e">Family protection overview</text><path d="M64 320H555" stroke="#a7b7a2"/><text x="64" y="367" font-family="sans-serif" font-size="22" fill="#253e35">Medical · Life · Accident · Property</text><text x="64" y="410" font-family="sans-serif" font-size="18" fill="#48765e">Policy: DEMO-2026-001</text><text x="64" y="532" font-family="sans-serif" font-size="18" fill="#48765e">Original demonstration artwork. No personal records.</text></svg></body></html>`,
	);
	await page.screenshot({ path: resolve(directory, "family-protection.png") });
	await page.pdf({
		path: resolve(directory, "family-protection.pdf"),
		width: "960px",
		height: "600px",
		printBackground: true,
	});
} finally {
	await browser.close();
}
