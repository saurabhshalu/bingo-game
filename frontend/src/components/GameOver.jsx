import React, { useMemo, useContext } from "react";
import restartLogo from "/restart.svg";
import { getGameOverMessage } from "../helper";
import { Tooltip } from "@mui/material";
import { motion } from "motion/react";
import { SocketContext } from "../context/SocketContext";

const GameOver = ({ handleRestart }) => {
  const {
    winners, playerId, ownerPlayerId, players,
    tournamentFinished, tournamentWinners, winsToReach
  } = useContext(SocketContext);
  const isOwner = playerId === ownerPlayerId;
  const ownerName = players.find((p) => p.playerId === ownerPlayerId)?.name || "owner";

  const amItheWinner = useMemo(
    () => winners.some((winner) => winner.playerId === playerId),
    [winners, playerId]
  );

  const amITournamentWinner = useMemo(
    () => tournamentWinners.some((w) => w.playerId === playerId),
    [tournamentWinners, playerId]
  );

  const GAME_OVER_MESSAGE = useMemo(() => {
    return getGameOverMessage(winners.length, amItheWinner);
  }, [amItheWinner, winners]);

  const classNameBasedOnResult = amItheWinner
    ? winners.length > 1
      ? "bg-blue-500"
      : "bg-green-500"
    : "bg-red-500";

  if (winners.length === 0) {
    return null;
  }

  // Tournament finished screen
  if (tournamentFinished && tournamentWinners.length > 0) {
    const isMulti = tournamentWinners.length > 1;

    // Winners see the champion celebration
    if (amITournamentWinner) {
      return (
        <div className="absolute top-0 left-0 h-full w-full bg-[rgba(0,0,0,0.92)] flex items-center justify-center backdrop-blur-xs flex-col z-20" style={{ WebkitBackdropFilter: 'blur(4px)' }}>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="flex flex-col items-center"
          >
            <div className="text-6xl mb-2">🏆</div>
            <h2 className="text-3xl sm:text-4xl font-bold text-amber-300 englebert-regular mb-2">
              {isMulti ? "You Tied for Champion!" : "Tournament Champion!"}
            </h2>
            <p className="text-neutral-300 text-sm mb-4">
              First to {winsToReach} wins — {tournamentWinners[0].win} reached
            </p>
            <div className="flex gap-2 flex-wrap justify-center mb-6">
              {tournamentWinners.map((w) => (
                <span
                  key={w.playerId}
                  className={`px-3 py-1.5 rounded-full text-sm font-bold shadow-lg ${
                    w.playerId === playerId
                      ? "bg-green-500 text-white"
                      : "bg-neutral-700 text-neutral-200"
                  }`}
                >
                  {w.name} 🏅
                </span>
              ))}
            </div>
            {isOwner ? (
              <motion.button
                onClick={handleRestart}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-3 rounded-full shadow-xl text-sm"
              >
                🔄 Start New Tournament
              </motion.button>
            ) : (
              <span className="text-white text-sm">
                Waiting for <b>{ownerName}</b> to start a new tournament
              </span>
            )}
          </motion.div>
        </div>
      );
    }

    // Losers see a subdued screen
    return (
      <div className="absolute top-0 left-0 h-full w-full bg-[rgba(0,0,0,0.92)] flex items-center justify-center backdrop-blur-xs flex-col z-20" style={{ WebkitBackdropFilter: 'blur(4px)' }}>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20 }}
          className="flex flex-col items-center"
        >
          <div className="text-4xl mb-3">📜</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-neutral-200 mb-3">
            Tournament Over
          </h2>
          <p className="text-neutral-500 text-sm mb-4">
            First to {winsToReach} wins — tournament finished
          </p>
          <div className="flex flex-col gap-2 mb-6">
            {tournamentWinners.map((w) => (
              <span
                key={w.playerId}
                className="px-4 py-2 rounded-full text-sm font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40"
              >
                🏆 {w.name} — {w.win} wins
              </span>
            ))}
          </div>
          {isOwner ? (
            <motion.button
              onClick={handleRestart}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-neutral-700 hover:bg-neutral-600 text-white font-bold px-5 py-2.5 rounded-full shadow-lg text-sm"
            >
              Start New Tournament
            </motion.button>
          ) : (
            <span className="text-neutral-400 text-sm">
              Waiting for <b>{ownerName}</b> to start a new tournament
            </span>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="absolute top-0 left-0 h-full w-full bg-[rgba(0,0,0,0.9)] flex items-center justify-center backdrop-blur-xs flex-col z-20" style={{ WebkitBackdropFilter: 'blur(2px)' }}>
      <div
        className={`englebert-regular pt-4 pb-2 pr-4 pl-4 rounded-md ${classNameBasedOnResult} text-white font-bold text-xl m-4`}
      >
        {GAME_OVER_MESSAGE}
        <div className="flex gap-1.5 w-full items-center justify-center pt-1 flex-wrap">
          {amItheWinner && winners.length > 1 && (
            <span className="bg-black text-white p-1 text-xs rounded-md">
              You
            </span>
          )}
          {winners
            .filter((i) => i.playerId !== playerId)
            .map((item) => (
              <span
                key={item.playerId}
                className="bg-black text-white p-1 text-xs rounded-md"
              >
                {item.name}
              </span>
            ))}
        </div>
      </div>
      {winsToReach > 1 && (
        <div className="text-neutral-400 text-xs mb-2">
          Tournament progress: {winners.map(w => `${w.name} (${w.win} wins)`).join(", ")}
        </div>
      )}
      <div>
        {isOwner ? (
          <Tooltip title={winsToReach > 1 ? "Next Game" : "Restart"}>
            <motion.img
              onClick={handleRestart}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.8 }}
              src={restartLogo}
              alt="restart"
              className="h-24 w-24 cursor-pointer"
            />
          </Tooltip>
        ) : (
          <span className="text-white text-sm">
            Waiting for <b>{ownerName}</b> to {winsToReach > 1 ? "start next game" : "restart the game"}
          </span>
        )}
      </div>
    </div>
  );
};

export default GameOver;
