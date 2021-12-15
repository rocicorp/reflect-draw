import next from "next";
import { Command } from "commander";
import { createServer, IncomingMessage, Server as NodeServer } from "http";
import { WebSocket } from "ws";
import { parse } from "url";
import { Socket } from "./types/client-state";
import { Server } from "./server/server";
import { handleMessage } from "./server/message";
import { handlePush } from "./server/push";
import { handleConnection } from "./server/connect";
import { handleClose } from "./server/close";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const program = new Command().option(
  "-p, --port <port>",
  "port to listen on",
  parseInt
);

app.prepare().then(() => {
  program.parse(process.argv);

  const port = program.opts().port || process.env.PORT || 3000;

  const httpServer = createServer((req, res) =>
    handle(req, res, parse(req.url!, true))
  );
  const webSocketServer = new WebSocket.Server({ noServer: true });

  const replicacheServer = new Server(
    new Map(),
    handleConnection,
    handleMessage.bind(null, handlePush),
    handleClose,
    performance.now
  );

  httpServer.on("upgrade", (req, socket, head) => {
    webSocketServer.handleUpgrade(req, socket, head, (ws) => {
      // TODO: Not sure if this indirection through the connection event is necessary?
      webSocketServer.emit("connection", ws, req);
    });
  });

  webSocketServer.on("connection", (ws: Socket, req: IncomingMessage) => {
    replicacheServer.handleConnection(ws, req.url!);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
