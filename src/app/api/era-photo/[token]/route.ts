import { readFile } from "node:fs/promises";

import { loadEraPhotos } from "@/lib/era-photos";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await context.params;
  const photo = loadEraPhotos().find(({ imageUrl }) => imageUrl.endsWith(`/${token}`));

  if (!photo) return new Response("Photo not found.", { status: 404 });

  const image = await readFile(photo.sourcePath);
  return new Response(image, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": photo.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
