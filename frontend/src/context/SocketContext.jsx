import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import PropTypes from "prop-types";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { audioManager } from "../helper/audio.js";

const socketInitialState = {
  socketRef: null,
  board: [],
  players: [],
  roomId: null,
  selection: {},
  currentPlayer: null,
  started: false,
  winners: [],
  finished: false,
  chatMessages: [],
  reactions: [],
  playerId: null,
  ownerPlayerId: null,
  name: "",
  connectedCount: 0,
  turnDeadline: null,
  voteKick: null,
  loading: true,
};

// eslint-disable-next-line react-refresh/only-export-components
export const SocketContext = createContext(socketInitialState);

const generateId = () =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);

const SocketContextProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [board, setBoard] = useState([]);
  const [players, setPlayers] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [selection, setSelection] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [started, setStarted] = useState(false);
  const [winners, setWinners] = useState([]);
  const [finished, setFinished] = useState(false);
  const [gameCount, setGameCount] = useState(0);
  const [chatMessages, setChatMessages] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [chatFlashes, setChatFlashes] = useState([]);
  const [ownerPlayerId, setOwnerPlayerId] = useState(null);
  const [recentMoves, setRecentMoves] = useState({});
  const [turnDeadline, setTurnDeadline] = useState(null);
  const [winsToReach, setWinsToReach] = useState(1);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [tournamentFinished, setTournamentFinished] = useState(false);
  const [tournamentWinners, setTournamentWinners] = useState([]);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [voteKick, setVoteKick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState(() => localStorage.getItem("bingo_player_name") || "");
  const [playerId] = useState(() => {
    let id = localStorage.getItem("bingo_player_id");
    if (!id) {
      id = generateId();
      localStorage.setItem("bingo_player_id", id);
    }
    return id;
  });

  const navigate = useNavigate();
  const playersRef = useRef(players);
  playersRef.current = players;

  const connectedCount = useMemo(
    () => players.filter((p) => p.connected).length,
    [players]
  );

  const addChatFlash = (message) => {
    const id = Date.now() + Math.random();
    const x = 15 + Math.random() * 70;
    const y = 15 + Math.random() * 25;
    setChatFlashes((prev) => [...prev, { ...message, id, x, y }]);
    setTimeout(() => {
      setChatFlashes((prev) => prev.filter((m) => m.id !== id));
    }, 3500);
  };

  const addReaction = (reaction) => {
    const id = Date.now() + Math.random();
    // Compute position based on target — floats from target's avatar area if targeted
    const currentPlayers = playersRef.current;
    const meIdx = currentPlayers.findIndex((p) => p.playerId === playerId);
    const visualOrder = meIdx >= 0
      ? [currentPlayers[meIdx], ...currentPlayers.filter((_, i) => i !== meIdx)]
      : currentPlayers;

    let x, y;
    if (reaction.targetPlayerId) {
      const targetIdx = visualOrder.findIndex((p) => p.playerId === reaction.targetPlayerId);
      const total = visualOrder.length;
      x = total <= 1 ? 50 : 15 + (targetIdx / (total - 1)) * 70;
      y = 10 + Math.random() * 10; // starts near avatar row
    } else {
      x = 15 + Math.random() * 70;
      y = 20 + Math.random() * 40;
    }
    setReactions((prev) => [...prev, { ...reaction, id, x, y }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2500);
  };

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const pathMatch = window.location.pathname.match(/^\/game\/([A-Za-z0-9]+)$/);
      const hashMatch = window.location.hash.match(/^#\/game\/([A-Za-z0-9]+)$/);
      const match = pathMatch || hashMatch;
      if (match) {
        const urlRoomId = match[1].toUpperCase();
        const storedName = localStorage.getItem("bingo_player_name") || "Player";
        socket.emit("joinRoom", { name: storedName, roomId: urlRoomId, playerId });
      }
    });

    socket.on("disconnect", () => {
      toast.error("Disconnected. Trying to reconnect...");
    });

    socket.on("reconnect", () => {
      toast.success("Reconnected!");
    });

    socket.on("join-room", ({ players, roomId, selection, gameCount, started, ownerPlayerId, turnDeadline: td, maxPlayers: mp, winsToReach: bo, gameStartTime: gst }) => {
      setPlayers(players);
      setRoomId(roomId);
      setSelection(selection);
      setGameCount(gameCount);
      setStarted(started);
      setOwnerPlayerId(ownerPlayerId);
      setTurnDeadline(td);
      if (mp != null) setMaxPlayers(mp);
      if (bo != null) setWinsToReach(bo);
      if (gst != null) setGameStartTime(gst);
      setLoading(false);
      audioManager.playJoin();
    });

    socket.on("my-board", ({ myBoard, roomId: rid }) => {
      setBoard(myBoard);
      setLoading(false);
      navigate(`/game/${rid}`);
    });

    socket.on("rejoined", ({
      roomId: rid,
      players: p,
      selection: s,
      currentPlayer: cp,
      gameCount: gc,
      started: st,
      finished: fin,
      winners: w,
      chatHistory: ch,
      myBoard,
      ownerPlayerId: oid,
      turnDeadline: td,
      maxPlayers: mp,
      winsToReach: bo,
      tournamentFinished: tf,
      tournamentWinners: tw,
      gameStartTime: gst,
    }) => {
      setBoard(myBoard);
      setPlayers(p);
      setRoomId(rid);
      setSelection(s);
      setCurrentPlayer(cp);
      setGameCount(gc);
      setStarted(st);
      setFinished(fin);
      setChatMessages(ch || []);
      setOwnerPlayerId(oid);
      setTurnDeadline(td);
      setWinners(w || []);
      if (mp != null) setMaxPlayers(mp);
      if (bo != null) setWinsToReach(bo);
      if (tf != null) setTournamentFinished(tf);
      if (tw != null) setTournamentWinners(tw);
      if (gst != null) setGameStartTime(gst);
      setLoading(false);
      navigate(`/game/${rid}`, { replace: true });
      toast.success("Rejoined the game!");
      audioManager.playJoin();
    });

    socket.on("error", ({ message }) => {
      toast.error(message);
      setLoading(false);
      audioManager.playError();
    });

    socket.on("play-move", ({ players: p, selection: s, currentPlayer: cp, lastMove, lastPlayerId, lastPlayerName, turnDeadline: td }) => {
      setSelection(s);
      setPlayers(p);
      setCurrentPlayer(cp);
      setTurnDeadline(td);
      if (lastPlayerId && lastMove != null) {
        setRecentMoves((prev) => ({ ...prev, [lastPlayerId]: { number: lastMove, time: Date.now() } }));
        setTimeout(() => {
          setRecentMoves((prev) => {
            const next = { ...prev };
            if (next[lastPlayerId]?.number === lastMove) delete next[lastPlayerId];
            return next;
          });
        }, 2000);
      }
      audioManager.playPop();
    });

    socket.on("play-started", ({ currentPlayer: cp, started: st, turnDeadline: td, winsToReach: bo, maxPlayers: mp, gameStartTime: gst }) => {
      setCurrentPlayer(cp);
      setStarted(st);
      setTurnDeadline(td);
      if (bo != null) setWinsToReach(bo);
      if (mp != null) setMaxPlayers(mp);
      if (gst != null) setGameStartTime(gst);
      audioManager.playTurnBell();
    });

    socket.on("player-left", ({ players: p, selection: s, currentPlayer: cp, leftPlayerName, ownerPlayerId: oid, turnDeadline: td }) => {
      setPlayers(p);
      setSelection(s);
      setCurrentPlayer(cp);
      setOwnerPlayerId(oid);
      setTurnDeadline(td);
      toast(() => (
        <span>
          Player &apos;<b>{leftPlayerName}</b>&apos; left the game
        </span>
      ));
      audioManager.playLeave();
    });

    socket.on("player-rejoined", ({ players: p, currentPlayer: cp, rejoinedPlayerId, turnDeadline: td }) => {
      setPlayers(p);
      setCurrentPlayer(cp);
      setTurnDeadline(td);
      const rejoiner = p.find((pl) => pl.playerId === rejoinedPlayerId);
      if (rejoiner) {
        toast.success(`${rejoiner.name} rejoined!`);
        audioManager.playJoin();
      }
    });

    socket.on("player-kicked", ({ kickedName, players: p, currentPlayer: cp, ownerPlayerId: oid }) => {
      setPlayers(p);
      setCurrentPlayer(cp);
      setOwnerPlayerId(oid);
      toast(() => (
        <span>
          <b>{kickedName}</b> was kicked from the game
        </span>
      ));
    });

    socket.on("game-over", ({ winners: w, players: p, selection: s, gameCount: gc, lastMove, lastPlayerId, lastPlayerName, turnDeadline: td, winsToReach: bo, tournamentFinished: tf, tournamentWinners: tw }) => {
      setPlayers(p);
      setSelection(s);
      setGameCount(gc);
      setWinners(w);
      if (lastPlayerId && lastMove != null) {
        setRecentMoves((prev) => ({ ...prev, [lastPlayerId]: { number: lastMove, time: Date.now() } }));
        setTimeout(() => {
          setRecentMoves((prev) => {
            const next = { ...prev };
            if (next[lastPlayerId]?.number === lastMove) delete next[lastPlayerId];
            return next;
          });
        }, 2000);
      }
      setTurnDeadline(td ?? null);
      if (bo != null) setWinsToReach(bo);
      if (tf != null) setTournamentFinished(tf);
      if (tw != null) setTournamentWinners(tw);
      setFinished(true);

      const amIWinner = w.some((winner) => winner.playerId === playerId);
      if (amIWinner) {
        audioManager.playWin();
        setTimeout(() => audioManager.playWin(), 300);
      } else {
        audioManager.playLose();
        setTimeout(() => audioManager.playLose(), 300);
      }
    });

    socket.on("play-restart", ({ myBoard, selection: s, currentPlayer: cp, gameCount: gc, turnDeadline: td, winsToReach: bo, tournamentFinished: tf, gameStartTime: gst, players: p }) => {
      setBoard(myBoard);
      setSelection(s);
      setCurrentPlayer(cp);
      setGameCount(gc);
      setTurnDeadline(td ?? null);
      if (p != null) setPlayers(p);
      setWinners([]);
      setFinished(false);
      if (bo != null) setWinsToReach(bo);
      if (tf != null) setTournamentFinished(tf);
      if (tf === false) setTournamentWinners([]);
      if (gst != null) setGameStartTime(gst);
      audioManager.playTurnBell();
    });

    socket.on("chat:message", (message) => {
      setChatMessages((prev) => {
        const next = [...prev, message];
        if (next.length > 50) next.shift();
        return next;
      });
      addChatFlash(message);
      if (message.playerId !== playerId) {
        audioManager.playNotification();
      }
    });

    socket.on("reaction", (reaction) => {
      addReaction(reaction);
      if (reaction.fromPlayerId !== playerId) {
        audioManager.playPop();
      }
    });

    socket.on("config-updated", ({ winsToReach: bo, maxPlayers: mp, players: p }) => {
      if (bo != null) setWinsToReach(bo);
      if (mp != null) setMaxPlayers(mp);
      if (p != null) setPlayers(p);
    });

    socket.on("vote-kick-started", ({ targetPlayerId, targetName, targetColor, targetAvatar, deadline }) => {
      setVoteKick({ targetPlayerId, targetName, targetColor, targetAvatar, deadline, voteResult: null, yesCount: 1, noCount: 0 });
    });

    socket.on("vote-kick-updated", ({ targetPlayerId, yesCount, noCount }) => {
      setVoteKick((prev) => {
        if (!prev || prev.targetPlayerId !== targetPlayerId) return prev;
        return { ...prev, yesCount, noCount };
      });
    });

    socket.on("vote-kick-ended", ({ targetPlayerId, targetName, removed, yesCount, noCount, players: p, currentPlayer: cp, ownerPlayerId: oid }) => {
      setVoteKick((prev) => {
        if (!prev || prev.targetPlayerId !== targetPlayerId) return prev;
        return { ...prev, voteResult: { removed, yesCount, noCount }, deadline: null };
      });
      if (removed) {
        if (p != null) setPlayers(p);
        if (cp != null) setCurrentPlayer(cp);
        if (oid != null) setOwnerPlayerId(oid);
        toast.success(`✅ ${targetName} was voted out (${yesCount}-${noCount})`);
      } else {
        toast.error(`❌ Vote to remove ${targetName} rejected (${yesCount}-${noCount})`);
      }
      setTimeout(() => setVoteKick(null), 4000);
    });

    socket.on("vote-kick-cancelled", ({ targetName, reason }) => {
      setVoteKick(null);
      if (reason === 'cancelled') {
        toast(`Vote to remove ${targetName} cancelled by owner`);
      } else if (reason === 'owner_left') {
        toast(`Vote to remove ${targetName} cancelled — owner left`);
      } else {
        toast(`Vote to remove ${targetName} cancelled — player left`);
      }
    });

    socket.on("turn-resumed", ({ turnDeadline: td, currentPlayer: cp }) => {
      if (td != null) setTurnDeadline(td);
      if (cp != null) setCurrentPlayer(cp);
    });

    socket.on("you-were-kicked", () => {
      toast.error("You have been voted out of the room. Redirecting…");
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId]);

  const sendChatMessage = (text) => {
    if (!text.trim()) return;
    socketRef.current?.emit("chat:message", { text });
  };

  const sendReaction = (emoji, targetPlayerId = null) => {
    socketRef.current?.emit("reaction", { emoji, targetPlayerId });
  };

  const playRandom = () => {
    socketRef.current?.emit("playRandom");
  };

  const cancelVoteKick = () => {
    socketRef.current?.emit("cancelVoteKick");
  };

  const initiateVoteKick = (targetPlayerId) => {
    socketRef.current?.emit("initiateVoteKick", { targetPlayerId });
  };

  const castVoteKick = (targetPlayerId, vote) => {
    socketRef.current?.emit("castVoteKick", { targetPlayerId, vote });
  };

  const updateConfig = (config) => {
    socketRef.current?.emit("updateConfig", config);
  };

  return (
    <SocketContext.Provider
      value={{
        socketRef,
        board,
        players,
        roomId,
        winsToReach,
        maxPlayers,
        tournamentFinished,
        tournamentWinners,
        gameStartTime,
        selection,
        currentPlayer,
        started,
        finished,
        winners,
        gameCount,
        chatMessages,
        reactions,
        chatFlashes,
        recentMoves,
        playerId,
        ownerPlayerId,
        name,
        setName,
        connectedCount,
        turnDeadline,
        voteKick,
        loading,
        sendChatMessage,
        sendReaction,
        playRandom,
        initiateVoteKick,
        castVoteKick,
        cancelVoteKick,
        updateConfig,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

SocketContextProvider.propTypes = {
  children: PropTypes.any,
};

export default SocketContextProvider;
