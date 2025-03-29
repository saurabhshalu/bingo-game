// import { useMemo } from "react";
import PropTypes from "prop-types";
import Block from "../components/Block";
import { useContext, useMemo } from "react";
import { SocketContext } from "../context/SocketContext";
import { Navigate } from "react-router";
import { motion } from "motion/react";
import { Avatar, Badge, Tooltip } from "@mui/material";
import toast from "react-hot-toast";
import playLogo from "/play.svg";
import restartLogo from "/restart.svg";
import { getGameOverMessage, soloWinnerMessages } from "../helper";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const getCorrectAnswerList = (size = 5) => {
  const answers = {
    horizontal: [],
    vertical: [],
    diagonal1: [],
    diagonal2: [],
  };

  for (let i = 0; i < size; i++) {
    const list1 = [];
    const list2 = [];
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

const Game = () => {
  const {
    board,
    socketRef,
    selection,
    roomId,
    players,
    currentPlayer,
    started,
    winners,
  } = useContext(SocketContext);
  const size = useMemo(
    () => Math.floor(Math.sqrt(Object.keys(selection).length)),
    [selection]
  );

  const GAME_OVER_MESSAGE = useMemo(() => {
    return getGameOverMessage(
      winners.length,
      winners.some((winner) => winner.id === socketRef.current.id)
    );
  }, [socketRef, winners]);

  const CORRECT_ANSWER_LIST = useMemo(() => getCorrectAnswerList(size), [size]);

  const BINGO_LIST = useMemo(() => {
    return [
      CORRECT_ANSWER_LIST.diagonal1,
      CORRECT_ANSWER_LIST.diagonal2,
      ...CORRECT_ANSWER_LIST.horizontal,
      ...CORRECT_ANSWER_LIST.vertical,
    ].filter((path) =>
      path.every((item) => {
        return selection[board[item - 1]] && true;
      })
    );
  }, [CORRECT_ANSWER_LIST, board, selection]);
  const BINGO_LENGTH = BINGO_LIST.length;

  const playMove = (number) => {
    socketRef.current.emit("playMove", number);
  };

  if (!board || board.length == 0) {
    return <Navigate to={"/"} replace={true} />;
  }

  const handlePlayStart = () => {
    if (players.length < 2) {
      return toast.error("Atleast 2 players are required to play");
    }
    socketRef.current.emit("playStart");
  };

  const handleRestart = () => {
    if (players.length < 2) {
      return toast.error("Atleast 2 players are required to play");
    }
    socketRef.current.emit("playRestart");
  };

  return (
    <motion.main
      initial={{ y: "100vh" }}
      animate={{ y: 0 }}
      transition={{ type: "spring" }}
      className="h-full m-auto flex flex-col gap-5 pb-8 items-center"
    >
      <div className="pt-5">
        <h1 className="text-6xl englebert-regular text-neutral-50">
          <span
            className={`transition-colors ${
              BINGO_LENGTH > 0 ? "text-amber-300" : ""
            }`}
          >
            B
          </span>
          <span
            className={`transition-colors ${
              BINGO_LENGTH > 1 ? "text-amber-300" : ""
            }`}
          >
            I
          </span>
          <span
            className={`transition-colors ${
              BINGO_LENGTH > 2 ? "text-amber-300" : ""
            }`}
          >
            N
          </span>
          <span
            className={`transition-colors ${
              BINGO_LENGTH > 3 ? "text-amber-300" : ""
            }`}
          >
            G
          </span>
          <span
            className={`transition-colors ${
              BINGO_LENGTH > 4 ? "text-amber-300" : ""
            }`}
          >
            O
          </span>
          <span> Extended</span>
        </h1>
        <div style={{ fontFamily: "monospace" }} className="text-amber-100">
          {roomId}
        </div>
      </div>
      <div className="flex gap-2 max-w-2xl w-full">
        {players.map((player) => {
          const thisPlayer = player.id === currentPlayer;
          return (
            <motion.div
              initial={{ scale: 0 }}
              animate={thisPlayer ? { scale: [1, 0.9, 1] } : { scale: 1 }}
              key={player.id}
              transition={{
                repeat: thisPlayer ? Infinity : 0, // Repeat until condition is met
              }}
            >
              <Badge
                showZero
                badgeContent={player.win}
                color="info"
                overlap="circular"
              >
                <Tooltip
                  title={`${player.name}${
                    player.id === socketRef.current.id ? "(You)" : ""
                  }`}
                >
                  <Avatar
                    style={{
                      height: 50,
                      width: 50,
                      background: thisPlayer ? "#05df72" : undefined,
                    }}
                  >
                    {player.name
                      .split(" ")
                      .map((i) => i[0])
                      .join("")}
                  </Avatar>
                </Tooltip>
              </Badge>
            </motion.div>
          );
        })}
      </div>
      <div
        className="relative grid gap-2 p-4 bg-gray-100 max-w-2xl"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          gridTemplateRows: `repeat(${size}, 1fr)`,
        }}
      >
        {board.map((item, index) => (
          <Block
            number={item}
            key={item}
            handleClick={() => {
              playMove(item);
            }}
            selection={selection}
            index={index}
            CORRECT_ANSWER_LIST={CORRECT_ANSWER_LIST}
          />
        ))}
        {winners.length === 0 &&
          started &&
          currentPlayer !== socketRef.current.id && (
            <div className="absolute top-0 left-0 h-full w-full bg-[rgba(0,0,0,0.5)] flex items-center justify-center">
              <span className="bg-white p-2 rounded-sm">
                Wait for {players.find((i) => i.id === currentPlayer).name}
                &apos;s turn
              </span>
            </div>
          )}
        {!started && (
          <div className="absolute top-0 left-0 h-full w-full bg-[rgba(0,0,0,0.5)] flex items-center justify-center backdrop-blur-xs">
            <motion.img
              onClick={handlePlayStart}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.8 }}
              src={playLogo}
              alt="play"
              className="h-28 w-28 cursor-pointer"
            />
          </div>
        )}
        {!GAME_OVER_MESSAGE && (
          <div className="absolute top-0 left-0 h-full w-full bg-[rgba(0,0,0,0.5)] flex items-center justify-center backdrop-blur-xs flex-col">
            <div className="englebert-regular pt-4 pb-2 pr-4 pl-4 rounded-md bg-neutral-50 text-neutral-900 font-bold text-xl m-4">
              <DotLottieReact
                src="https://lottie.host/4a539643-9f47-4dd9-81e0-4d463f518170/VFNR0kzAA6.lottie"
                loop
                autoplay
              />
              {GAME_OVER_MESSAGE || soloWinnerMessages[5]}
            </div>
            <div>
              <Tooltip title="Restart">
                <motion.img
                  onClick={handleRestart}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  src={restartLogo}
                  alt="restart"
                  className="h-24 w-24 cursor-pointer"
                />
              </Tooltip>
            </div>
          </div>
        )}
      </div>
    </motion.main>
  );
};

Game.propTypes = {
  size: PropTypes.number.isRequired,
};

export default Game;
