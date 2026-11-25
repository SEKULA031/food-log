"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  type Meal,
  SLOT_ORDER,
  addMeal,
  clearSample,
  getMinute,
  getServerSnapshot,
  getSnapshot,
  parseMeals,
  removeMeal,
  sameDay,
  seedSampleIfEmpty,
  slotAt,
  subscribe,
  subscribeMinute,
  suggestion,
} from "@/lib/meals";

const DAILY_GOAL = 2000;
const nf = new Intl.NumberFormat("en-US");

export default function Today() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const minute = useSyncExternalStore(subscribeMinute, getMinute, () => null);
  const meals = useMemo(() => parseMeals(raw), [raw]);
  const [toast, setToast] = useState<{ id: string; name: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    seedSampleIfEmpty();
  }, []);

  if (raw === null || minute === null) return <TodaySkeleton />;

  const now = new Date(minute * 60_000);
  const today = meals
    .filter((m) => sameDay(new Date(m.eatenAt), now))
    .sort(
      (a, b) =>
        SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) ||
        a.eatenAt.localeCompare(b.eatenAt),
    );
  const total = sum(today);
  const left = DAILY_GOAL - total.kcal;
  const suggested = suggestion(meals, now);
  const hasSample = meals.some((m) => m.sample);

  function logAgain(meal: Meal) {
    const id = crypto.randomUUID();
    addMeal({
      ...meal,
      id,
      eatenAt: new Date().toISOString(),
      slot: slotAt(new Date()),
      sample: false,
    });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id, name: meal.name });
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }

  function undo() {
    if (!toast) return;
    removeMeal(toast.id);
    setToast(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-32 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header>
        <p className="text-sm text-muted">
          {now.toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-1 flex items-baseline gap-3">
          <span className="num condensed text-7xl font-bold leading-none tracking-tight">
            {nf.format(Math.abs(left))}
          </span>
          <span className="text-lg text-muted">
            {left >= 0 ? "kcal left" : "kcal over"}
          </span>
        </h1>
        <p className="num mt-2 text-sm text-muted">
          {nf.format(total.kcal)} of {nf.format(DAILY_GOAL)} kcal eaten
        </p>
        <BudgetStrip protein={total.protein} carbs={total.carbs} fat={total.fat} />
      </header>

      <section aria-labelledby="diary-heading" className="mt-10">
        <h2 id="diary-heading" className="sr-only">
          Today&apos;s meals
        </h2>
        {today.length === 0 ? (
          <p className="text-muted">
            Nothing logged yet today. Snap your first meal below.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {today.map((m) => (
              <MealRow key={m.id} meal={m} />
            ))}
          </ul>
        )}
      </section>

      {suggested && (
        <section aria-labelledby="again-heading" className="mt-8 border-t border-line pt-6">
          <h2 id="again-heading" className="text-lg font-semibold">
            Same {suggested.slot.toLowerCase()} as yesterday?
          </h2>
          <div className="mt-3 flex items-center gap-4">
            <Thumb meal={suggested} />
            <div className="min-w-0 flex-1">
              <p className="truncate">{suggested.name}</p>
              <p className="num text-sm text-muted">{nf.format(suggested.kcal)} kcal</p>
            </div>
            <button
              type="button"
              onClick={() => logAgain(suggested)}
              className="h-11 rounded-xl border-2 border-accent px-4 font-semibold text-accent active:scale-[0.97] motion-reduce:active:scale-100"
            >
              Log it
            </button>
          </div>
        </section>
      )}

      {hasSample && (
        <p className="mt-10 text-sm text-muted">
          This is a sample day.{" "}
          <button type="button" onClick={clearSample} className="underline underline-offset-4">
            Clear sample meals
          </button>
        </p>
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-28 mx-auto flex max-w-md items-center justify-between rounded-xl bg-content px-4 py-3 text-canvas"
        >
          <span className="truncate">Logged {toast.name.toLowerCase()}.</span>
          <button type="button" onClick={undo} className="ml-4 font-semibold underline underline-offset-4">
            Undo
          </button>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 bg-canvas/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <Link
          href="/log"
          className="mx-auto flex h-16 max-w-md items-center justify-center rounded-2xl bg-accent text-lg font-semibold text-on-accent active:scale-[0.98] motion-reduce:active:scale-100"
        >
          Log a meal
        </Link>
      </div>
    </main>
  );
}

function sum(meals: Meal[]) {
  return meals.reduce(
    (t, m) => ({
      kcal: t.kcal + m.kcal,
      protein: t.protein + m.protein,
      carbs: t.carbs + m.carbs,
      fat: t.fat + m.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

// Daily budget as one bar: macro calories in three accent tints, rest is empty track.
function BudgetStrip({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const parts = [
    { label: "Protein", grams: protein, kcal: protein * 4, tone: "bg-accent" },
    { label: "Carbs", grams: carbs, kcal: carbs * 4, tone: "bg-accent/55" },
    { label: "Fat", grams: fat, kcal: fat * 9, tone: "bg-accent/25" },
  ];
  let room = 100;
  return (
    <div className="mt-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-line" aria-hidden="true">
        {parts.map((p) => {
          const w = Math.min(room, (p.kcal / DAILY_GOAL) * 100);
          room -= w;
          return <div key={p.label} className={p.tone} style={{ width: `${w}%` }} />;
        })}
      </div>
      <ul className="mt-3 flex gap-5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2">
            <span className={`size-2.5 rounded-full ${p.tone}`} aria-hidden="true" />
            <span className="text-muted">{p.label}</span>
            <span className="num font-medium">{p.grams} g</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MealRow({ meal }: { meal: Meal }) {
  const time = new Date(meal.eatenAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <li className="flex items-center gap-4 py-4">
      <Thumb meal={meal} large />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-medium">{meal.name}</p>
        <p className="text-sm text-muted">
          {meal.slot}, {time}
        </p>
      </div>
      <p className="num text-lg font-semibold">{nf.format(meal.kcal)}</p>
    </li>
  );
}

// Meal photo; until capture exists, a tinted tile with the meal's initial.
function Thumb({ meal, large = false }: { meal: Meal; large?: boolean }) {
  const size = large ? "size-18" : "size-12";
  if (meal.photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local data URL from the camera
      <img src={meal.photo} alt={meal.name} className={`${size} shrink-0 rounded-xl object-cover`} />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`${size} condensed flex shrink-0 items-center justify-center rounded-xl bg-accent/10 text-2xl font-bold text-accent`}
    >
      {meal.name.charAt(0)}
    </div>
  );
}

function TodaySkeleton() {
  return (
    <main aria-busy="true" className="mx-auto min-h-dvh max-w-md px-4 pt-6">
      <div className="h-4 w-32 rounded bg-line" />
      <div className="mt-3 h-16 w-48 rounded bg-line" />
      <div className="mt-6 h-3 rounded-full bg-line" />
    </main>
  );
}
