/**
 * Minimal ambient types for `@alpinejs/csp`. The package ships no `.d.ts`
 * (it is a drop-in build swap for `alpinejs`, which itself only has
 * community `@types/alpinejs`); this declares just the two calls this app
 * uses -- `Alpine.data()` to register a named module and `Alpine.start()`
 * to boot it -- rather than pulling in an unrelated types package.
 */
declare module "@alpinejs/csp" {
  export interface Alpine {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party
    // callback signature varies per call site (`x-data="name(arg)"` passes
    // through whatever `arg` is, and each module's own return shape differs);
    // `any`/`object` here are the untyped-library boundary, not a leak into
    // this app's own typed `Alpine.data()` module return types.
    data(name: string, callback: (...args: any[]) => object): void;
    start(): void;
  }

  const AlpineInstance: Alpine;
  export default AlpineInstance;
}
