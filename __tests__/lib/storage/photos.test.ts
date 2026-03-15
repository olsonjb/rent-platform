import { describe, it, expect } from "vitest";
import {
  validatePhotoFile,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  BUCKET_NAME,
} from "@/lib/storage/photos";

function createMockFile(
  name: string,
  size: number,
  type: string,
): File {
  const buffer = new ArrayBuffer(size > 0 ? 1 : 0);
  const file = new File([buffer], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validatePhotoFile", () => {
  it("accepts valid JPEG file", () => {
    const file = createMockFile("photo.jpg", 1024, "image/jpeg");
    const result = validatePhotoFile(file);
    expect(result).toEqual({ valid: true });
  });

  it("accepts valid PNG file", () => {
    const file = createMockFile("photo.png", 5 * 1024 * 1024, "image/png");
    const result = validatePhotoFile(file);
    expect(result).toEqual({ valid: true });
  });

  it("accepts valid WebP file", () => {
    const file = createMockFile("photo.webp", 2048, "image/webp");
    const result = validatePhotoFile(file);
    expect(result).toEqual({ valid: true });
  });

  it("accepts valid GIF file", () => {
    const file = createMockFile("photo.gif", 512, "image/gif");
    const result = validatePhotoFile(file);
    expect(result).toEqual({ valid: true });
  });

  it("rejects empty file", () => {
    const file = createMockFile("empty.jpg", 0, "image/jpeg");
    const result = validatePhotoFile(file);
    expect(result).toEqual({
      valid: false,
      error: { type: "empty" },
    });
  });

  it("rejects file exceeding max size", () => {
    const size = MAX_FILE_SIZE + 1;
    const file = createMockFile("large.jpg", size, "image/jpeg");
    const result = validatePhotoFile(file);
    expect(result).toEqual({
      valid: false,
      error: { type: "too_large", size, max: MAX_FILE_SIZE },
    });
  });

  it("rejects file at exactly max size + 1", () => {
    const file = createMockFile("big.jpg", 10 * 1024 * 1024 + 1, "image/jpeg");
    const result = validatePhotoFile(file);
    expect(result.valid).toBe(false);
  });

  it("accepts file at exactly max size", () => {
    const file = createMockFile("exact.jpg", MAX_FILE_SIZE, "image/jpeg");
    const result = validatePhotoFile(file);
    expect(result).toEqual({ valid: true });
  });

  it("rejects PDF file", () => {
    const file = createMockFile("doc.pdf", 1024, "application/pdf");
    const result = validatePhotoFile(file);
    expect(result).toEqual({
      valid: false,
      error: { type: "invalid_type", mime: "application/pdf" },
    });
  });

  it("rejects text file", () => {
    const file = createMockFile("readme.txt", 100, "text/plain");
    const result = validatePhotoFile(file);
    expect(result).toEqual({
      valid: false,
      error: { type: "invalid_type", mime: "text/plain" },
    });
  });

  it("rejects SVG file", () => {
    const file = createMockFile("icon.svg", 1024, "image/svg+xml");
    const result = validatePhotoFile(file);
    expect(result).toEqual({
      valid: false,
      error: { type: "invalid_type", mime: "image/svg+xml" },
    });
  });

  it("rejects video file", () => {
    const file = createMockFile("video.mp4", 5000, "video/mp4");
    const result = validatePhotoFile(file);
    expect(result).toEqual({
      valid: false,
      error: { type: "invalid_type", mime: "video/mp4" },
    });
  });

  it("rejects file with empty string mime type", () => {
    const file = createMockFile("unknown", 1024, "");
    const result = validatePhotoFile(file);
    expect(result).toEqual({
      valid: false,
      error: { type: "invalid_type", mime: "" },
    });
  });
});

describe("constants", () => {
  it("exports correct bucket name", () => {
    expect(BUCKET_NAME).toBe("maintenance-photos");
  });

  it("exports correct max file size (10MB)", () => {
    expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
  });

  it("exports allowed mime types", () => {
    expect(ALLOWED_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_MIME_TYPES).toContain("image/webp");
    expect(ALLOWED_MIME_TYPES).toContain("image/gif");
    expect(ALLOWED_MIME_TYPES).toHaveLength(4);
  });

  it("does not include SVG in allowed types", () => {
    expect(ALLOWED_MIME_TYPES).not.toContain("image/svg+xml");
  });
});
