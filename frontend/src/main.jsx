import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import OwnerDashboard from "./OwnerDashboard.jsx";
import EmbeddedReception from "./EmbeddedReception.jsx";

const route = window.location.pathname.replace(/\/+$/, "");
const isOwnerPage = route === "/admin";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isOwnerPage ? (
      <OwnerDashboard />
    ) : route === "/widget" ? (
      <EmbeddedReception />
    ) : (
      <App />
    )}
  </StrictMode>,
);
