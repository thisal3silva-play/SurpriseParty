import { readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import type { EraPhoto } from "./rooms";

const PHOTO_NAME = /^(0|[1-2]?\d|30)(?:[-_ ].*)?\.(?:avif|gif|jpe?g|png|webp)$/i;

export interface LoadedEraPhoto extends EraPhoto {
  sourcePath: string;
  contentType: string;
}

export function loadEraPhotos(directory = join(process.cwd(), "content", "steph-eras")): LoadedEraPhoto[] {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && PHOTO_NAME.test(entry.name))
      .map((entry) => {
        const match = PHOTO_NAME.exec(entry.name);
        const extension = entry.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const token = createHash("sha256").update(entry.name).digest("hex").slice(0, 16);
        return {
          age: Number(match?.[1]),
          imageUrl: `/api/era-photo/${token}`,
          sourcePath: join(directory, entry.name),
          contentType: extension === "jpg" || extension === "jpeg" ? "image/jpeg" : `image/${extension}`,
        };
      })
      .sort((left, right) => left.age - right.age || left.imageUrl.localeCompare(right.imageUrl));
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : undefined;
    if (code === "ENOENT") return [];
    throw error;
  }
}
