import React, { useMemo, useContext } from "react";
import restartLogo from "/restart.svg";
import { getGameOverMessage } from "../helper";
import { Tooltip } from "@mui/material";
import { motion } from "motion/react";
import { SocketContext } from "../context/SocketContext";

const GameOver = ({ handleRestart }) => {
  const { winners, playerId, ownerPlayerId, players } = useContext(SocketContext);
  const isOwner = playerId === ownerPlayerId;
  const ownerName = players.find((p) => p.playerId === ownerPlayerId)?.name || "owner";

  const amItheWinner = useMemo(
    () => winners.some((winner) => winner.playerId === playerId),
    [winners, playerId]
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
      <div>
        {isOwner ? (
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
        ) : (
          <span className="text-white text-sm">
            Waiting for <b>{ownerName}</b> to restart the game
          </span>
        )}
      </div>
    </div>
  );
};

export default GameOver;
