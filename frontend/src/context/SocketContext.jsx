import { createContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import PropTypes from "prop-types";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
const socketInitialState = {
  socketRef: null,
  board: [],
  players: [],
  roomId: null,
  selection: {},
  currentPlayer: null,
  started: false,
  winners: [],
};

// eslint-disable-next-line react-refresh/only-export-components
export const SocketContext = createContext(socketInitialState);

const SocketContextProvider = ({ children }) => {
  const socketRef = useRef(null);
  const [board, setBoard] = useState([]);
  const [players, setPlayers] = useState([]);
  const [roomId, setRoomId] = useState(null);
  const [selection, setSelection] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(null);
  const [started, setStarted] = useState(false);
  const [winners, setWinners] = useState([]);

  const sortedPlayers = useMemo(() => {
    const ME = players.find((p) => p.id === socketRef.current.id);
    if (!ME) {
      return players;
    }
    return [ME, ...players.filter((p) => ME.id !== p.id)];
  }, [players]);

  const navigate = useNavigate();

  useEffect(() => {
    const socket = io({
      path: "/socket.io",
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("disconnect", () => {
      navigate("/");
    });

    socket.on("join-room", ({ players, roomId, selection }) => {
      setPlayers(players);
      setRoomId(roomId);
      setSelection(selection);
    });

    socket.on("my-board", (myBoard) => {
      setBoard(myBoard);
      navigate("/game");
    });

    socket.on("error", ({ message }) => {
      toast.error(message);
    });

    socket.on("play-move", ({ players, selection, currentPlayer }) => {
      setSelection(selection);
      setPlayers(players);
      setCurrentPlayer(currentPlayer);
    });

    socket.on("play-started", ({ currentPlayer, started }) => {
      setCurrentPlayer(currentPlayer);
      setStarted(started);
    });

    socket.on(
      "player-left",
      ({ players, selection, currentPlayer, leftPlayerName, owner }) => {
        setPlayers(players);
        setSelection(selection);
        setCurrentPlayer(currentPlayer);
        toast(() => (
          <span>
            Player &apos;<b>{leftPlayerName}</b>&apos;&nbsp; left the game
          </span>
        ));
        if (owner && socketRef.current.id === owner) {
          toast.success("You are promoted to the owner of the game");
        }
      }
    );

    socket.on("game-over", ({ winners, players, selection }) => {
      setPlayers(players);
      setSelection(selection);
      setWinners(winners);
    });

    socket.on("play-restart", ({ myBoard, selection }) => {
      setBoard(myBoard);
      setSelection(selection);
      setWinners([]);
    });

    return () => {
      socket.off("join-room");
      socket.off("my-board");
      socket.off("play-move");
      socket.off("error");
      socket.off("player-left");
      socket.off("game-over");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (started && players.length === 1) {
      window.location.reload();
    }
  }, [started, players]);

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
        winners,
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
