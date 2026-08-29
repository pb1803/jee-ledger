"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Viewer = {
  viewer_email: string;
  created_at: string;
};

export function MentorsForm() {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const supabase = createClient();
    const { data } = await supabase
      .from("viewer_access")
      .select("viewer_email, created_at")
      .order("created_at", { ascending: true });
    setViewers(data ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function grant() {
    setError(null);
    setNotice(null);
    const value = email.trim().toLowerCase();
    if (!value) {
      setError("Enter the mentor's account email.");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("grant_viewer_access", {
        viewer_email: value,
      });
      if (error) throw error;
      setEmail("");
      setNotice("Access granted. The mentor can now open the overview.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not grant access. The mentor must create an account first.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function revoke(viewerEmail: string) {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("revoke_viewer_access", {
        viewer_email: viewerEmail,
      });
      if (error) throw error;
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke access.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Share a read-only overview with a parent or mentor. They must first
        create their own account (choose “Parent / Mentor” at signup), then you
        grant access by their email below. They cannot add or change any data.
      </p>

      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="mentor@example.com"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="button"
          onClick={grant}
          disabled={loading}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          Grant
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
          {notice}
        </p>
      )}

      {viewers.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {viewers.map((v) => (
            <li
              key={v.viewer_email}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
            >
              <span className="truncate text-sm">{v.viewer_email}</span>
              <button
                type="button"
                onClick={() => revoke(v.viewer_email)}
                disabled={loading}
                className="ml-2 shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-red-600 dark:border-zinc-700"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-400">No mentors have access yet.</p>
      )}
    </div>
  );
}
