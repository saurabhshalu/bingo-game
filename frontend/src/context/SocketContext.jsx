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
  const [ownerPlayerId, setOwnerPlayerId] = useState(null);
  const [turnDeadline, setTurnDeadline] = useState(null);
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

  const sortedPlayers = useMemo(() => {
    const ME = players.find((p) => p.playerId === playerId);
    if (!ME) {
      return players;
    }
    return [ME, ...players.filter((p) => p.playerId !== playerId)];
  }, [players, playerId]);

  const connectedCount = useMemo(
    () => players.filter((p) => p.connected).length,
    [players]
  );

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

    socket.on("join-room", ({ players, roomId, selection, gameCount, started, ownerPlayerId, turnDeadline: td }) => {
      setPlayers(players);
      setRoomId(roomId);
      setSelection(selection);
      setGameCount(gameCount);
      setStarted(started);
      setOwnerPlayerId(ownerPlayerId);
      setTurnDeadline(td);
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
      chatHistory: ch,
      myBoard,
      ownerPlayerId: oid,
      turnDeadline: td,
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
      setWinners([]);
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

    socket.on("play-move", ({ players: p, selection: s, currentPlayer: cp, lastMove, turnDeadline: td }) => {
      setSelection(s);
      setPlayers(p);
      setCurrentPlayer(cp);
      setTurnDeadline(td);
      audioManager.playPop();
    });

    socket.on("play-started", ({ currentPlayer: cp, started: st, turnDeadline: td }) => {
      setCurrentPlayer(cp);
      setStarted(st);
      setTurnDeadline(td);
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

    socket.on("player-rejoined", ({ players: p, currentPlayer: cp, rejoinedPlayerId }) => {
      setPlayers(p);
      setCurrentPlayer(cp);
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

    socket.on("game-over", ({ winners: w, players: p, selection: s, gameCount: gc }) => {
      setPlayers(p);
      setSelection(s);
      setGameCount(gc);
      setWinners(w);
      setFinished(true);
      setTurnDeadline(null);

      const amIWinner = w.some((winner) => winner.playerId === playerId);
      if (amIWinner) {
        audioManager.playWin();
        setTimeout(() => audioManager.playWin(), 300);
      } else {
        audioManager.playLose();
        setTimeout(() => audioManager.playLose(), 300);
      }
    });

    socket.on("play-restart", ({ myBoard, selection: s, currentPlayer: cp, gameCount: gc }) => {
      setBoard(myBoard);
      setSelection(s);
      setCurrentPlayer(cp);
      setGameCount(gc);
      setWinners([]);
      setFinished(false);
      audioManager.playTurnBell();
    });

    socket.on("chat:message", (message) => {
      setChatMessages((prev) => {
        const next = [...prev, message];
        if (next.length > 50) next.shift();
        return next;
      });
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

  const kickPlayer = (targetPlayerId) => {
    socketRef.current?.emit("kickPlayer", { targetPlayerId });
  };

  return (
    <SocketContext.Provider
      value={{
        socketRef,
        board,
        players: sortedPlayers,
        roomId,
        selection,
        currentPlayer,
        started,
        finished,
        winners,
        gameCount,
        chatMessages,
        reactions,
        playerId,
        ownerPlayerId,
        name,
        setName,
        connectedCount,
        turnDeadline,
        loading,
        sendChatMessage,
        sendReaction,
        playRandom,
        kickPlayer,
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
