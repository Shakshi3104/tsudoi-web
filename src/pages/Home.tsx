import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (trimmed) navigate(`/join/${trimmed}`);
  };

  return (
    <main className="app-shell">
      <div className="app-container app-container--narrow" style={{ textAlign: "center" }}>
        <h1>Tsudoi</h1>
        <p className="text-secondary" style={{ marginTop: "var(--space-2)" }}>
          Enter the event code to join.
        </p>
        <form onSubmit={handleSubmit} className="card" style={{ marginTop: "var(--space-5)" }}>
          <div className="stack">
            <label className="field" style={{ textAlign: "left" }}>
              Event code
              <input
                className="input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABCD12"
                autoFocus
                autoCapitalize="characters"
                style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
              />
            </label>
            <button type="submit" className="btn btn--primary btn--large" disabled={!code.trim()}>
              Join
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
