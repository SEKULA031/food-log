import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Log a meal | weate",
  description: "Snap or say your meal and weate fills in the calories.",
};

// Placeholder until the capture screen is built.
export default function LogPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <h1 className="text-3xl font-bold">Camera logging comes next</h1>
      <p className="mt-3 text-muted">
        Soon you&apos;ll snap or say a meal here. For now, try the sample day on the Today screen.
      </p>
      <Link href="/" className="mt-8 font-semibold text-accent underline underline-offset-4">
        Back to today
      </Link>
    </main>
  );
}
