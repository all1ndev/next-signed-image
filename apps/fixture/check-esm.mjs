// Imports every entry point of the built package under plain Node ESM, as a test runner does
// for an un-inlined dependency. It lives in the fixture so the package and next resolve from here.
const expectations = {
	"@all1ndev/next-signed-image/route": ["createImageRoute", "defineImageSigner"],
	"@all1ndev/next-signed-image/delivery": ["serverDelivery", "srcUrl", "defaultImageSizes"],
	"@all1ndev/next-signed-image/config": ["withSignedImages", "defaultImageSizes"],
	"@all1ndev/next-signed-image/signer/browser": ["imageSigner"],
};
// Without a bundler alias, these reach the unconfigured signer, which must throw its setup error.
const unconfigured = ["@all1ndev/next-signed-image", "@all1ndev/next-signed-image/signer"];

let failed = false;

for (const [specifier, names] of Object.entries(expectations)) {
	try {
		const module = await import(specifier);
		const missing = names.filter((name) => !(name in module));
		if (missing.length > 0) throw new Error(`missing exports: ${missing.join(", ")}`);
		console.log(`${specifier}: OK`);
	} catch (error) {
		failed = true;
		console.error(`${specifier}: ${error instanceof Error ? error.message : error}`);
	}
}

for (const specifier of unconfigured) {
	try {
		await import(specifier);
		failed = true;
		console.error(`${specifier}: loaded without a signer; expected the setup error`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.includes("no image signer is configured")) {
			console.log(`${specifier}: OK (setup error)`);
		} else {
			failed = true;
			console.error(`${specifier}: ${message}`);
		}
	}
}

process.exitCode = failed ? 1 : 0;
