"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isOffline, OFFLINE_SAVE_MESSAGE } from "@/lib/network";

type GoalMetric = "QUESTIONS_SOLVED" | "STUDY_MINUTES";

interface InitialGoal {
  id: string;
  metric: GoalMetric;
  target_value: number;
}

interface Block {
  value: string;
  id: string | null;
  saving: boolean;
  error: string | null;
  saved: boolean;
}

const DEFS: {
  metric: GoalMetric;
  label: string;
  unit: string;
  max: number;
  hint: string;
}[] = [
  {
    metric: "QUESTIONS_SOLVED",
    label: "Daily Question Target",
    unit: "questions",
    max: 1000,
    hint: "How many questions to solve per day (max 1000).",
  },
  {
    metric: "STUDY_MINUTES",
    label: "Daily Study Time Target",
    unit: "minutes",
    max: 1440,
    hint: "Minutes of study per day (max 24h / 1440 min).",
  },
];

function emptyBlock(): Block {
  return { value: "", id: null, saving: false, error: null, saved: false };
}

export function GoalForm({
  userId,
  initialGoals,
}: {
  userId: string;
  initialGoals: InitialGoal[];
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Record<GoalMetric, Block>>(() => {
    const base = {
      QUESTIONS_SOLVED: emptyBlock(),
      STUDY_MINUTES: emptyBlock(),
    } as Record<GoalMetric, Block>;
    for (const g of initialGoals) {
      base[g.metric] = {
        value: String(g.target_value),
        id: g.id,
        saving: false,
        error: null,
        saved: false,
      };
    }
    return base;
  });

  function setBlock(metric: GoalMetric, patch: Partial<Block>) {
    setBlocks((prev) => ({ ...prev, [metric]: { ...prev[metric], ...patch } }));
  }

  async function saveGoal(metric: GoalMetric) {
    const def = DEFS.find((d) => d.metric === metric)!;
    const block = blocks[metric];
    setBlock(metric, { error: null, saved: false });

    if (isOffline()) {
      setBlock(metric, { error: OFFLINE_SAVE_MESSAGE });
      return;
    }

    const raw = block.value.trim();
    if (raw === "") {
      setBlock(metric, { error: "Enter a target value." });
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
      setBlock(metric, { error: "Target must be a whole number greater than 0." });
      return;
    }
    if (n > def.max) {
      setBlock(metric, { error: `Keep it at or below ${def.max} ${def.unit}.` });
      return;
    }

    setBlock(metric, { saving: true });
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("goals")
        .upsert(
          {
            student_id: userId,
            frequency: "DAILY",
            metric,
            target_value: n,
          },
          { onConflict: "student_id,frequency,metric" },
        )
        .select("id")
        .single();
      if (error) throw error;
      setBlock(metric, {
        saving: false,
        saved: true,
        id: (data as { id: string }).id,
      });
      router.refresh();
    } catch (err) {
      setBlock(metric, {
        saving: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not save goal.",
      });
    }
  }

  async function removeGoal(metric: GoalMetric) {
    const block = blocks[metric];
    if (!block.id) return;
    if (!window.confirm("Remove this daily target?")) return;
    setBlock(metric, { error: null });
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", block.id);
      if (error) throw error;
      setBlock(metric, { value: "", id: null, saved: false });
      router.refresh();
    } catch (err) {
      setBlock(metric, {
        error: err instanceof Error ? err.message : "Could not remove goal.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {DEFS.map((def) => {
        const b = blocks[def.metric];
        const hasGoal = b.id != null;
        return (
          <div
            key={def.metric}
            className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{def.label}</h2>
              {hasGoal && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Set
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-zinc-500">{def.hint}</p>

            <label className="mt-3 flex flex-col gap-1 text-sm">
              <span className="text-zinc-600 dark:text-zinc-300">
                Target ({def.unit})
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={def.max}
                step={1}
                value={b.value}
                onChange={(e) =>
                  setBlock(def.metric, { value: e.target.value, saved: false })
                }
                placeholder={hasGoal ? String(b.value) : "—"}
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-lg dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            {b.error && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {b.error}
              </p>
            )}
            {b.saved && !b.error && (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Saved.
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => saveGoal(def.metric)}
                disabled={b.saving}
                className="flex-1 rounded-lg bg-sky-600 px-3 py-2.5 font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60"
              >
                {b.saving ? "Saving…" : hasGoal ? "Update" : "Set Target"}
              </button>
              {hasGoal && (
                <button
                  type="button"
                  onClick={() => removeGoal(def.metric)}
                  className="rounded-lg border border-red-300 px-3 py-2.5 font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
