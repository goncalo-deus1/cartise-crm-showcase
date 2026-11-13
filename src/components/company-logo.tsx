"use client";

import { useState } from "react";

/**
 * Company logo (the domain's icon, fetched by /api/logo), with the first letter as a
 * fallback when there's no domain or no icon.
 */
export function CompanyLogo({ name, domain, size = 24 }: { name: string; domain: string | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null);
  const letter = (name.trim()[0] ?? "?").toUpperCase();
  const box = { width: size, height: size };

  if (!domain || failed === domain) {
    return (
      <span
        aria-hidden
        style={{ ...box, fontSize: Math.round(size * 0.46) }}
        className="grid shrink-0 place-items-center rounded-md bg-surface-2 font-semibold text-ink-2"
      >
        {letter}
      </span>
    );
  }

  // The server-rendered <img> can fail before React is listening, so onError alone isn't
  // enough: check on mount, and listen natively until it settles.
  const watch = (img: HTMLImageElement | null) => {
    if (!img) return;
    const fail = () => setFailed(domain);
    if (img.complete) {
      if (img.naturalWidth === 0) fail();
      return;
    }
    img.addEventListener("error", fail, { once: true });
    return () => img.removeEventListener("error", fail);
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny icon, already cached by /api/logo
    <img
      ref={watch}
      src={`/api/logo?d=${encodeURIComponent(domain)}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={box}
      className="shrink-0 rounded-md bg-white object-contain ring-1 ring-line"
    />
  );
}
