import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/app";
import { parseRange } from "../../src/routes/video";

// > 5 MB fixture, generated deterministically so byte offsets are verifiable.
const SIZE = 6 * 1024 * 1024; // 6291456
const FIXTURE = "fixture.mp4";

let publicDir: string;
let app: ReturnType<typeof createApp>;

function patternByte(offset: number): number {
  return offset % 256;
}

beforeAll(async () => {
  publicDir = await mkdtemp(join(tmpdir(), "shibumi-video-test-"));
  const bytes = new Uint8Array(SIZE);
  for (let i = 0; i < SIZE; i++) bytes[i] = patternByte(i);
  await Bun.write(join(publicDir, FIXTURE), bytes);
  app = createApp({ publicDir });
});

afterAll(async () => {
  await rm(publicDir, { recursive: true, force: true });
});

describe("parseRange", () => {
  test("absent header", () => expect(parseRange(undefined, SIZE)).toBeNull());
  test("bounded range", () =>
    expect(parseRange("bytes=0-1023", SIZE)).toEqual({ start: 0, end: 1023 }));
  test("open-ended range", () =>
    expect(parseRange("bytes=100-", SIZE)).toEqual({ start: 100, end: SIZE - 1 }));
  test("suffix range", () =>
    expect(parseRange("bytes=-1024", SIZE)).toEqual({ start: SIZE - 1024, end: SIZE - 1 }));
  test("suffix larger than file clamps to 0", () =>
    expect(parseRange(`bytes=-${SIZE * 2}`, SIZE)).toEqual({ start: 0, end: SIZE - 1 }));
  test("end clamped to size", () =>
    expect(parseRange(`bytes=0-${SIZE * 10}`, SIZE)).toEqual({ start: 0, end: SIZE - 1 }));
  test("start at EOF is unsatisfiable", () =>
    expect(parseRange(`bytes=${SIZE}-`, SIZE)).toBe("unsatisfiable"));
  test("zero suffix is unsatisfiable", () =>
    expect(parseRange("bytes=-0", SIZE)).toBe("unsatisfiable"));
  test("multi-part range ignored", () =>
    expect(parseRange("bytes=0-1,5-6", SIZE)).toBeNull());
  test("malformed range ignored", () => expect(parseRange("bytes=abc", SIZE)).toBeNull());
  test("inverted range ignored", () => expect(parseRange("bytes=10-5", SIZE)).toBeNull());
});

describe("HEAD /fixture.mp4", () => {
  test("returns size and Accept-Ranges without a body", async () => {
    const res = await app.request(`/${FIXTURE}`, { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-length")).toBe(String(SIZE));
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });

  test("with Range returns 206 headers without a body", async () => {
    const res = await app.request(`/${FIXTURE}`, {
      method: "HEAD",
      headers: { range: "bytes=0-1023" },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 0-1023/${SIZE}`);
    expect(res.headers.get("content-length")).toBe("1024");
    expect((await res.arrayBuffer()).byteLength).toBe(0);
  });
});

describe("GET /fixture.mp4 (full)", () => {
  test("returns 200 with the whole file", async () => {
    const res = await app.request(`/${FIXTURE}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(res.headers.get("content-length")).toBe(String(SIZE));
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBe(SIZE);
    expect(body[0]).toBe(patternByte(0));
    expect(body[SIZE - 1]).toBe(patternByte(SIZE - 1));
  });
});

describe("GET /fixture.mp4 with Range", () => {
  test("bounded range returns 206 with exact bytes", async () => {
    const res = await app.request(`/${FIXTURE}`, {
      headers: { range: "bytes=0-1023" },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 0-1023/${SIZE}`);
    expect(res.headers.get("content-length")).toBe("1024");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBe(1024);
    for (let i = 0; i < 1024; i++) {
      if (body[i] !== patternByte(i)) throw new Error(`byte ${i} mismatch`);
    }
  });

  test("mid-file range returns the correct slice", async () => {
    const start = 5 * 1024 * 1024 + 3; // deliberately unaligned
    const end = start + 999;
    const res = await app.request(`/${FIXTURE}`, {
      headers: { range: `bytes=${start}-${end}` },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes ${start}-${end}/${SIZE}`);
    expect(res.headers.get("content-length")).toBe("1000");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBe(1000);
    expect(body[0]).toBe(patternByte(start));
    expect(body[999]).toBe(patternByte(end));
  });

  test("open-ended range returns tail with 206", async () => {
    const start = SIZE - 2048;
    const res = await app.request(`/${FIXTURE}`, {
      headers: { range: `bytes=${start}-` },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes ${start}-${SIZE - 1}/${SIZE}`);
    expect(res.headers.get("content-length")).toBe("2048");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBe(2048);
    expect(body[0]).toBe(patternByte(start));
    expect(body[2047]).toBe(patternByte(SIZE - 1));
  });

  test("suffix range returns last N bytes", async () => {
    const res = await app.request(`/${FIXTURE}`, {
      headers: { range: "bytes=-1024" },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(
      `bytes ${SIZE - 1024}-${SIZE - 1}/${SIZE}`,
    );
    expect(res.headers.get("content-length")).toBe("1024");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body[0]).toBe(patternByte(SIZE - 1024));
    expect(body[1023]).toBe(patternByte(SIZE - 1));
  });

  test("end past EOF is clamped", async () => {
    const res = await app.request(`/${FIXTURE}`, {
      headers: { range: `bytes=0-${SIZE * 10}` },
    });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 0-${SIZE - 1}/${SIZE}`);
    expect(res.headers.get("content-length")).toBe(String(SIZE));
  });

  test("start at EOF returns 416 with bytes */size", async () => {
    const res = await app.request(`/${FIXTURE}`, {
      headers: { range: `bytes=${SIZE}-` },
    });
    expect(res.status).toBe(416);
    expect(res.headers.get("content-range")).toBe(`bytes */${SIZE}`);
  });

  test("multi-part range falls back to full 200", async () => {
    const res = await app.request(`/${FIXTURE}`, {
      headers: { range: "bytes=0-1,5-6" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String(SIZE));
  });

  test("malformed range falls back to full 200", async () => {
    const res = await app.request(`/${FIXTURE}`, {
      headers: { range: "bytes=abc" },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-length")).toBe(String(SIZE));
  });
});

describe("missing video", () => {
  test("returns 404", async () => {
    const res = await app.request("/missing.mp4");
    expect(res.status).toBe(404);
  });
});
