import { useContext, useMemo, useRef, useState, useEffect, useCallback } from "react";
import Block from "../components/Block";
import { SocketContext } from "../context/SocketContext";
import { Navigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Avatar, Badge } from "@mui/material";
import toast from "react-hot-toast";
import playLogo from "/play.svg";
import GameOver from "../components/GameOver";
import VolumeToggle from "../components/VolumeToggle";
import ChatPanel from "../components/ChatPanel";
import TurnTimer from "../components/TurnTimer";
import { LogOut } from "lucide-react";
import { audioManager } from "../helper/audio.js";
import ConfettiEffect from "../components/ConfettiEffect.jsx";

const VoteKickCountdown = ({ deadline, yesCount, noCount, totalDuration = 30000 }) => {
  const [remaining, setRemaining] = useState(Math.max(0, deadline - Date.now()));
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [deadline]);
  const progress = Math.max(0, Math.min(1, remaining / totalDuration));
  const seconds = Math.ceil(remaining / 1000);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-white text-xs font-medium">Voting ends in <span className="text-amber-300 font-bold">{seconds}s</span></span>
        <div className="flex gap-3 text-xs">
          <span className="text-green-400 font-bold">✅ {yesCount}</span>
          <span className="text-red-400 font-bold">❌ {noCount}</span>
        </div>
      </div>
      <div className="h-2.5 w-full bg-neutral-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: progress > 0.5 ? '#22C55E' : progress > 0.25 ? '#EAB308' : '#EF4444' }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.05 }}
        />
      </div>
    </div>
  );
};

const getCorrectAnswerList = (size = 5) => {
  const answers = { horizontal: [], vertical: [], diagonal1: [], diagonal2: [] };
  for (let i = 0; i < size; i++) {
    const list1 = [], list2 = [];
    for (let j = 0; j < size; j++) {
      list1.push(i * size + j + 1);
      list2.push(i + 1 + j * size);
    }
    answers.horizontal.push(list1);
    answers.vertical.push(list2);
    answers.diagonal1.push(i * size + (i + 1));
    answers.diagonal2.push(size - i + size * i);
  }
  return answers;
};

const getPlayerBingoCount = (playerBoard, userSelection, boardSize) => {
  const answers = getCorrectAnswerList(boardSize);
  const allLines = [
    ...answers.horizontal,
    ...answers.vertical,
    answers.diagonal1,
    answers.diagonal2,
  ];
  return allLines.filter((path) =>
    path.every((item) => userSelection[playerBoard[item - 1]])
  ).length;
};

const QUICK_EMOJIS = ["😂","😭","🎉","🏆","👏","🔥","💔","🤯","😮","🚀"];
const ALL_EMOJIS = [
  "😂","🔥","👏","🎉","😮","🚀","🤯","⚡","🎯","🏆",
  "👑","🐉","💯","✨","🫡","🤝","❤️","💔","😤","😭",
  "🥳","🤩","😎","🤠","👻","💀","🍀","🎲","⭐","☠️"
];

