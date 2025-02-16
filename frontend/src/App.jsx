import Game from "./pages/Game";
import SocketContextProvider from "./context/SocketContext";
import { Navigate, Route, Routes } from "react-router";
import Home from "./pages/Home";
const App = () => {
  return (
    <SocketContextProvider>
      <Routes>
        <Route path="/" Component={Home} />
        <Route path="/game" element={<Game />} />
        <Route path="*" element={<Navigate to={"/"} />} />
      </Routes>
    </SocketContextProvider>
  );
};

export default App;
