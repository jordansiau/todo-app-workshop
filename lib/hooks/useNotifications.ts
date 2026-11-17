"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { Todo } from "@/lib/db";
export function useNotifications() {
  const [permission, setPermission] = useState<string>("default");
  const [error, setError] = useState("");
  useEffect(
    () =>
      setPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      ),
    [],
  );
  const request = useCallback(async () => {
    try {
      if ("Notification" in window)
        setPermission(await Notification.requestPermission());
    } catch {
      setError("Notifications are unavailable in this browser.");
    }
  }, []);
  useEffect(() => {
    if (permission !== "granted") return;
    let active = true;
    const poll = async () => {
      try {
        const tasks = await api<Todo[]>("/api/notifications/check");
        if (active)
          for (const t of tasks)
            new Notification(t.title, {
              body: "Your task is due soon.",
              tag: `todo-${t.id}-${t.due_date}`,
            });
      } catch {
        if (active)
          setError("Reminder check failed. It will retry in 30 seconds.");
      }
    };
    void poll();
    const timer = setInterval(poll, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [permission]);
  return { permission, request, error };
}
