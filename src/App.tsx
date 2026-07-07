/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import ChatWindow from "./components/ChatWindow";
import { ChatUser } from "./types";

export default function App() {
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(() => {
    // Session-based persistence for top security (cleared when browser/tab is closed)
    return (sessionStorage.getItem("active_node_id") as ChatUser) || null;
  });

  const handleLoginSuccess = (user: ChatUser) => {
    setCurrentUser(user);
    sessionStorage.setItem("active_node_id", user);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem("active_node_id");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500/30">
      {currentUser ? (
        <ChatWindow currentUser={currentUser} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

