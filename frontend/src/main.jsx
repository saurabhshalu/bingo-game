import { StrictMode } from "react";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";
import CssBaseline from "@mui/material/CssBaseline";

import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { Container } from "@mui/material";
import { BrowserRouter } from "react-router";
import { Toaster } from "react-hot-toast";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <CssBaseline />
      <Container className="text-center bg-[#242424] min-h-[100vh]">
        <App />
      </Container>
      <Toaster />
    </BrowserRouter>
  </StrictMode>
);
