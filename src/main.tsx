import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./AppRouter";
import "./styles/reset.css";
import "./styles/theme.css";
import "./styles/glass.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
