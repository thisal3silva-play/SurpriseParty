import { io, type Socket } from "socket.io-client";

import type { ClientToServerEvents, ServerToClientEvents } from "@/types/party";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | undefined;

export function getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> {
  socket ??= io({ autoConnect: false });
  return socket;
}
