export type GameId = "trivia" | "charades" | "draw-and-guess";

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
  selectedGame: GameId | null;
  status: "lobby" | "playing";
}

export interface JoinRoomInput {
  name: string;
  roomCode: string;
}

export interface CreateRoomInput {
  name: string;
}

export type RoomActionResult =
  | { ok: true; room: RoomState; playerId: string }
  | { ok: false; error: string };

export interface ServerToClientEvents {
  roomUpdated: (room: RoomState) => void;
  roomClosed: (message: string) => void;
}

export interface ClientToServerEvents {
  createRoom: (
    input: CreateRoomInput,
    callback: (result: RoomActionResult) => void,
  ) => void;
  joinRoom: (
    input: JoinRoomInput,
    callback: (result: RoomActionResult) => void,
  ) => void;
  leaveRoom: () => void;
}

export interface SocketData {
  playerId?: string;
  roomCode?: string;
}
