import React, { useState, useEffect, useRef } from "react";
import "./App.css";

function Avatar({ name, color }) {
  const initials = (name || "?")
    .split(" ")
    .map(w => w[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
  return (
    <div className="avatar" style={{ background: color || "var(--accent)" }}>
      {initials || "?"}
    </div>
  );
}

function Header({ connected }) {
  return (
    <div className="header">
      <div className="brand">
        <span className="logo">💬</span>
        <div>
          <div className="title">Chat Lounge</div>
          <div className="subtitle">ws://localhost:55555</div>
        </div>
      </div>
      <div className="status">
        <span className={`dot ${connected ? "on" : "off"}`} />
        {connected ? "Connected" : "Disconnected"}
      </div>
    </div>
  );
}

function SystemPill({ kind, text }) {
  return <div className={`system-pill ${kind}`}>{text}</div>;
}

export default function App() {
  const [socket, setSocket] = useState(null);
  const [username, setUsername] = useState("");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [selfColor, setSelfColor] = useState(null);
  const msgEnd = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    msgEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // close socket cleanly on page unload
    return () => {
      try { socket?.close(); } catch {}
    };
  }, [socket]);

  const connect = () => {
    if (!username.trim()) return;
    const ws = new WebSocket("ws://localhost:55555");
    ws.onopen = () => {
      ws.send(username.trim());
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Capture your assigned color the first time you see your own chat
      if (data.type === "chat" && data.from === username && !selfColor) {
        setSelfColor(data.color);
      }
      if (data.type === "info" && /joined as/i.test(data.text)) {
        // slight UX: focus the input once joined
        setTimeout(() => textRef.current?.focus(), 50);
      }

      setMessages((prev) => [...prev, data]);
    };
    ws.onclose = () => {
      setSocket(null);
      setMessages((prev) => [...prev, { type: "notice", text: "Disconnected from server" }]);
    };
    setSocket(ws);
  };

  const sendMsg = () => {
    if (socket && input.trim()) {
      socket.send(input);
      setInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMsg();
    }
  };

  // LOGIN VIEW
  if (!socket)
    return (
      <div className="screen">
        <div className="login-card">
          <div className="login-icon">💬</div>
          <h1>Welcome</h1>
          <p className="muted">Pick a name to join the lounge</p>
          <input
            className="input-username"
            placeholder="e.g., nebula_fox"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            autoFocus
          />
          <button className="btn-primary" onClick={connect} disabled={!username.trim()}>
            Join Chat
          </button>
          <div className="login-hint">
            Tip: DM with <code>@username message</code>
          </div>
        </div>
      </div>
    );

  // CHAT VIEW
  return (
    <div className="shell">
      <Header connected={!!socket} />
      <div className="chat">
        <div className="messages">
          {messages.map((m, i) => {
            // CHAT MESSAGE
            if (m.type === "chat") {
              const isSelf = m.from === username;
              return (
                <div key={i} className={`chat-row ${isSelf ? "self" : ""}`}>
                  {!isSelf && <Avatar name={m.from} color={m.color} />}
                  <div className="bubble">
                    <div className="meta">
                      <span className="name" style={{ color: m.color }}>{m.from}</span>
                      {m.time && <span className="time">{m.time}</span>}
                    </div>
                    <div className="text">{m.text}</div>
                  </div>
                  {isSelf && <Avatar name={m.from} color={selfColor || m.color} />}
                </div>
              );
            }

            // SYSTEM NOTICES / INFO / ERRORS
            if (m.type === "notice") return <SystemPill key={i} kind="notice" text={m.text} />;
            if (m.type === "info") return <SystemPill key={i} kind="info" text={m.text} />;
            if (m.type === "error") return <SystemPill key={i} kind="error" text={m.text} />;

            // DMs
            if (m.type === "dm") {
              const isIncoming = !!m.from;
              const peer = m.from || m.to;
              const label = isIncoming ? `DM from ${peer}` : `DM to ${peer}`;
              return (
                <div key={i} className={`chat-row dm ${isIncoming ? "" : "self"}`}>
                  {isIncoming && <Avatar name={peer} color={m.color} />}
                  <div className="bubble dm-bubble">
                    <div className="meta">
                      <span className="badge-dm">DM</span>
                      <span className="name">{label}</span>
                    </div>
                    <div className="text">{m.text}</div>
                  </div>
                  {!isIncoming && <Avatar name={peer} color={m.color} />}
                </div>
              );
            }

            // fallback
            return null;
          })}
          <div ref={msgEnd} />
        </div>

        <div className="composer">
          <textarea
            ref={textRef}
            className="composer-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message #general — Type @username to DM. Press Enter to send, Shift+Enter for newline."
            rows={1}
          />
          <button className="btn-send" onClick={sendMsg} disabled={!input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
