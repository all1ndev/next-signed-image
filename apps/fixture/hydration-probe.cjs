// Usage: node hydration-probe.cjs <path inside a project that has @playwright/test> <url>
// Loads the page in Chromium, reports React hydration warnings and each image's delivery,
// then clicks "more" to render an Image that first renders in the browser.
const { createRequire } = require("node:module");

const { chromium } = createRequire(process.argv[2])("@playwright/test");
const url = process.argv[3];

async function waitForServer() {
	for (let attempt = 0; attempt < 120; attempt++) {
		try {
			if ((await fetch(url)).ok) return;
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 1000));
	}
	throw new Error(`server at ${url} never answered`);
}

(async () => {
	await waitForServer();

	const browser = await chromium.launch();
	const page = await browser.newPage();
	const messages = [];
	page.on("console", (message) => {
		if (["error", "warning"].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
	});
	page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));

	await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
	await page.waitForTimeout(2000);
	await page.click("button");
	await page.waitForSelector("#client-browser-first");

	const images = await page.$$eval("img", (imgs) =>
		imgs.map((img) => `${img.id}=${img.getAttribute("data-image-delivery") ?? "(server component)"} ${img.getAttribute("src").slice(0, 40)}`),
	);
	const hydration = messages.filter((m) => /hydrat|didn't match|did not match|mismatch/i.test(m));

	console.log("images:\n  " + images.join("\n  "));
	console.log("hydration messages:", hydration.length);
	for (const message of hydration) console.log("  -", message.slice(0, 400));
	const other = messages.filter((m) => !hydration.includes(m));
	console.log("other errors/warnings:", other.length);
	for (const message of other) console.log("  -", message.slice(0, 160));

	await browser.close();
})().catch((error) => {
	console.error(error);
	process.exit(1);
});
