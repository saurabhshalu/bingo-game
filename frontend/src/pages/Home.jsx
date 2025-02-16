import { Button, TextField } from "@mui/material";
import { motion } from "motion/react";
import { useContext, useState } from "react";
import { SocketContext } from "../context/SocketContext";

const Home = () => {
  const [joinMode, setJoinMode] = useState(false);
  const [inputName, setInputName] = useState("");
  const [inputRoomId, setInputRoomId] = useState("");

  const { socketRef } = useContext(SocketContext);
  const createRoom = () => {
    socketRef.current.emit("createRoom", { name: inputName });
  };

  const joinRoom = () => {
    socketRef.current.emit("joinRoom", {
      name: inputName,
      roomId: inputRoomId,
    });
  };

  return (
    <motion.main
      initial={{ y: "100vh" }}
      animate={{ y: "0" }}
      transition={{ type: "spring" }}
      className="flex flex-col justify-center gap-10 items-center min-h-[100vh]"
    >
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
            onChange={(e) => setInputRoomId(e.target.value)}
            autoFocus
            required
          />
        )}
        {!joinMode ? (
          <Button
            onClick={() => {
              setJoinMode(true);
            }}
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
              onClick={() => {
                joinRoom();
              }}
              className="size-10 w-full"
              variant="contained"
              color="primary"
              disabled={!inputName.trim() || !inputRoomId.trim()}
            >
              Join
            </Button>
            <Button
              onClick={() => {
                setInputRoomId("");
                setJoinMode(false);
              }}
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
