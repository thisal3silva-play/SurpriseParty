import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadEraPhotos } from "./era-photos";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("loadEraPhotos", () => {
  it("loads supported age-named photos in age order with opaque URLs", () => {
    const directory = mkdtempSync(join(tmpdir(), "steph-eras-"));
    directories.push(directory);
    writeFileSync(join(directory, "18-graduation.webp"), "photo");
    writeFileSync(join(directory, "7-school.jpg"), "photo");
    writeFileSync(join(directory, "31-invalid.jpg"), "photo");
    writeFileSync(join(directory, "notes.txt"), "not a photo");

    const photos = loadEraPhotos(directory);

    expect(photos.map(({ age }) => age)).toEqual([7, 18]);
    expect(photos[0]).toMatchObject({ contentType: "image/jpeg" });
    expect(photos[1]).toMatchObject({ contentType: "image/webp" });
    expect(photos.every(({ imageUrl }) => /^\/api\/era-photo\/[a-f0-9]{16}$/.test(imageUrl))).toBe(true);
    expect(photos.map(({ imageUrl }) => imageUrl).join(" ")).not.toContain("school");
  });

  it("returns no photos when the upload directory does not exist", () => {
    expect(loadEraPhotos(join(tmpdir(), "missing-steph-era-directory"))).toEqual([]);
  });
});
