import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { RouterProvider } from "./router/Router";

import "./styles/globals.css";
import "./styles/dashboard-ui.css";

createRoot(
  document.getElementById("root")!
).render(
  <StrictMode>
    <RouterProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </RouterProvider>
  </StrictMode>
);
