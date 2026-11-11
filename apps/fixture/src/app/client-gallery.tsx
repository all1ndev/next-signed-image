"use client";

import { Image } from "@all1ndev/next-signed-image";
import { type JSX, useState } from "react";

import hero from "./hero.png";

const FILL = { fill: true, sizes: "(min-width: 1024px) 272px, 90vw" } as const;

export function ClientGallery(): JSX.Element {
	const [more, setMore] = useState(false);

	return (
		<section>
			<h2>Client component</h2>
			<div style={{ position: "relative", width: 272, height: 200 }}>
				<Image id="client-signed" src="https://img.example.com/a.jpg" alt="" {...FILL} />
			</div>
			<Image id="client-quality" src="https://img.example.com/b.jpg" alt="" width={256} height={192} quality={75} />
			<Image id="client-as-is" src="https://files.example.com/c.jpg" alt="" width={64} height={48} />
			<Image id="client-route" src="https://evil.com/d.jpg" alt="" width={64} height={48} />
			<Image id="client-static" src={hero} alt="" />
			<button type="button" onClick={() => setMore(true)}>
				more
			</button>
			{more && <Image id="client-browser-first" src="https://img.example.com/e.jpg" alt="" width={256} height={192} />}
		</section>
	);
}
