import { Image } from "@all1ndev/next-signed-image";

import type { JSX } from "react";

import { ClientGallery } from "./client-gallery";
import hero from "./hero.png";

export default function Page(): JSX.Element {
	return (
		<main>
			<h1>Server component</h1>
			<Image id="server-signed" src="https://img.example.com/hero.jpg" alt="" width={256} height={192} preload />
			<Image id="server-as-is" src="https://files.example.com/a.jpg" alt="" width={256} height={192} />
			<Image id="server-static" src={hero} alt="" />
			<ClientGallery />
		</main>
	);
}
