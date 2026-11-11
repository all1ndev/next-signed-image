import { createImageRoute } from "@all1ndev/next-signed-image/route";

import { imageSigner } from "../../../image-signer";

export const GET: (request: Request) => Response = createImageRoute(imageSigner);
