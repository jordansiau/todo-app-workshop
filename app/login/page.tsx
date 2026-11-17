"use client";
import { useState } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
export default function Login() {
  const router = useRouter();
  const [register, setRegister] = useState(false),
    [username, setUsername] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!window.PublicKeyCredential)
        throw new Error(
          "This browser does not support passkeys. Use a current browser on HTTPS or localhost.",
        );
      const action = register ? "register" : "login";
      const options = await api<
        PublicKeyCredentialCreationOptionsJSON &
          PublicKeyCredentialRequestOptionsJSON
      >(`/api/auth/${action}-options`, "POST", { username });
      const response = register
        ? await startRegistration({ optionsJSON: options })
        : await startAuthentication({ optionsJSON: options });
      await api(`/api/auth/${action}-verify`, "POST", response);
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.name === "NotAllowedError"
            ? "Passkey request was cancelled. Try again."
            : e.message
          : "Unable to sign in",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="brand-icon large">✓</div>
        <p className="eyebrow">A LITTLE MORE FOCUS</p>
        <h1>Todo Workshop</h1>
        <p className="muted">
          {register
            ? "Create your workspace with a secure passkey."
            : "Welcome back. Make room for what matters."}
        </p>
        <form onSubmit={submit}>
          <label>
            Username
            <input
              autoComplete="username webauthn"
              required
              minLength={3}
              maxLength={50}
              pattern="[a-zA-Z0-9_.\-]+"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
            />
          </label>
          <p className="hint">
            Use your fingerprint, face, device PIN, or security key. No password
            needed.
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy}>
            {busy
              ? "Waiting for your passkey…"
              : register
                ? "Register with passkey"
                : "Sign in with passkey"}
          </button>
        </form>
        <p className="auth-switch">
          {register ? "Already registered?" : "New here?"}{" "}
          <button
            className="link"
            disabled={busy}
            onClick={() => {
              setRegister(!register);
              setError("");
            }}
          >
            {register ? "Sign in" : "Register"}
          </button>
        </p>
        <small>All dates and reminders use Singapore time (SGT).</small>
      </section>
    </main>
  );
}
