import { Button, TextField } from "@mui/material";
import { motion } from "motion/react";
import { useContext, useState } from "react";
import { SocketContext } from "../context/SocketContext";
import VolumeToggle from "../components/VolumeToggle";

const Home = () => {
  const [joinMode, setJoinMode] = useState(false);
  const { socketRef, name, setName, playerId } = useContext(SocketContext);
  const [inputName, setInputName] = useState(name || "");
  const [inputRoomId, setInputRoomId] = useState("");

  const createRoom = () => {
    const trimmed = inputName.trim();
    if (!trimmed) return;
    setName(trimmed);
    localStorage.setItem("bingo_player_name", trimmed);
    socketRef.current.emit("createRoom", { name: trimmed, playerId });
  };

  const joinRoom = () => {
    const trimmedName = inputName.trim();
    const trimmedRoom = inputRoomId.trim().toUpperCase();
    if (!trimmedName || !trimmedRoom) return;
    setName(trimmedName);
    localStorage.setItem("bingo_player_name", trimmedName);
    socketRef.current.emit("joinRoom", { name: trimmedName, roomId: trimmedRoom, playerId });
  };

  return (
    <motion.main
      initial={{ y: "100vh" }}
      animate={{ y: "0" }}
      transition={{ type: "spring" }}
      className="flex flex-col justify-center gap-10 items-center min-h-[100dvh]"
    >
      <VolumeToggle />
      <h1 className="text-6xl englebert-regular text-neutral-50">
        Bingo Extended
      </h1>

      <section className="flex flex-col items-center gap-4 max-w-md w-full bg-neutral-200 p-4 pt-10 pb-10 rounded-sm">
        <TextField
          size="small"
          label="Name"
          fullWidth
          placeholder="Enter your name"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          required
        />
        {!joinMode ? (
          <Button
            onClick={createRoom}
            className="size-10 w-full"
            variant="outlined"
            color="success"
            disabled={!inputName.trim()}
          >
            Create Game
          </Button>
        ) : (
          <TextField
            size="small"
            label="Room Id"
            fullWidth
            placeholder="Enter Room Id"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
            autoFocus
            required
          />
        )}
        {!joinMode ? (
          <Button
            onClick={() => setJoinMode(true)}
            className="size-10 w-full"
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
              className="size-10 w-full"
              variant="contained"
              color="primary"
              disabled={!inputName.trim() || !inputRoomId.trim()}
            >
              Join
            </Button>
            <Button
              onClick={() => { setInputRoomId(""); setJoinMode(false); }}
              className="size-10 w-full"
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
