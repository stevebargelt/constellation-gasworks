import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { BrowserAgent } from "@newrelic/browser-agent/loaders/browser-agent";
import posthog from "posthog-js";
import { initSupabase } from "@constellation/api";
import App from "./App";
import "./index.css";

// react-force-graph's A-Frame dependencies reference a global AFRAME object
// that doesn't exist outside of A-Frame apps. Polyfill it to prevent a
// ReferenceError that would crash the app before React mounts.
(window as unknown as Record<string, unknown>).AFRAME =
  (window as unknown as Record<string, unknown>).AFRAME ?? {};

if (import.meta.env.VITE_NEW_RELIC_APP_ID && import.meta.env.VITE_NEW_RELIC_LICENSE_KEY) {
  new BrowserAgent({
    init: { distributed_tracing: { enabled: true }, privacy: { cookies_enabled: true } },
    info: { beacon: "bam.nr-data.net", errorBeacon: "bam.nr-data.net", licenseKey: import.meta.env.VITE_NEW_RELIC_LICENSE_KEY, applicationID: import.meta.env.VITE_NEW_RELIC_APP_ID, sa: 1 },
    loader_config: { accountID: "", trustKey: "", agentID: import.meta.env.VITE_NEW_RELIC_APP_ID, licenseKey: import.meta.env.VITE_NEW_RELIC_LICENSE_KEY, applicationID: import.meta.env.VITE_NEW_RELIC_APP_ID },
  });
}

if (import.meta.env.VITE_POSTHOG_KEY) {
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: "https://app.posthog.com",
    autocapture: true,
  });
}

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
