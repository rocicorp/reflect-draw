export function sleep(ms: number = 0, setTimeout = globalThis.setTimeout) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
