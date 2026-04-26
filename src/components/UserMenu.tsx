import { useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { signOut } from "../lib/auth";

export type UserMenuItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
};

function initials(user: User): string {
  const source = user.displayName ?? user.email ?? "?";
  const parts = source.trim().split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function PersonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

function Avatar({
  user,
  size,
  imgError,
  onImgError,
}: {
  user: User | null;
  size: "sm" | "lg";
  imgError: boolean;
  onImgError: () => void;
}) {
  const sizeClass = size === "lg" ? " user-menu__avatar--lg" : "";
  if (!user) {
    return (
      <span className={`user-menu__avatar user-menu__avatar--guest${sizeClass}`}>
        <PersonIcon />
      </span>
    );
  }
  const showImage = user.photoURL && !imgError;
  if (showImage) {
    return (
      <img
        className={`user-menu__avatar${sizeClass}`}
        src={user.photoURL ?? ""}
        alt=""
        referrerPolicy="no-referrer"
        onError={onImgError}
      />
    );
  }
  return (
    <span className={`user-menu__avatar user-menu__avatar--initials${sizeClass}`}>
      {initials(user)}
    </span>
  );
}

function MenuItem({ item }: { item: UserMenuItem & { onClick: () => void } }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`user-menu__item${
        item.destructive ? " user-menu__item--destructive" : ""
      }`}
      onClick={item.onClick}
    >
      {item.icon && <span className="user-menu__item-icon">{item.icon}</span>}
      <span className="user-menu__item-label">{item.label}</span>
    </button>
  );
}

export default function UserMenu({
  user,
  items,
}: {
  user: User | null;
  items?: UserMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const buttonLabel = user
    ? user.displayName ?? user.email ?? "Account"
    : "Menu";
  const hasItems = items && items.length > 0;

  const close = () => setOpen(false);

  return (
    <div className="user-menu" ref={wrapRef}>
      <button
        type="button"
        className="user-menu__button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={user ? "Account menu" : "Menu"}
        title={buttonLabel}
      >
        <Avatar
          user={user}
          size="sm"
          imgError={imgError}
          onImgError={() => setImgError(true)}
        />
      </button>
      {open && (
        <div className="user-menu__dropdown" role="menu">
          {user && (
            <>
              <div className="user-menu__identity">
                <Avatar
                  user={user}
                  size="lg"
                  imgError={imgError}
                  onImgError={() => setImgError(true)}
                />
                <div className="user-menu__identity-text">
                  {user.displayName && (
                    <div className="user-menu__name">{user.displayName}</div>
                  )}
                  <div className="user-menu__email">{user.email}</div>
                </div>
              </div>
              <div className="user-menu__divider" />
            </>
          )}
          {items?.map((item) => (
            <MenuItem
              key={item.label}
              item={{
                ...item,
                onClick: () => {
                  close();
                  item.onSelect();
                },
              }}
            />
          ))}
          {user && (
            <>
              {hasItems && <div className="user-menu__divider" />}
              <MenuItem
                item={{
                  label: "Sign out",
                  destructive: true,
                  icon: <SignOutIcon />,
                  onSelect: () => {},
                  onClick: () => {
                    close();
                    signOut();
                  },
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export { GearIcon, SignOutIcon, PersonIcon };
