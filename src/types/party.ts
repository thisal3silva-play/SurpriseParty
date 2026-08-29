export type GameId = "trivia" | "guess-the-era" | "steph-did-that";

export type StephGameState =
  | {
  game: "steph-did-that";
      phase: "voting";
      question: string;
      questionNumber: number;
      totalQuestions: number;
      votesReceived: number;
    }
  | {
      game: "steph-did-that";
      phase: "revealed";
      question: string;
      questionNumber: number;
      totalQuestions: number;
      trueVotes: number;
      falseVotes: number;
      correctAnswer: boolean;
    };

export interface EraGuessResult {
  playerId: string;
  playerName: string;
  age: number;
}

export type EraGameState =
  | {
      game: "guess-the-era";
      phase: "guessing";
      imageUrl: string;
      photoNumber: number;
      totalPhotos: number;
      guessesReceived: number;
    }
  | {
      game: "guess-the-era";
      phase: "revealed";
      imageUrl: string;
      photoNumber: number;
      totalPhotos: number;
      correctAge: number;
      guesses: EraGuessResult[];
    };

export type TriviaGameState =
  | {
      game: "trivia";
      phase: "answering";
      question: string;
      options: string[];
      questionNumber: number;
      totalQuestions: number;
      answersReceived: number;
    }
  | {
      game: "trivia";
      phase: "revealed";
      question: string;
      options: string[];
      questionNumber: number;
      totalQuestions: number;
      correctOptionIndex: number;
      answerCounts: number[];
    };

export type GameState = StephGameState | EraGameState | TriviaGameState;

export interface Player {
  id: string;
  name: string;
  joinedAt: number;
}

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  points: number;
}

export interface RoomState {
  code: string;
  hostId: string;
  players: Player[];
  selectedGame: GameId | null;
  status: "lobby" | "playing";
  gameState: GameState | null;
  leaderboard: LeaderboardEntry[];
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

export type GameActionResult =
  | { ok: true; room: RoomState }
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
  selectGame: (
    input: { gameId: GameId },
    callback: (result: GameActionResult) => void,
  ) => void;
  startGame: (callback: (result: GameActionResult) => void) => void;
  submitStephVote: (
    input: { answer: boolean },
    callback: (result: GameActionResult) => void,
  ) => void;
  closeStephAnswers: (callback: (result: GameActionResult) => void) => void;
  nextStephQuestion: (callback: (result: GameActionResult) => void) => void;
  submitEraGuess: (
    input: { age: number },
    callback: (result: GameActionResult) => void,
  ) => void;
  closeEraGuesses: (callback: (result: GameActionResult) => void) => void;
  nextEraPhoto: (callback: (result: GameActionResult) => void) => void;
  submitTriviaAnswer: (
    input: { optionIndex: number },
    callback: (result: GameActionResult) => void,
  ) => void;
  closeTriviaAnswers: (callback: (result: GameActionResult) => void) => void;
  nextTriviaQuestion: (callback: (result: GameActionResult) => void) => void;
}

export interface SocketData {
  playerId?: string;
  roomCode?: string;
}
