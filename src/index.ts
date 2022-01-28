export async function handleRequest(request: Request, env: Bindings) {
  // Match route against pattern /:name/*action
  const url = new URL(request.url);

  if (url.pathname !== "/connect") {
    return new Response("unknown route", {
      status: 400,
    });
  }

  const roomID = url.searchParams.get("roomID");
  if (roomID === null || roomID === "") {
    return new Response("roomID parameter required", {
      status: 400,
    });
  }

  // Forward the request to the named Durable Object...
  const { server } = env;
  const id = server.idFromName(roomID);
  console.log("id", id);
  const stub = server.get(id);
  console.log("stub", stub);
  return stub.fetch(url.toString());
}

const worker: ExportedHandler<Bindings> = { fetch: handleRequest };

export { Server } from "./server/server";
export default worker;
