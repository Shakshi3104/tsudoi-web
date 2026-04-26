import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { User } from "firebase/auth";
import { subscribeToAuth } from "../lib/auth";
import UserMenu, { GearIcon } from "../components/UserMenu";

const CODE_LENGTH = 6;
const CODE_CHARS = /^[A-Z0-9]$/;

function sanitize(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .filter((ch) => CODE_CHARS.test(ch))
    .join("")
    .slice(0, CODE_LENGTH);
}

function CodeInput({
  value,
  onChange,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(CODE_LENGTH, " ").split("").slice(0, CODE_LENGTH);

  const focusCell = (index: number) => {
    const clamped = Math.max(0, Math.min(CODE_LENGTH - 1, index));
    refs.current[clamped]?.focus();
  };

  const handleChange = (index: number, raw: string) => {
    const clean = sanitize(raw);
    if (clean.length === 0 && raw.length === 0) {
      const next = chars.slice();
      next[index] = " ";
      const trimmed = next.join("").trim();
      onChange(trimmed);
      return;
    }
    if (clean.length > 1) {
      // user typed/pasted multiple chars at once
      const merged = sanitize(value.slice(0, index) + clean);
      onChange(merged);
      focusCell(Math.min(merged.length, CODE_LENGTH - 1));
      if (merged.length === CODE_LENGTH) onComplete(merged);
      return;
    }
    const next = chars.slice();
    next[index] = clean;
    const joined = next.join("").trim();
    onChange(joined);
    if (index < CODE_LENGTH - 1) focusCell(index + 1);
    if (joined.length === CODE_LENGTH) onComplete(joined);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[index].trim() && index > 0) {
      e.preventDefault();
      const next = chars.slice();
      next[index - 1] = " ";
      onChange(next.join("").trim());
      focusCell(index - 1);
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusCell(index - 1);
    } else if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      e.preventDefault();
      focusCell(index + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = sanitize(e.clipboardData.getData("text"));
    if (!pasted) return;
    onChange(pasted);
    focusCell(Math.min(pasted.length, CODE_LENGTH - 1));
    if (pasted.length === CODE_LENGTH) onComplete(pasted);
  };

  return (
    <div className="code-input">
      {chars.map((ch, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="code-input__cell"
          value={ch.trim()}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-label={`Event code character ${i + 1}`}
        />
      ))}
    </div>
  );
}

export default function Home() {
  const [code, setCode] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => subscribeToAuth(setUser), []);

  const submit = (value: string) => {
    const trimmed = value.trim().toUpperCase();
    if (trimmed.length !== CODE_LENGTH) return;
    navigate(`/join/${trimmed}`);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submit(code);
  };

  useEffect(() => {
    // Focus the first cell on mount
    const first = document.querySelector<HTMLInputElement>(".code-input__cell");
    first?.focus();
  }, []);

  const ready = code.length === CODE_LENGTH;

  return (
    <main className="home-screen">
      <div className="home-toolbar">
        <UserMenu
          user={user}
          items={[
            {
              label: "Admin login",
              icon: <GearIcon />,
              onSelect: () => navigate("/admin"),
            },
          ]}
        />
      </div>
      <form onSubmit={handleFormSubmit} className="home-panel">
        <div className="home-panel__brand">Tsudoi</div>
        <h1 className="home-panel__title">Join an event</h1>
        <p className="home-panel__subtitle">
          Enter the 6-character code you were given.
        </p>
        <CodeInput value={code} onChange={setCode} onComplete={submit} />
        <button
          type="submit"
          className="btn btn--primary btn--large home-panel__action"
          disabled={!ready}
        >
          Join
        </button>
      </form>
    </main>
  );
}
