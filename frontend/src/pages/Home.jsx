import { Button, TextField, Slider } from "@mui/material";
import { motion } from "motion/react";
import { useContext, useState } from "react";
import { SocketContext } from "../context/SocketContext";
import VolumeToggle from "../components/VolumeToggle";

const AVATAR_EMOJIS = [
  "🐶","🐱","🦊","🦁","🐯","🐨","🐼","🐰","🐸","🐙",
  "🦄","🐲","🦖","🦕","🐳","🦈","🐊","🐅","🐆","🦓",
  "🦍","🦧","🐘","🦛","🦏","🐪","🦒","🦘","🐃","🐂",
  "🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩",
  "🦮","🐕‍🦺","🐈","🐈‍⬛","🐓","🦃","🦚","🦜","🦢","🦩",
  "🕊️","🐇","🦝","🦨","🦡","🦦","🦥","🐁","🐀","🐿️"
];

const Home = () => {
  const [joinMode, setJoinMode] = useState(false);
  const [showCreateOptions, setShowCreateOptions] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [winsToReach, setWinsToReach] = useState(1);
  const [selectedAvatar, setSelectedAvatar] = useState(() => localStorage.getItem("bingo_avatar") || null);
  const { socketRef, name, setName, playerId } = useContext(SocketContext);
  const [inputName, setInputName] = useState(name || "");
  const [inputRoomId, setInputRoomId] = useState("");

  const createRoom = () => {
    const trimmed = inputName.trim();
    if (!trimmed) return;
    setName(trimmed);
    localStorage.setItem("bingo_player_name", trimmed);
    if (selectedAvatar) localStorage.setItem("bingo_avatar", selectedAvatar);
    socketRef.current.emit("createRoom", {
      name: trimmed, playerId, maxPlayers, winsToReach, avatar: selectedAvatar
    });
  };

  const joinRoom = () => {
    const trimmedName = inputName.trim();
    const trimmedRoom = inputRoomId.trim().toUpperCase();
    if (!trimmedName || !trimmedRoom) return;
    setName(trimmedName);
    localStorage.setItem("bingo_player_name", trimmedName);
    if (selectedAvatar) localStorage.setItem("bingo_avatar", selectedAvatar);
    socketRef.current.emit("joinRoom", {
      name: trimmedName, roomId: trimmedRoom, playerId, avatar: selectedAvatar
    });
  };

  return (
    <motion.main
      initial={{ y: "100vh" }}
      animate={{ y: "0" }}
      transition={{ type: "spring" }}
      className="flex flex-col justify-center gap-8 items-center min-h-screen min-h-[100dvh] px-4"
    >
      <VolumeToggle />
      <h1 className="text-6xl englebert-regular text-neutral-50">
        Bingo Extended
      </h1>

      <section className="flex flex-col items-center gap-4 max-w-md w-full bg-neutral-200 p-4 pt-6 pb-6 rounded-sm">
        <TextField
          size="small"
          label="Name"
          fullWidth
          placeholder="Enter your name"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          required
        />

        <div className="w-full">
          <p className="text-xs text-neutral-600 font-medium mb-2">Pick your avatar</p>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
            {AVATAR_EMOJIS.slice(0, 20).map((emoji) => (
              <button
                key={emoji}
                onClick={() => setSelectedAvatar(emoji)}
                className={`text-2xl p-1.5 rounded-lg transition-all shrink-0 ${
                  selectedAvatar === emoji
                    ? "bg-green-500 scale-110 shadow-md"
                    : "bg-neutral-300 hover:bg-neutral-400"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {!joinMode ? (
          <>
            {!showCreateOptions ? (
              <Button
                onClick={() => setShowCreateOptions(true)}
                className="w-full"
                variant="outlined"
                color="success"
                disabled={!inputName.trim()}
              >
                Create Game
              </Button>
            ) : (
              <div className="w-full flex flex-col gap-3 animate-fadeIn">
                <div>
                  <p className="text-xs text-neutral-600 font-medium mb-1">Max Players: {maxPlayers}</p>
                  <Slider
                    value={maxPlayers}
                    onChange={(_, v) => setMaxPlayers(v)}
                    step={1}
                    marks
                    min={2}
                    max={10}
                    valueLabelDisplay="auto"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs text-neutral-600 font-medium whitespace-nowrap">Wins to reach</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={winsToReach}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 1) setWinsToReach(Math.min(v, 50));
                    }}
                    className="bg-neutral-900/80 text-white text-sm rounded-lg px-2 py-1 w-16 outline-none border border-neutral-600"
                  />
                  <span className="text-[10px] text-neutral-500">1 = single round</span>
                </div>
                <Button
                  onClick={createRoom}
                  className="w-full"
                  variant="contained"
                  color="success"
                  disabled={!inputName.trim()}
                >
                  Start Room
                </Button>
                <Button
                  onClick={() => setShowCreateOptions(false)}
                  className="w-full"
                  variant="text"
                  color="inherit"
                  size="small"
                >
                  Back
                </Button>
              </div>
            )}
          </>
        ) : (
          <TextField
            size="small"
            label="Room Id"
            fullWidth
            placeholder="Enter Room Id"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
            autoComplete="off"
            autoFocus
            required
          />
        )}
        {!joinMode ? (
          <Button
            onClick={() => setJoinMode(true)}
            className="w-full"
            variant="outlined"
            color="secondary"
            disabled={!inputName.trim()}
          >
            Join Game
          </Button>
        ) : (
          <div className="flex gap-4 w-full">
            <Button
              onClick={joinRoom}
              className="w-full"
              variant="contained"
              color="primary"
              disabled={!inputName.trim() || !inputRoomId.trim()}
            >
              Join
            </Button>
            <Button
              onClick={() => { setInputRoomId(""); setJoinMode(false); }}
              className="w-full"
              variant="outlined"
              color="error"
            >
              Cancel
            </Button>
          </div>
        )}
      </section>
    </motion.main>
  );
};

export default Home;
