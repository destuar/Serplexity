/**
 * @file main.tsx
 * @description This is the main entry point for the React application. It initializes the React root,
 * renders the `App` component into the DOM, and wraps the entire application with the `AuthProvider`
 * to provide authentication context globally. It also imports the main CSS file.
 *
 * @dependencies
 * - react: The core React library.
 * - react-dom/client: React DOM client for rendering.
 * - ./App.tsx: The main application component.
 * - ./index.css: Global CSS styles.
 * - ./contexts/AuthContext.tsx: Provides authentication context to the application.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { CompanyProvider } from "./contexts/CompanyContext.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <CompanyProvider>
        <App />
      </CompanyProvider>
    </AuthProvider>
  </React.StrictMode>
);
