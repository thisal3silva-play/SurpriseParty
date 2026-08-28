"use client";

import { type FormEvent, useEffect, useState } from "react";

import { getSocket } from "@/lib/socket";
import type { RoomActionResult, RoomState } from "@/types/party";

const games = [
  {
    icon: "💭",
    title: "Birthday Trivia",
    description: "Find out who knows the guest of honor best.",
    players: "2–12 players",
    color: "violet",
  },
  {
    icon: "🎭",
    title: "Party Charades",
    description: "Act out silly prompts before the timer runs out.",
    players: "4–12 players",
    color: "coral",
  },
  {
    icon: "✏️",
    title: "Draw & Guess",
    description: "Sketch questionable masterpieces together.",
    players: "3–10 players",
    color: "mint",
  },
] as const;

type Mode = "create" | "join";

export function PartyLobby() {
  const [mode, setMode] = useState<Mode>("create");
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const updateRoom = (nextRoom: RoomState) => setRoom(nextRoom);
    const closeRoom = (message: string) => {
      setRoom(null);
      setError(message);
    };
    const connectionError = () => {
      setIsWorking(false);
      setError("Could not reach the party server. Try again in a moment.");
    };

    socket.on("roomUpdated", updateRoom);
    socket.on("roomClosed", closeRoom);
    socket.on("connect_error", connectionError);

    return () => {
      socket.off("roomUpdated", updateRoom);
      socket.off("roomClosed", closeRoom);
      socket.off("connect_error", connectionError);
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsWorking(true);

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const done = (result: RoomActionResult) => {
      setIsWorking(false);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRoom(result.room);
      setPlayerId(result.playerId);
    };

    if (mode === "create") socket.emit("createRoom", { name }, done);
    else socket.emit("joinRoom", { name, roomCode }, done);
  }

  function leaveRoom() {
    getSocket().emit("leaveRoom");
    setRoom(null);
    setPlayerId(null);
    setError("");
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(room?.code ?? "");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (room) {
    const isHost = room.hostId === playerId;

    return (
      <main className="site-shell">
        <Confetti />
        <nav className="nav"><Brand /><button className="text-button" onClick={leaveRoom}>Leave room</button></nav>
        <section className="room-panel">
          <div className="room-heading">
            <div>
              <span className="eyebrow">Your private party room</span>
              <h1>Everyone&apos;s invited!</h1>
              <p>Share this code with friends so they can join the fun.</p>
            </div>
            <button className="room-code" onClick={copyInvite} aria-label="Copy room code">
              <small>ROOM CODE</small><strong>{room.code}</strong><span>{copied ? "Copied!" : "Click to copy"}</span>
            </button>
          </div>

          <div className="lobby-grid">
            <section className="players-card">
              <div className="section-title"><h2>Party people</h2><span>{room.players.length}/12</span></div>
              <div className="player-list">
                {room.players.map((player, index) => (
                  <div className="player" key={player.id}>
                    <span className={`avatar avatar-${index % 4}`}>{player.name.charAt(0).toUpperCase()}</span>
                    <strong>{player.name}{player.id === playerId ? " (you)" : ""}</strong>
                    {player.id === room.hostId && <span className="host-badge">Host</span>}
                  </div>
                ))}
              </div>
              <div className="waiting"><span /><span /><span /> Waiting for more friends</div>
            </section>

            <section className="games-section">
              <div className="section-title"><h2>Pick a game</h2><span>More coming soon</span></div>
              <div className="game-grid compact">
                {games.map((game) => <GameCard key={game.title} {...game} />)}
              </div>
              <button className="primary-button start-button" disabled={!isHost}>
                {isHost ? "Choose a game to start" : "Waiting for the host"}
              </button>
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="site-shell">
      <Confetti />
      <nav className="nav"><Brand /><span className="nav-note">No app. No account. Just fun.</span></nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">The party starts here</span>
          <h1>Big laughs.<br /><em>Zero setup.</em></h1>
          <p>Bring everyone together with quick, delightfully silly games made for birthdays and best friends.</p>
          <div className="feature-row"><span>✓ Free to play</span><span>✓ Up to 12 friends</span><span>✓ Works on any device</span></div>
        </div>

        <div className="join-card">
          <div className="cake-topper" aria-hidden="true">🎂</div>
          <h2>Join the celebration</h2>
          <p>Enter a name, then start a new room or join your friends.</p>
          <div className="mode-switch" role="tablist">
            <button className={mode === "create" ? "active" : ""} onClick={() => { setMode("create"); setError(""); }} type="button">Create room</button>
            <button className={mode === "join" ? "active" : ""} onClick={() => { setMode("join"); setError(""); }} type="button">Join room</button>
          </div>
          <form onSubmit={submit}>
            <label htmlFor="name">Your name</label>
            <input id="name" maxLength={24} onChange={(event) => setName(event.target.value)} placeholder="Birthday legend" required value={name} />
            {mode === "join" && <><label htmlFor="room-code">Room code</label><input className="code-input" id="room-code" maxLength={4} onChange={(event) => setRoomCode(event.target.value.toUpperCase())} placeholder="ABCD" required value={roomCode} /></>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button" disabled={isWorking} type="submit">{isWorking ? "Inflating balloons…" : mode === "create" ? "Create my party →" : "Join the party →"}</button>
          </form>
          <small>Nothing to download. Your room disappears when everyone leaves.</small>
        </div>
      </section>

      <section className="games-preview">
        <span className="eyebrow">Made for the group chat</span>
        <h2>A game for every kind of party</h2>
        <div className="game-grid">{games.map((game) => <GameCard key={game.title} {...game} />)}</div>
      </section>
    </main>
  );
}

function Brand() {
  return <a className="brand" href="#"><span>★</span> surprise<span>party!</span></a>;
}

function Confetti() {
  return <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>;
}

function GameCard({ icon, title, description, players, color }: (typeof games)[number]) {
  return <article className={`game-card ${color}`}><div className="game-icon">{icon}</div><div><h3>{title}</h3><p>{description}</p><small>{players}</small></div><span className="coming-soon">Soon</span></article>;
}
