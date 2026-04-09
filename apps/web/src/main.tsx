import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initSupabase } from "@constellation/api";
import App from "./App";
import "./index.css";

// react-force-graph's A-Frame dependencies reference a global AFRAME object
// that doesn't exist outside of A-Frame apps. Polyfill it to prevent a
// ReferenceError that would crash the app before React mounts.
(window as unknown as Record<string, unknown>).AFRAME =
  (window as unknown as Record<string, unknown>).AFRAME ?? {};

initSupabase(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
