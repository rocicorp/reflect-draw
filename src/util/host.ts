import { env } from "process";

// The websocket address will be ws:// when developing locally or wss://
// in production. Likewise the reflect server is accessible via http://
// in development and https:// in production.
export const workerWsURI =
  env.NEXT_PUBLIC_WORKER_HOST ?? "wss://replidraw.replicache.workers.dev";
export const workerURL = workerWsURI.replace(/^ws/, "http");