const Game = () => {
  const {
    board, socketRef, selection, roomId, players, currentPlayer,
    started, finished, winners, gameCount, playerId, ownerPlayerId,
    connectedCount, loading, turnDeadline, reactions, chatFlashes, recentMoves,
    winsToReach, tournamentFinished, tournamentWinners, gameStartTime, updateConfig,
    sendReaction, playRandom, initiateVoteKick, castVoteKick, cancelVoteKick, voteKick,
  } = useContext(SocketContext);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [confirmVoteTarget, setConfirmVoteTarget] = useState(null);
  const [votedKick, setVotedKick] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const prevBingoLength = useRef(0);
  const hasActedRef = useRef(false);

  const size = useMemo(() => Math.floor(Math.sqrt(Object.keys(selection).length)), [selection]);
  const CORRECT_ANSWER_LIST = useMemo(() => getCorrectAnswerList(size), [size]);
  const BINGO_LIST = useMemo(() => [
    CORRECT_ANSWER_LIST.diagonal1, CORRECT_ANSWER_LIST.diagonal2,
    ...CORRECT_ANSWER_LIST.horizontal, ...CORRECT_ANSWER_LIST.vertical,
  ].filter((path) => path.every((item) => selection[board[item - 1]] && true)), [CORRECT_ANSWER_LIST, board, selection]);
  const BINGO_LENGTH = BINGO_LIST.length;

  useEffect(() => {
    if (BINGO_LENGTH > prevBingoLength.current && BINGO_LENGTH > 0) {
      audioManager.playChime(BINGO_LENGTH);
    }
    prevBingoLength.current = BINGO_LENGTH;
  }, [BINGO_LENGTH]);

  // Reset local vote-kick state when a new vote starts
  useEffect(() => {
    if (voteKick && !voteKick.voteResult) {
      setVotedKick(false);
    }
  }, [voteKick?.targetPlayerId]);

  // Auto-scroll to top when virtual keyboard closes (mobile)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let prevHeight = vv.height;
    const onResize = () => {
      const newHeight = vv.height;
      if (newHeight > prevHeight * 1.1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      prevHeight = newHeight;
    };
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Elapsed game timer
  useEffect(() => {
    if (!gameStartTime) { setElapsedTime(0); return; }
    const tick = () => setElapsedTime(Math.floor((Date.now() - gameStartTime) / 1000));
    tick();
    if (tournamentFinished || connectedCount < 2) return; // freeze when waiting
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [gameStartTime, tournamentFinished, connectedCount]);

  const formatElapsed = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // 10s turn timer — auto-play random when expired
  useEffect(() => {
    hasActedRef.current = false; // fresh turn
    if (!turnDeadline || !started || finished || !currentPlayer || connectedCount < 2 || voteKick) return;
    const me = players.find((p) => p.playerId === playerId);
    if (!me || me.id !== currentPlayer) return;
    const interval = setInterval(() => {
      if (hasActedRef.current) return;
      if (Date.now() >= turnDeadline) { hasActedRef.current = true; playRandom(); }
    }, 200);
    return () => clearInterval(interval);
  }, [turnDeadline, started, finished, currentPlayer, playerId, players, playRandom, connectedCount, voteKick]);

  const playMove = useCallback((number) => {
    hasActedRef.current = true; // prevent timer from firing after manual move
    socketRef.current.emit("playMove", number);
  }, [socketRef]);

  if (loading) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-green-400 border-t-transparent rounded-full animate-spin mb-3" />
        <p>Connecting...</p>
      </main>
    );
  }
  if (!board || board.length === 0) return <Navigate to="/" replace />;

  const handlePlayStart = () => {
    if (connectedCount < 2) return toast.error("At least 2 players required!");
    socketRef.current.emit("playStart");
  };
  const handleRestart = () => {
    if (connectedCount < 2) return toast.error("At least 2 players required!");
    socketRef.current.emit("playRestart");
  };
  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/game/${roomId}`).then(() => toast.success("Copied!"));
  };

  const isMyTurn = currentPlayer === socketRef.current?.id;
  const isOwner = playerId === ownerPlayerId;
  const currentPlayerObj = players.find((p) => p.id === currentPlayer);

  const roundWinConfetti = finished && !tournamentFinished && winners.some((w) => w.playerId === playerId);
  const tournamentConfetti = tournamentFinished && tournamentWinners.some((w) => w.playerId === playerId);

  const winsNeeded = winsToReach > 1 ? winsToReach : 1;
  const showingTournamentWin = tournamentFinished && tournamentWinners.length > 0;

  return (
    <>
      <ConfettiEffect trigger={roundWinConfetti} mode="round" />
      <ConfettiEffect trigger={tournamentConfetti} mode="tournament" />
      <VolumeToggle />
      <button
        onClick={() => setShowExitDialog(true)}
        className="fixed top-14 right-4 z-40 bg-neutral-700/50 hover:bg-red-600/70 text-white p-2 rounded-full transition-colors"
        title="Leave game"
      >
        <LogOut size={18} />
      </button>
      <motion.main
        initial={{ y: "100vh" }}
        animate={{ y: 0 }}
        transition={{ type: "spring" }}
        className="min-h-[100dvh] m-auto flex flex-col gap-4 pb-6 items-center"
      >
        {/* Header */}
        <div className="pt-3 text-center w-full px-3">
          <h1 className="text-4xl sm:text-5xl englebert-regular text-neutral-50 leading-tight">
            <span className={`transition-colors ${BINGO_LENGTH > 0 ? "text-amber-300" : ""}`}>B</span>
            <span className={`transition-colors ${BINGO_LENGTH > 1 ? "text-amber-300" : ""}`}>I</span>
            <span className={`transition-colors ${BINGO_LENGTH > 2 ? "text-amber-300" : ""}`}>N</span>
            <span className={`transition-colors ${BINGO_LENGTH > 3 ? "text-amber-300" : ""}`}>G</span>
            <span className={`transition-colors ${BINGO_LENGTH > 4 ? "text-amber-300" : ""}`}>O</span>
            <span className="text-neutral-300 text-2xl sm:text-3xl"> Extended</span>
          </h1>

          {/* Info row */}
          <div className="flex flex-col items-center mt-1.5 gap-0.5">
            {/* Line 1: Room + total games */}
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <span>Room {roomId} <button onClick={copyInviteLink} className="hover:text-white">📋</button></span>
              <span className="text-neutral-600">|</span>
              <span className="text-neutral-300">Games played: {gameCount}</span>
            </div>
            {/* Line 2: Target + timer */}
            <div className="flex items-center gap-2 text-[11px]">
              {winsToReach > 1 ? (
                <span className="text-green-300">Target: {winsToReach} wins</span>
              ) : (
                <span className="text-neutral-500">Single round</span>
              )}
              {gameStartTime && (
                <>
                  <span className="text-neutral-600">|</span>
                  <span className="text-amber-200 font-mono">⏱ {formatElapsed(elapsedTime)}</span>
                </>
              )}
              {isOwner && !started && (
                <>
                  <span className="text-neutral-600">|</span>
                  <select
                    value={winsToReach}
                    onChange={(e) => updateConfig({ winsToReach: parseInt(e.target.value, 10) })}
                    className="bg-neutral-800/80 text-white text-[10px] rounded px-1.5 py-0.5 outline-none cursor-pointer border border-neutral-600"
                  >
                    <option value={1}>Single</option>
                    {Array.from({length: 30}, (_, i) => i + 2).map(n => (
                      <option key={n} value={n}>First to {n}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Players */}
        <div className="flex gap-2 max-w-2xl w-full px-3 py-1">
          {players.map((player) => {
            const isTurn = player.id === currentPlayer;
            const isMe = player.playerId === playerId;
            const showTimer = isTurn && started && turnDeadline && !tournamentFinished && !voteKick && connectedCount >= 2;
            return (
              <div key={player.playerId} className="relative shrink-0 flex flex-col items-center px-1">
                <div className="relative">
                  {showTimer && (
                    <TurnTimer deadline={turnDeadline} paused={finished} size={54} strokeWidth={3} />
                  )}
                  <motion.div
                    animate={isTurn && player.connected ? { scale: [1, 0.9, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <Badge showZero badgeContent={player.win} color="info" overlap="circular">
                      <button
                        onClick={() => { if (!isMe && player.connected) setEmojiPickerOpen(player.playerId); }}
                        disabled={isMe || !player.connected}
                        className="block outline-none rounded-full"
                      >
                        <Avatar style={{
                          height: 46, width: 46,
                          background: isTurn ? "#05df72" : player.color || undefined,
                          opacity: player.connected ? 1 : 0.4,
                          border: isMe ? "2px solid white" : "none",
                        }}>
                          {player.avatar ? (
                            <span className="text-2xl">{player.avatar}</span>
                          ) : (
                            <span className="text-sm font-bold">{player.name.split(" ").map((i) => i[0]).join("")}</span>
                          )}
                        </Avatar>
                      </button>
                    </Badge>
                  </motion.div>
                  {(() => {
                    const recent = recentMoves[player.playerId];
                    if (!isMe && recent && Date.now() - recent.time < 2000) {
                      return (
                        <motion.div
                          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full z-10"
                          style={{ width: 46, height: 46, backgroundColor: player.color || '#666' }}
                          initial={{ scale: 1, opacity: 1 }}
                          animate={{ scale: [1, 1.4, 1.1, 1.6], opacity: [1, 1, 1, 0] }}
                          transition={{ duration: 2, ease: "easeOut" }}
                        >
                          <span className="text-xl font-bold text-white">{recent.number}</span>
                        </motion.div>
                      );
                    }
                    return null;
                  })()}
                  {isOwner && !isMe && (
                    <div className="absolute -bottom-0.5 -right-0.5 flex items-center">
                      {!player.connected && (
                        <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900" />
                      )}
                      <button onClick={() => setConfirmVoteTarget(player)}
                        className="w-4 h-4 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center border border-gray-900 ml-0.5 text-white text-[9px] font-bold"
                        title={`Vote to remove ${player.name}`}>×</button>
                    </div>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 truncate max-w-[48px] ${isMe ? "text-white font-medium" : "text-neutral-400"}`}>
                  {isMe ? "You" : player.name.split(" ")[0]}
                </span>
                {started && (
                  <div
                    className="mt-0.5 px-1.5 py-[1px] rounded-full text-[9px] font-bold"
                    style={{
                      backgroundColor: `${player.color || "#666"}30`,
                      color: player.color || "#666",
                    }}
                  >
                    {player.bingoCount || 0} lines
                  </div>
                )}
              </div>
            );
          })}

        </div>

        {/* Quick emojis + full picker trigger */}
        <div className="flex items-center gap-1 max-w-2xl w-full px-3">
          <div className="flex gap-1 items-center overflow-x-auto scrollbar-hide">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} onClick={() => sendReaction(emoji)}
                className="text-xl p-1 rounded hover:bg-white/5 hover:scale-110 transition-all active:scale-90 shrink-0">{emoji}</button>
            ))}
          </div>
          <button onClick={() => setEmojiPickerOpen('board')}
            className="text-sm p-1.5 rounded hover:bg-white/5 transition-all active:scale-90 ml-1 text-neutral-400 hover:text-white shrink-0">➕</button>
        </div>

        {/* Board */}
        <div
          className="relative grid gap-2 p-4 bg-gray-100 mx-auto w-full max-w-2xl shrink-0"
          style={{
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`,
            aspectRatio: '1 / 1',
          }}
        >
          {board.map((item, index) => {
            const recentMoverColor = (() => {
              for (const [pid, data] of Object.entries(recentMoves)) {
                if (data.number === item && Date.now() - data.time < 2000) {
                  const mover = players.find((p) => p.playerId === pid);
                  return mover?.color || "#666";
                }
              }
              return null;
            })();
            return (
              <div key={item} className="relative">
                <Block number={item} handleClick={() => playMove(item)}
                  selection={selection} index={index} CORRECT_ANSWER_LIST={CORRECT_ANSWER_LIST} />
                {recentMoverColor && (
                  <motion.div
                    className="absolute inset-0 rounded-sm pointer-events-none z-10"
                    style={{ border: `3px solid ${recentMoverColor}` }}
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: [1, 1.15, 1], opacity: [1, 0.8, 0] }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                )}
              </div>
            );
          })}

          {started && !finished && connectedCount < 2 && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span className="bg-black/80 text-white px-5 py-2 rounded-full text-sm font-medium shadow-xl backdrop-blur-sm" style={{ WebkitBackdropFilter: 'blur(4px)' }}>
                Waiting for players…
              </span>
            </div>
          )}

          {winners.length === 0 && started && !finished && !isMyTurn && connectedCount >= 2 && (
            <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
              <span className="bg-black/20 text-white px-5 py-2 rounded-full text-sm shadow-xl" style={{ WebkitBackdropFilter: 'blur(4px)' }}>
                Wait for <b>{currentPlayerObj?.name || "…"}</b>&apos;s turn
              </span>
            </div>
          )}

          {!started && (
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10" style={{ WebkitBackdropFilter: 'blur(1px)' }}>
              {isOwner ? (
                <motion.img onClick={handlePlayStart}
                  whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.8 }}
                  src={playLogo} alt="play" className="h-24 w-24 cursor-pointer" />
              ) : (
                <span className="bg-white p-3 rounded text-center text-sm">
                  Waiting for {players.find((p) => p.playerId === ownerPlayerId)?.name || "owner"} to start
                </span>
              )}
            </div>
          )}

          <GameOver handleRestart={handleRestart} />
        </div>

        <ChatPanel />
      </motion.main>

      {/* Floating emojis */}
      <AnimatePresence>
        {reactions.map((r) => (
          <motion.div key={r.id}
            initial={{ opacity: 0, y: 0, scale: 0.3 }}
            animate={{ opacity: [0, 1, 1, 0], y: -150, scale: [0.3, 1.2, 1, 0.7] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.5, ease: "easeOut" }}
            className="fixed pointer-events-none z-40 flex flex-col items-center"
            style={{ left: `${r.x}%`, bottom: `${r.y}%` }}>
            <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
            <span className="text-[10px] text-white font-bold bg-black/40 px-2 py-0.5 rounded-full mt-1">{r.fromName}</span>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Floating chat messages */}
      <AnimatePresence>
        {chatFlashes.map((m) => (
          <motion.div key={m.id}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], y: -120, scale: [0.5, 1, 1, 0.8] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3.5, ease: "easeOut" }}
            className="fixed pointer-events-none z-40"
            style={{ left: `${m.x}%`, bottom: `${m.y}%` }}>
            <div className="bg-black/75 text-white text-sm px-4 py-2 rounded-2xl rounded-bl-none shadow-lg backdrop-blur-sm max-w-[260px]" style={{ WebkitBackdropFilter: 'blur(4px)' }}>
              <span className="text-[10px] text-amber-300 font-bold block mb-0.5">{m.name}</span>
              <span className="break-words">{m.text}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Full Emoji Picker Modal */}
      <AnimatePresence>
        {emojiPickerOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setEmojiPickerOpen(false)}>
            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              className="bg-white rounded-xl p-4 shadow-2xl max-w-[280px] w-full mx-4"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-gray-700">React!</h3>
                <button onClick={() => setEmojiPickerOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {ALL_EMOJIS.map((emoji) => (
                  <button key={emoji}
                    onClick={() => { sendReaction(emoji, emojiPickerOpen !== 'board' ? emojiPickerOpen : null); setEmojiPickerOpen(false); }}
                    className="text-xl p-1.5 rounded hover:bg-gray-100 transition-colors active:scale-90">
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vote Kick Confirmation Dialog */}
      <AnimatePresence>
        {confirmVoteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center"
            style={{ WebkitBackdropFilter: 'blur(4px)' }}
            onClick={() => setConfirmVoteTarget(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-neutral-800 border border-neutral-600 rounded-xl p-6 shadow-2xl max-w-xs w-full mx-4 text-center"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-white font-bold text-lg mb-1">Vote to Remove?</h3>
              <p className="text-neutral-300 text-sm mb-5">
                Start a 30-second vote to remove <b>{confirmVoteTarget.name}</b> from the room.
              </p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setConfirmVoteTarget(null)}
                  className="px-4 py-2 rounded-md bg-neutral-600 hover:bg-neutral-500 text-white text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button onClick={() => { initiateVoteKick(confirmVoteTarget.playerId); setConfirmVoteTarget(null); }}
                  className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
                  Start Vote
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Vote Kick Dialog */}
      <AnimatePresence>
        {voteKick && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
            style={{ WebkitBackdropFilter: 'blur(6px)' }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-neutral-800 border border-neutral-600 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 text-center">

              {!voteKick.voteResult ? (
                <>
                  {/* Target Avatar */}
                  <div className="flex justify-center mb-3">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg ring-4 ring-red-500/40"
                        style={{ backgroundColor: voteKick.targetColor || '#EF4444' }}>
                        {voteKick.targetAvatar ? (
                          <span className="text-3xl">{voteKick.targetAvatar}</span>
                        ) : (
                          voteKick.targetName?.split(" ").map((i) => i[0]).join("")
                        )}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-neutral-800">
                        KICK
                      </div>
                    </div>
                  </div>

                  <h3 className="text-white font-bold text-lg mb-0.5">Vote in Progress</h3>
                  <p className="text-neutral-400 text-sm mb-4">
                    {playerId === voteKick.targetPlayerId
                      ? "Players are voting to remove you from the room."
                      : isOwner
                        ? `You initiated a vote to remove ${voteKick.targetName}.`
                        : `Remove ${voteKick.targetName} from the room?`}
                  </p>

                  {isOwner && (
                    <div className="text-green-400 text-sm font-medium mb-4 bg-green-500/10 rounded-lg py-2">
                      ✅ You voted YES (owner)
                    </div>
                  )}

                  {playerId !== voteKick.targetPlayerId && !isOwner && !votedKick && (
                    <div className="flex gap-3 justify-center mb-4">
                      <button onClick={() => { castVoteKick(voteKick.targetPlayerId, false); setVotedKick(true); }}
                        className="flex-1 max-w-[100px] py-2.5 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-bold transition-all active:scale-95 border border-neutral-600">
                        ❌ NO
                      </button>
                      <button onClick={() => { castVoteKick(voteKick.targetPlayerId, true); setVotedKick(true); }}
                        className="flex-1 max-w-[100px] py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all active:scale-95 shadow-lg shadow-red-500/20">
                        ✅ YES
                      </button>
                    </div>
                  )}

                  {playerId !== voteKick.targetPlayerId && !isOwner && votedKick && (
                    <div className="text-neutral-400 text-sm mb-4 py-2 bg-neutral-700/40 rounded-lg">
                      🗳️ You have voted. Waiting for others…
                    </div>
                  )}

                  {voteKick.targetPlayerId === playerId && (!voteKick.voteResult) && (
                    <div className="text-amber-300 text-sm mb-4 py-2 bg-amber-500/10 rounded-lg">
                      ⌛ 30-second vote in progress…
                    </div>
                  )}

                  {voteKick.deadline && (
                    <VoteKickCountdown deadline={voteKick.deadline} yesCount={voteKick.yesCount} noCount={voteKick.noCount} totalDuration={30000} />
                  )}

                  {isOwner && (
                    <button onClick={() => cancelVoteKick()}
                      className="mt-4 text-xs text-neutral-500 hover:text-red-400 underline underline-offset-2 transition-colors">
                      Cancel this vote
                    </button>
                  )}
                </>
              ) : (
                <>
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-3 ${voteKick.voteResult.removed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {voteKick.voteResult.removed ? '✅' : '❌'}
                  </div>
                  <h3 className="text-white font-bold text-xl mb-1">
                    {voteKick.voteResult.removed ? 'Player Removed' : 'Vote Rejected'}
                  </h3>
                  <p className="text-neutral-400 text-sm mb-3">
                    {voteKick.voteResult.removed
                      ? <><b className="text-white">{voteKick.targetName}</b> was voted out of the room.</>
                      : <>Vote to remove <b className="text-white">{voteKick.targetName}</b> was rejected.</>}
                  </p>
                  <div className="flex justify-center gap-4 text-sm">
                    <span className="text-green-400 font-bold bg-green-500/10 px-3 py-1 rounded-full">YES {voteKick.voteResult.yesCount}</span>
                    <span className="text-red-400 font-bold bg-red-500/10 px-3 py-1 rounded-full">NO {voteKick.voteResult.noCount}</span>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Exit Confirmation Dialog */}
      <AnimatePresence>
        {showExitDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
            style={{ WebkitBackdropFilter: 'blur(4px)' }}
            onClick={() => setShowExitDialog(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-neutral-800 border border-neutral-600 rounded-xl p-6 shadow-2xl max-w-xs w-full mx-4 text-center"
              onClick={(e) => e.stopPropagation()}>
              <h3 className="text-white font-bold text-lg mb-2">Leave Game?</h3>
              <p className="text-neutral-300 text-sm mb-5">Are you sure you want to leave the game?</p>
              <div className="flex gap-3 justify-center">
                <button onClick={() => setShowExitDialog(false)}
                  className="px-4 py-2 rounded-md bg-neutral-600 hover:bg-neutral-500 text-white text-sm font-medium transition-colors">
                  Cancel
                </button>
                <button onClick={() => { socketRef.current?.disconnect(); window.location.href = "/"; }}
                  className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors">
                  Leave
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Game;
