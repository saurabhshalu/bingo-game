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
    connectedCount, loading, turnDeadline, reactions, chatFlashes,
    sendReaction, playRandom, kickPlayer,
  } = useContext(SocketContext);

  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
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

  // 10s turn timer — auto-play random when expired
  useEffect(() => {
    hasActedRef.current = false; // fresh turn
    if (!turnDeadline || !started || finished || !currentPlayer) return;
    const me = players.find((p) => p.playerId === playerId);
    if (!me || me.id !== currentPlayer) return;
    const interval = setInterval(() => {
      if (hasActedRef.current) return;
      if (Date.now() >= turnDeadline) { hasActedRef.current = true; playRandom(); }
    }, 200);
    return () => clearInterval(interval);
  }, [turnDeadline, started, finished, currentPlayer, playerId, players, playRandom]);

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

  return (
    <>
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
        <div className="pt-4 text-center">
          <h1 className="text-5xl sm:text-6xl englebert-regular text-neutral-50">
            <span className={`transition-colors ${BINGO_LENGTH > 0 ? "text-amber-300" : ""}`}>B</span>
            <span className={`transition-colors ${BINGO_LENGTH > 1 ? "text-amber-300" : ""}`}>I</span>
            <span className={`transition-colors ${BINGO_LENGTH > 2 ? "text-amber-300" : ""}`}>N</span>
            <span className={`transition-colors ${BINGO_LENGTH > 3 ? "text-amber-300" : ""}`}>G</span>
            <span className={`transition-colors ${BINGO_LENGTH > 4 ? "text-amber-300" : ""}`}>O</span>
            <span className="text-neutral-300"> Extended</span>
          </h1>
          <div style={{ fontFamily: "monospace" }} className="text-amber-100 flex gap-4 text-center justify-center mt-1 text-sm">
            <div>Room: {roomId} <button onClick={copyInviteLink} className="hover:text-white ml-1">📋</button></div>
            <div>Game #{gameCount}</div>
          </div>
        </div>

        {/* Players */}
        <div className="flex gap-2 max-w-2xl w-full px-3 py-1">
          {players.map((player) => {
            const isTurn = player.id === currentPlayer;
            const isMe = player.playerId === playerId;
            const showTimer = isTurn && started && !finished && turnDeadline;
            return (
              <div key={player.playerId} className="relative shrink-0 flex flex-col items-center px-1">
                <div className="relative">
                  {showTimer && (
                    <TurnTimer deadline={turnDeadline} size={54} strokeWidth={3} />
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
                          <span className="text-sm font-bold">
                            {player.name.split(" ").map((i) => i[0]).join("")}
                          </span>
                        </Avatar>
                      </button>
                    </Badge>
                  </motion.div>
                  {!player.connected && (
                    <div className="absolute -bottom-0.5 -right-0.5 flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900" />
                      {isOwner && !started && (
                        <button onClick={() => kickPlayer(player.playerId)}
                          className="w-4 h-4 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center border border-gray-900 ml-0.5 text-white text-[9px] font-bold"
                          title={`Kick ${player.name}`}>×</button>
                      )}
                    </div>
                  )}
                </div>
                <span className={`text-[10px] mt-0.5 truncate max-w-[48px] ${isMe ? "text-white font-medium" : "text-neutral-400"}`}>
                  {isMe ? "You" : player.name.split(" ")[0]}
                </span>
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
          className="relative grid gap-2 p-4 bg-gray-100 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`,
            width: 'min(100%, 42rem, calc(100dvh - 260px))',
            height: 'min(100%, 42rem, calc(100dvh - 260px))',
            aspectRatio: '1 / 1',
          }}
        >
          {board.map((item, index) => (
            <Block number={item} key={item} handleClick={() => playMove(item)}
              selection={selection} index={index} CORRECT_ANSWER_LIST={CORRECT_ANSWER_LIST} />
          ))}

          {started && !finished && connectedCount < 2 && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <span className="bg-black/80 text-white px-5 py-2 rounded-full text-sm font-medium shadow-xl backdrop-blur-sm" style={{ WebkitBackdropFilter: 'blur(4px)' }}>
                Waiting for players…
              </span>
            </div>
          )}

          {winners.length === 0 && started && !finished && !isMyTurn && connectedCount >= 2 && (
            <div className="absolute inset-0 top-[-15px] z-10 pointer-events-none">
              <span className="bg-black/40 text-white px-5 py-2 rounded-full text-sm shadow-xl backdrop-blur-sm" style={{ WebkitBackdropFilter: 'blur(4px)' }}>
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
