"use client";

export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div className="grid place-items-center rounded-3xl bg-surface px-6 py-16 text-center">
      <h2 className="font-display text-xl font-semibold">Algo correu mal</h2>
      <p className="mt-2 max-w-sm text-sm text-ink-2">
        Pode ter sido a ligação ou uma nova versão da app. Tenta outra vez.
      </p>
      <button
        onClick={() => retry()}
        className="mt-5 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-black/85"
      >
        Tentar outra vez
      </button>
    </div>
  );
}
