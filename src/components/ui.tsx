import { cloneElement, isValidElement, useId, type ComponentProps, type ReactElement, type ReactNode } from "react";

export const inputClass =
  "h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base outline-none transition placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand/30 md:text-[15px]";

export function Field({
  label,
  error,
  hint,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const msgId = `${useId()}-msg`;
  // Wire the message to the control so screen readers announce it with the field.
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error || hint ? msgId : undefined,
      })
    : children;
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-ink-2">{label}</span>
      {control}
      {error ? (
        <span id={msgId} className="mt-1 block text-sm text-bad">
          {error}
        </span>
      ) : hint ? (
        <span id={msgId} className="mt-1 block text-xs text-ink-3">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  // A background passed in className (e.g. an owner tint) replaces the default white.
  const bg = /(^|\s)bg-/.test(className) ? "" : "bg-surface";
  return <div className={`rounded-3xl ${bg} p-5 md:p-6 ${className}`} {...props} />;
}

export function StageBadge({ label, dot, compact = false }: { label: string; dot: string; compact?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 bg-surface-2 text-xs font-semibold text-ink-2 ${
        compact ? "whitespace-nowrap rounded-md px-2 py-0.5" : "rounded-full px-2.5 py-1"
      }`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

export function PrimaryButton({ className = "", ...props }: ComponentProps<"button">) {
  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
