import { createServer } from "http";
import WebSocket from "ws";
import { parse } from "url";
import next from "next";
import { Command } from "commander";
import { pushMessageSchema } from "protocol/push";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const program = new Command().option(
  "-p, --port <port>",
  "port to listen on",
  parseInt
);

type Client = {
  clientID: string;
  roomID: string;
  socket: WebSocket;
};

const clients: Client[] = [];

app.prepare().then(() => {
  program.parse(process.argv);

  const port = program.opts().port || process.env.PORT || 3000;

  const server = createServer((req, res) =>
    handle(req, res, parse(req.url!, true))
  );
  const wss = new WebSocket.Server({ noServer: true });

  wss.on("connection", (ws, req) => {
    const url = parse(req.url!, true);
    const parts = (url.pathname ?? "").split("/");

    if (parts[1] != "d" || !parts[2]) {
      ws.send("invalid url - no room id");
      ws.close();
      return;
    }

    const roomID = parts[2];
    const clientID = (url.query.clientID as string) ?? [];
    if (!clientID) {
      ws.send("invalid url - no client ID");
      ws.close();
      return;
    }

    const existingClient = clients.find((c) => c.clientID === clientID);
    if (existingClient) {
      existingClient.socket.close();
    }

    const client = {
      clientID,
      roomID,
      socket: ws,
    };
    clients.push(client);

    client.socket.on("close", () => {
      const index = clients.findIndex((c) => c.clientID === clientID);
      clients.splice(index, 1);
    });

    client.socket.on("message", (data) => {
      handleSocketRequest(client, data);
    });
  });

  server.on("upgrade", (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});

function handleSocketRequest(client: Client, data: WebSocket.RawData) {
  const v = JSON.parse(data.toString());
  const message = pushMessageSchema.safeParse(v);
  if (!message.success) {
    console.error(message.error);
    return;
  }
}