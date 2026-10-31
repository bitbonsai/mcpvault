/**
 * Bundles a browser-bound TypeScript entry point with Bun's built-in
 * bundler (`Bun.build()`) and caches the resulting source in memory.
 *
 * There is deliberately no separate build stage in the Containerfile or a
 * bundler dependency: `Bun.build()` ships in the Bun runtime this app
 * already requires, so `src/client/*.ts` (see the plan's proposed
 * structure) can stay real, type-checked TypeScript while the server
 * compiles it to plain browser JS the first time it's requested -- the
 * same "cached at startup"-shaped pattern `highlight.ts` uses for Shiki,
 * just lazy instead of eager since it only matters for pages that load a
 * client script.
 */
const cache = new Map<string, Promise<string>>();

export async function buildClientScript(entrypoint: string): Promise<string> {
  let cached = cache.get(entrypoint);
  if (!cached) {
    cached = bundle(entrypoint);
    cache.set(entrypoint, cached);
  }
  return cached;
}

async function bundle(entrypoint: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    target: "browser",
    format: "esm",
    minify: true,
  });

  if (!result.success) {
    throw new AggregateError(
      result.logs.map((log) => new Error(String(log))),
      `client bundle failed for ${entrypoint}`,
    );
  }

  const [output] = result.outputs;
  if (!output) {
    throw new Error(`client bundle produced no output for ${entrypoint}`);
  }

  return output.text();
}
