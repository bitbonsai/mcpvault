/**
 * Dedicated video route built on Bun.file(path).slice(start, end).
 *
 * Decided upfront in the migration plan: do NOT rely on Hono's serveStatic
 * for video. Its Bun Range support has been incomplete, and Safari refuses
 * to play video without working Range support.
 *
 * Handles HEAD, full GET, and single-part Range requests with correct
 * 206 Partial Content, Content-Range, and Accept-Ranges headers.
 */
import type { Hono } from "hono";
import { extname, join } from "node:path";

const VIDEO_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

export const VIDEO_EXTENSIONS = Object.keys(VIDEO_TYPES);

// Baseline (headers-baseline.json): production serves the video with a
// 4-hour TTL, not the generic 1-hour static default.
const CACHE_CONTROL = "public, max-age=14400";

interface ByteRange {
  start: number;
  end: number; // inclusive
}

type RangeResult = ByteRange | "unsatisfiable" | null;

/**
 * Parse a single-part Range header against a resource of `size` bytes.
 *
 * Returns:
 * - a satisfiable inclusive byte range,
 * - "unsatisfiable" when the range cannot be satisfied (RFC 9110 -> 416),
 * - null when the header is absent, malformed, or multi-part (serve 200).
 */
export function parseRange(header: string | undefined, size: number): RangeResult {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null; // malformed or multi-part: ignore, serve full body
  const [, rawStart = "", rawEnd = ""] = match;
  if (rawStart === "" && rawEnd === "") return null;

  if (rawStart === "") {
    // suffix range: last N bytes
    const suffix = Number(rawEnd);
    if (suffix === 0) return "unsatisfiable";
    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }

  const start = Number(rawStart);
  if (start >= size) return "unsatisfiable";
  if (rawEnd === "") return { start, end: size - 1 };

  const end = Number(rawEnd);
  if (start > end) return null; // invalid range: ignore, serve full body
  return { start, end: Math.min(end, size - 1) };
}

/** Register GET/HEAD handlers for video files directly under `mediaDir`. */
export function registerVideoRoutes(app: Hono, mediaDir: string): void {
  // Filename only (no slashes), so path traversal is impossible by construction.
  app.on(["GET", "HEAD"], "/:filename{[A-Za-z0-9._-]+\\.(mp4|webm)}", async (c) => {
    const filename = c.req.param("filename");
    const contentType = VIDEO_TYPES[extname(filename).toLowerCase()];
    if (!contentType) return c.notFound();

    const file = Bun.file(join(mediaDir, filename));
    if (!(await file.exists())) return c.notFound();
    const size = file.size;
    const isHead = c.req.method === "HEAD";

    const headers = new Headers({
      "accept-ranges": "bytes",
      "content-type": contentType,
      "cache-control": CACHE_CONTROL,
    });

    const range = parseRange(c.req.header("range"), size);

    if (range === "unsatisfiable") {
      headers.set("content-range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }

    if (range === null) {
      headers.set("content-length", String(size));
      return new Response(isHead ? null : file, { status: 200, headers });
    }

    const { start, end } = range;
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
    headers.set("content-length", String(end - start + 1));
    // Bun.file slice end is exclusive; Content-Range end is inclusive.
    const body = isHead ? null : file.slice(start, end + 1);
    return new Response(body, { status: 206, headers });
  });
}
