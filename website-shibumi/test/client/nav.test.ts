/**
 * Unit tests for the `nav` Alpine.data() module (mobile menu).
 */
import { describe, expect, test } from "bun:test";
import { nav } from "../../src/client/nav";

describe("nav()", () => {
  test("starts closed", () => {
    expect(nav().open).toBe(false);
  });

  test("toggle() flips open back and forth", () => {
    const data = nav();
    data.toggle();
    expect(data.open).toBe(true);
    data.toggle();
    expect(data.open).toBe(false);
  });

  test("close() closes an open menu", () => {
    const data = nav();
    data.toggle();
    expect(data.open).toBe(true);
    data.close();
    expect(data.open).toBe(false);
  });

  test("close() is a no-op when already closed", () => {
    const data = nav();
    data.close();
    expect(data.open).toBe(false);
  });
});
