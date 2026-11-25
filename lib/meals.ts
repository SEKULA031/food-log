// Meal storage for the MVP: everything lives in localStorage on the device.

export type Slot = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export type Meal = {
  id: string;
  name: string;
  slot: Slot;
  eatenAt: string; // ISO timestamp
  kcal: number;
  protein: number; // grams
  carbs: number; // grams
  fat: number; // grams
  photo?: string;
  sample?: boolean;
};

const KEY = "weate:meals:v1";
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((cb) => cb());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

// Raw string snapshot keeps the reference stable between renders.
export function getSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function getServerSnapshot(): string | null {
  return null;
}

export function parseMeals(raw: string | null): Meal[] {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as Meal[]) : [];
  } catch {
    return [];
  }
}

function save(meals: Meal[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(meals));
  } catch {
    // Storage blocked (private mode): the session keeps working without saving.
  }
  notify();
}

export function addMeal(meal: Meal) {
  save([...parseMeals(getSnapshot()), meal]);
}

export function removeMeal(id: string) {
  save(parseMeals(getSnapshot()).filter((m) => m.id !== id));
}

export function clearSample() {
  save(parseMeals(getSnapshot()).filter((m) => !m.sample));
}

// First visit only: show a sample day so the diary isn't empty.
export function seedSampleIfEmpty() {
  if (getSnapshot() !== "") return;
  const at = (daysAgo: number, h: number, m: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  save([
    { id: "s1", name: "Oatmeal and coffee", slot: "Breakfast", eatenAt: at(1, 8, 0), kcal: 380, protein: 12, carbs: 58, fat: 10, sample: true },
    { id: "s2", name: "Turkey sandwich", slot: "Lunch", eatenAt: at(1, 12, 40), kcal: 540, protein: 34, carbs: 52, fat: 20, sample: true },
    { id: "s3", name: "Salmon and potatoes", slot: "Dinner", eatenAt: at(1, 19, 15), kcal: 690, protein: 41, carbs: 48, fat: 34, sample: true },
    { id: "s4", name: "Greek yogurt and berries", slot: "Breakfast", eatenAt: at(0, 8, 10), kcal: 320, protein: 22, carbs: 38, fat: 9, sample: true },
    { id: "s5", name: "Chicken rice bowl", slot: "Lunch", eatenAt: at(0, 13, 5), kcal: 620, protein: 42, carbs: 68, fat: 18, sample: true },
  ]);
}

// Clock snapshot, updated once a minute.
export function subscribeMinute(cb: () => void) {
  const t = setInterval(cb, 30_000);
  return () => clearInterval(t);
}

export function getMinute(): number {
  return Math.floor(Date.now() / 60_000);
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function slotAt(d: Date): Slot {
  const h = d.getHours();
  if (h >= 5 && h < 11) return "Breakfast";
  if (h >= 11 && h < 16) return "Lunch";
  if (h >= 16 && h < 22) return "Dinner";
  return "Snack";
}

export const SLOT_ORDER: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

// Yesterday's meal for the current slot, if today's slot is still empty.
export function suggestion(meals: Meal[], now: Date): Meal | null {
  const slot = slotAt(now);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const loggedToday = meals.some(
    (m) => m.slot === slot && sameDay(new Date(m.eatenAt), now),
  );
  if (loggedToday) return null;
  return (
    meals.find(
      (m) => m.slot === slot && sameDay(new Date(m.eatenAt), yesterday),
    ) ?? null
  );
}
