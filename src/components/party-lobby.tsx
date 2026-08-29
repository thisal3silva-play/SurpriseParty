"use client";

import Image from "next/image";
import { type FormEvent, useEffect, useState } from "react";

import { getSocket } from "@/lib/socket";
import type { GameActionResult, GameId, RoomActionResult, RoomState } from "@/types/party";

const games = [
  {
    id: "trivia",
    icon: "💭",
    title: "Birthday Trivia",
    description: "Find out who knows the guest of honor best.",
    color: "violet",
    available: true,
  },
  {
    id: "guess-the-era",
    icon: "📸",
    title: "Guess the Era",
    description: "Look at a photo of Stephanie and guess how old she was.",
    color: "coral",
    available: true,
  },
  {
    id: "steph-did-that",
    icon: "🤔",
    title: "Steph did that!?",
    description: "Decide whether each surprising Steph story is true or false.",
    color: "mint",
    available: true,
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
  const [selectedAnswer, setSelectedAnswer] = useState<{ questionNumber: number; answer: boolean } | null>(null);
  const [eraAge, setEraAge] = useState(15);
  const [submittedEraGuess, setSubmittedEraGuess] = useState<{ photoNumber: number; age: number } | null>(null);
  const [selectedTriviaAnswer, setSelectedTriviaAnswer] = useState<{ questionNumber: number; optionIndex: number } | null>(null);

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

    const done = (timeoutError: Error | null, result?: RoomActionResult) => {
      setIsWorking(false);
      if (timeoutError || !result) {
        setError("The party server did not respond. Check your connection and try again.");
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRoom(result.room);
      setPlayerId(result.playerId);
    };

    if (mode === "create") socket.timeout(10_000).emit("createRoom", { name }, done);
    else socket.timeout(10_000).emit("joinRoom", { name, roomCode }, done);
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

  const finishGameAction = (result: GameActionResult) => {
    setIsWorking(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
    setRoom(result.room);
  };

  function selectGame(gameId: GameId) {
    setIsWorking(true);
    getSocket().emit("selectGame", { gameId }, finishGameAction);
  }

  function startGame() {
    setIsWorking(true);
    getSocket().emit("startGame", finishGameAction);
  }

  function vote(answer: boolean) {
    setIsWorking(true);
    getSocket().emit("submitStephVote", { answer }, (result) => {
      finishGameAction(result);
      if (result.ok && result.room.gameState?.game === "steph-did-that") {
        setSelectedAnswer({ questionNumber: result.room.gameState.questionNumber, answer });
      }
    });
  }

  function closeAnswers() {
    setIsWorking(true);
    getSocket().emit("closeStephAnswers", finishGameAction);
  }

  function nextQuestion() {
    setIsWorking(true);
    getSocket().emit("nextStephQuestion", finishGameAction);
  }

  function submitEraGuess() {
    setIsWorking(true);
    getSocket().emit("submitEraGuess", { age: eraAge }, (result) => {
      finishGameAction(result);
      if (result.ok && result.room.gameState?.game === "guess-the-era") {
        setSubmittedEraGuess({ photoNumber: result.room.gameState.photoNumber, age: eraAge });
      }
    });
  }

  function closeEraGuesses() {
    setIsWorking(true);
    getSocket().emit("closeEraGuesses", finishGameAction);
  }

  function nextEraPhoto() {
    setIsWorking(true);
    getSocket().emit("nextEraPhoto", finishGameAction);
  }

  function submitTriviaAnswer(optionIndex: number) {
    setIsWorking(true);
    getSocket().emit("submitTriviaAnswer", { optionIndex }, (result) => {
      finishGameAction(result);
      if (result.ok && result.room.gameState?.game === "trivia") {
        setSelectedTriviaAnswer({ questionNumber: result.room.gameState.questionNumber, optionIndex });
      }
    });
  }

  function closeTriviaAnswers() {
    setIsWorking(true);
    getSocket().emit("closeTriviaAnswers", finishGameAction);
  }

  function nextTriviaQuestion() {
    setIsWorking(true);
    getSocket().emit("nextTriviaQuestion", finishGameAction);
  }

  if (room) {
    const isHost = room.hostId === playerId;

    if (room.status === "playing" && room.gameState) {
      const game = room.gameState;

      if (game.game === "guess-the-era") {
        const submittedAge = submittedEraGuess?.photoNumber === game.photoNumber ? submittedEraGuess.age : null;
        const orderedGuesses = game.phase === "revealed"
          ? [...game.guesses].sort((left, right) => Math.abs(left.age - game.correctAge) - Math.abs(right.age - game.correctAge))
          : [];

        return (
          <main className="site-shell">
            <Confetti />
            <nav className="nav"><Brand /><button className="text-button" onClick={leaveRoom}>Leave room</button></nav>
            <section className="era-game">
              <div className="game-progress">
                <span>Guess the Era</span>
                <strong>Photo {game.photoNumber} of {game.totalPhotos}</strong>
              </div>
              <div className="game-with-leaderboard">
                <article className="era-card">
                  <div className="era-photo">
                    <Image src={game.imageUrl} alt={`Stephanie era photo ${game.photoNumber}`} fill sizes="(max-width: 800px) 100vw, 700px" priority />
                  </div>
                  <div className="era-controls">
                  {game.phase === "guessing" ? (
                    <>
                      <span className="eyebrow">How old was Stephanie?</span>
                      <div className="age-picker">
                        <button type="button" onClick={() => setEraAge((age) => Math.max(0, age - 1))} disabled={eraAge === 0 || isWorking} aria-label="Decrease age">−</button>
                        <label><strong>{eraAge}</strong><span>years old</span></label>
                        <button type="button" onClick={() => setEraAge((age) => Math.min(30, age + 1))} disabled={eraAge === 30 || isWorking} aria-label="Increase age">+</button>
                      </div>
                      <input className="age-slider" type="range" min="0" max="30" value={eraAge} onChange={(event) => setEraAge(Number(event.target.value))} aria-label="Stephanie's age" />
                      <button className="primary-button" disabled={isWorking} onClick={submitEraGuess}>{submittedAge === null ? "Lock in my guess" : "Update my guess"}</button>
                      <p className="vote-status">{submittedAge === null ? "Choose an age from 0 to 30" : `Your guess: ${submittedAge}`} · {game.guessesReceived}/{room.players.length} guessed</p>
                      {isHost ? <button className="text-button close-guesses" disabled={isWorking} onClick={closeEraGuesses}>Close guesses & reveal</button> : <p className="waiting"><span /><span /><span /> Waiting for the host to reveal the age</p>}
                    </>
                  ) : (
                    <>
                      <span className="eyebrow">The big reveal</span>
                      <div className="correct-age"><strong>{game.correctAge}</strong><span>years old</span></div>
                      <div className="era-results">
                        {orderedGuesses.length === 0 ? <p>No guesses this round.</p> : orderedGuesses.map((guess) => (
                          <div key={guess.playerId}>
                            <strong>{guess.playerName}</strong><span>guessed {guess.age}</span><b>{Math.abs(guess.age - game.correctAge) === 0 ? "Spot on!" : `${Math.abs(guess.age - game.correctAge)} away`}</b>
                          </div>
                        ))}
                      </div>
                      {isHost ? <button className="primary-button host-control" disabled={isWorking} onClick={nextEraPhoto}>{game.photoNumber === game.totalPhotos ? "Finish game" : "Next photo →"}</button> : <p className="waiting"><span /><span /><span /> Waiting for the host</p>}
                    </>
                  )}
                  {error && <p className="form-error" role="alert">{error}</p>}
                  </div>
                </article>
                <Leaderboard entries={room.leaderboard} playerId={playerId} />
              </div>
            </section>
          </main>
        );
      }

      if (game.game === "trivia") {
        const selectedOption = selectedTriviaAnswer?.questionNumber === game.questionNumber
          ? selectedTriviaAnswer.optionIndex
          : null;
        const totalAnswers = game.phase === "revealed"
          ? game.answerCounts.reduce((total, count) => total + count, 0)
          : 0;

        return (
          <main className="site-shell">
            <Confetti />
            <nav className="nav"><Brand /><button className="text-button" onClick={leaveRoom}>Leave room</button></nav>
            <section className="steph-game">
              <div className="game-progress">
                <span>Birthday Trivia</span>
                <strong>Question {game.questionNumber} of {game.totalQuestions}</strong>
              </div>
              <div className="game-with-leaderboard">
                <article className="question-card trivia-card">
                  <span className="eyebrow">Choose the best answer</span>
                  <h1>{game.question}</h1>
                  <div className="trivia-options">
                    {game.options.map((option, optionIndex) => {
                      const isCorrect = game.phase === "revealed" && optionIndex === game.correctOptionIndex;
                      const isWrongSelection = game.phase === "revealed" && optionIndex === selectedOption && !isCorrect;
                      const count = game.phase === "revealed" ? game.answerCounts[optionIndex] : 0;
                      const percent = totalAnswers ? Math.round(count / totalAnswers * 100) : 0;
                      return (
                        <button
                          className={`trivia-option${selectedOption === optionIndex ? " selected" : ""}${isCorrect ? " correct" : ""}${isWrongSelection ? " incorrect" : ""}`}
                          disabled={isWorking || game.phase === "revealed"}
                          key={option}
                          onClick={() => submitTriviaAnswer(optionIndex)}
                          type="button"
                          aria-pressed={selectedOption === optionIndex}
                        >
                          <span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                          <strong>{option}</strong>
                          {game.phase === "revealed" && <small>{count} · {percent}%</small>}
                        </button>
                      );
                    })}
                  </div>
                  {game.phase === "answering" ? (
                    <>
                      <p className="vote-status">{selectedOption === null ? "Choose your answer" : `Answer locked: ${game.options[selectedOption]}`} · {game.answersReceived}/{room.players.length} answered</p>
                      {isHost ? <button className="primary-button host-control" disabled={isWorking} onClick={closeTriviaAnswers}>Close answers & reveal</button> : <p className="waiting"><span /><span /><span /> Waiting for the host to reveal the answer</p>}
                    </>
                  ) : isHost ? (
                    <button className="primary-button host-control" disabled={isWorking} onClick={nextTriviaQuestion}>{game.questionNumber === game.totalQuestions ? "Finish game" : "Next question →"}</button>
                  ) : <p className="waiting"><span /><span /><span /> Waiting for the host</p>}
                  {error && <p className="form-error" role="alert">{error}</p>}
                </article>
                <Leaderboard entries={room.leaderboard} playerId={playerId} />
              </div>
            </section>
          </main>
        );
      }

      const selectedVote = selectedAnswer?.questionNumber === game.questionNumber ? selectedAnswer.answer : null;
      const totalVotes = game.phase === "revealed" ? game.trueVotes + game.falseVotes : 0;
      const truePercent = totalVotes ? Math.round((game.phase === "revealed" ? game.trueVotes : 0) / totalVotes * 100) : 0;
      const falsePercent = totalVotes ? 100 - truePercent : 0;

      return (
        <main className="site-shell">
          <Confetti />
          <nav className="nav"><Brand /><button className="text-button" onClick={leaveRoom}>Leave room</button></nav>
          <section className="steph-game">
            <div className="game-progress">
              <span>Steph did that!?</span>
              <strong>Question {game.questionNumber} of {game.totalQuestions}</strong>
            </div>
            <div className="game-with-leaderboard">
            <article className="question-card">
              <span className="eyebrow">True story or total fiction?</span>
              <h1>{game.question}</h1>

              {game.phase === "voting" ? (
                <>
                  <div className="answer-grid">
                    <button className={selectedVote === true ? "answer true selected" : "answer true"} disabled={isWorking} onClick={() => vote(true)} aria-pressed={selectedVote === true}>
                      <span>✓</span><strong>True</strong>
                    </button>
                    <button className={selectedVote === false ? "answer false selected" : "answer false"} disabled={isWorking} onClick={() => vote(false)} aria-pressed={selectedVote === false}>
                      <span>×</span><strong>False</strong>
                    </button>
                  </div>
                  <p className="vote-status">{selectedVote === null ? "Choose your answer" : `Answer locked: ${selectedVote ? "True" : "False"}`} · {game.votesReceived}/{room.players.length} voted</p>
                  {isHost ? (
                    <button className="primary-button host-control" disabled={isWorking} onClick={closeAnswers}>Close answers & reveal</button>
                  ) : <p className="waiting"><span /><span /><span /> Waiting for the host to reveal the answer</p>}
                </>
              ) : (
                <>
                  <div className={game.correctAnswer ? "correct-answer true" : "correct-answer false"}>
                    The correct answer is <strong>{game.correctAnswer ? "True" : "False"}!</strong>
                  </div>
                  <div className="results" aria-label="Voting results">
                    <div><span><strong>True</strong><b>{game.trueVotes} vote{game.trueVotes === 1 ? "" : "s"}</b></span><i><em style={{ width: `${truePercent}%` }} /></i></div>
                    <div><span><strong>False</strong><b>{game.falseVotes} vote{game.falseVotes === 1 ? "" : "s"}</b></span><i><em style={{ width: `${falsePercent}%` }} /></i></div>
                  </div>
                  {isHost ? (
                    <button className="primary-button host-control" disabled={isWorking} onClick={nextQuestion}>
                      {game.questionNumber === game.totalQuestions ? "Finish game" : "Next question →"}
                    </button>
                  ) : <p className="waiting"><span /><span /><span /> Waiting for the host</p>}
                </>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
            </article>
            <Leaderboard entries={room.leaderboard} playerId={playerId} />
            </div>
          </section>
        </main>
      );
    }

    return (
      <main className="site-shell">
        <Confetti />
        <nav className="nav"><Brand /><button className="text-button" onClick={leaveRoom}>Leave room</button></nav>
        <section className="room-panel">
          <div className="room-heading">
            <div>
              <span className="eyebrow">Steph&apos;s Turning 30!!!!</span>
              <h1>Stephanie&apos;s Party Room!</h1>
              <p>Who knows steph best?</p>
            </div>
            <button className="room-code" onClick={copyInvite} aria-label="Copy room code">
              <small>ROOM CODE</small><strong>{room.code}</strong><span>{copied ? "Copied!" : "Click to copy"}</span>
            </button>
          </div>

          <div className="lobby-grid">
            <section className="players-card">
              <div className="section-title"><h2>Party people</h2></div>
              <div className="player-list">
                {room.players.map((player, index) => (
                  <div className="player" key={player.id}>
                    <span className={`avatar avatar-${index % 4}`}>{player.name.charAt(0).toUpperCase()}</span>
                    <strong>{player.name}{player.id === playerId ? " (you)" : ""}</strong>
                    {player.id === room.hostId && <span className="host-badge">Host</span>}
                    <span className="player-points">{room.leaderboard.find(({ playerId: id }) => id === player.id)?.points ?? 0} pts</span>
                  </div>
                ))}
              </div>
              <div className="waiting"><span /><span /><span /> Waiting for more friends</div>
            </section>

            <section className="games-section">
              <div className="section-title"><h2>Pick a game</h2><span>More coming soon</span></div>
              <div className="game-grid compact">
                {games.map((game) => <GameCard key={game.title} {...game} selected={room.selectedGame === game.id} onSelect={isHost && game.available ? () => selectGame(game.id) : undefined} />)}
              </div>
              {isHost && (
                <button className="primary-button start-button" disabled={!games.some((game) => game.id === room.selectedGame && game.available) || isWorking} onClick={startGame}>
                  {room.selectedGame === "steph-did-that" ? "Start Steph did that!?" : room.selectedGame === "guess-the-era" ? "Start Guess the Era" : room.selectedGame === "trivia" ? "Start Birthday Trivia" : "Choose a game to start"}
                </button>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="site-shell landing-shell">
      <header className="surprise-banner">Suprise Stephanie!</header>
      <section className="landing-sign-in">
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
    </main>
  );
}

function Brand() {
  return <a className="brand" href="#"><span>★</span> surprise<span>party!</span></a>;
}

function Confetti() {
  return <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>;
}

function GameCard({ icon, title, description, color, available, selected = false, onSelect }: (typeof games)[number] & { selected?: boolean; onSelect?: () => void }) {
  const content = <><div className="game-icon">{icon}</div><div><h3>{title}</h3><p>{description}</p></div><span className={available ? "coming-soon ready" : "coming-soon"}>{available ? "Ready" : "Soon"}</span></>;
  return onSelect
    ? <button className={`game-card ${color} selectable${selected ? " selected" : ""}`} onClick={onSelect} type="button" aria-pressed={selected}>{content}</button>
    : <article className={`game-card ${color}${selected ? " selected" : ""}`}>{content}</article>;
}

function Leaderboard({ entries, playerId }: { entries: RoomState["leaderboard"]; playerId: string | null }) {
  return (
    <aside className="leaderboard" aria-label="Leaderboard">
      <span className="eyebrow">Leaderboard</span>
      <h2>Party points</h2>
      <ol>
        {entries.map((entry, index) => (
          <li key={entry.playerId} className={entry.playerId === playerId ? "current-player" : ""}>
            <span className="rank">{index + 1}</span>
            <strong>{entry.playerName}{entry.playerId === playerId ? " (you)" : ""}</strong>
            <b>{entry.points}</b>
          </li>
        ))}
      </ol>
    </aside>
  );
}
