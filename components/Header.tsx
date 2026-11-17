"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
export function Header({ username = "" }: { username?: string }) {
  const router = useRouter();
  const [light, setLight] = useState(false);
  useEffect(() => {
    const value = localStorage.getItem("todo-theme") === "light";
    setLight(value);
    document.documentElement.dataset.theme = value ? "light" : "dark";
  }, []);
  return (
    <header className="topbar">
      <Link href="/" className="brand">
        <span className="brand-icon">✓</span> Todo Workshop
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/">Tasks</Link>
        <Link href="/calendar">Calendar</Link>
        <button
          className="subtle"
          onClick={() => {
            document.documentElement.dataset.theme = light ? "dark" : "light";
            localStorage.setItem("todo-theme", light ? "dark" : "light");
            setLight(!light);
          }}
          aria-label="Toggle color theme"
        >
          {light ? "Dark" : "Light"} mode
        </button>
        <span className="username">{username}</span>
        <button
          className="subtle"
          onClick={async () => {
            await api("/api/auth/logout", "POST");
            router.replace("/login");
            router.refresh();
          }}
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
