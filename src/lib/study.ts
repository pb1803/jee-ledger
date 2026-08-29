import type { Subject } from "./types";

export type Stat = {
  attempted: number;
  correct: number;
  incorrect: number;
};

export type SubjectStats = Record<Subject, Stat>;

export function emptyStats(): SubjectStats {
  return {
    PHYSICS: { attempted: 0, correct: 0, incorrect: 0 },
    CHEMISTRY: { attempted: 0, correct: 0, incorrect: 0 },
    MATHEMATICS: { attempted: 0, correct: 0, incorrect: 0 },
  };
}

export function subjectAccuracy(
  attempted: number,
  correct: number,
): number | null {
  if (!attempted || attempted <= 0) return null;
  return (correct / attempted) * 100;
}

export function totals(stats: SubjectStats) {
  let attempted = 0;
  let correct = 0;
  let incorrect = 0;
  (Object.keys(stats) as Subject[]).forEach((s) => {
    attempted += stats[s].attempted || 0;
    correct += stats[s].correct || 0;
    incorrect += stats[s].incorrect || 0;
  });
  return { attempted, correct, incorrect };
}

// Overall accuracy is total correct / total attempted (NOT an average of the
// three subject percentages, which would weight small subjects equally).
export function overallAccuracy(stats: SubjectStats): number | null {
  const t = totals(stats);
  if (t.attempted <= 0) return null;
  return (t.correct / t.attempted) * 100;
}

export function todayISO(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function prettySubject(subject: Subject): string {
  if (subject === "MATHEMATICS") return "Mathematics";
  return subject[0] + subject.slice(1).toLowerCase();
}
