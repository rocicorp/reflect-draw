export function sleep(ms = 0, setTimeout = globalThis.setTimeout) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
