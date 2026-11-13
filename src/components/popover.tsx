"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const MENU_WIDTH = 224;
const GAP = 8;
const ITEM = '[role^="menuitem"]';

/**
 * Accessible menu button.
 * - Rendered in a portal with fixed positioning so scrolling containers never clip it.
 * - Opening focuses the checked (or first) item; Up/Down/Home/End move, Escape/Tab close
 *   and return focus to the trigger.
 */
export function Popover({
  label,
  trigger,
  children,
  align = "right",
  className = "",
  triggerProps,
  title,
  disabled = false,
}: {
  label: string;
  /** Shown at the top of the menu so you know what you're editing. */
  title?: string;
  trigger: ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
  className?: string;
  triggerProps?: Record<string, string>;
  /** E.g. while an action from this menu is still saving. */
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const buttonId = useId();

  const close = () => {
    setOpen(false);
    document.getElementById(buttonId)?.focus();
  };

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) return;
    const b = buttonRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxHeight = vh - GAP * 2;
    const h = Math.min(menuRef.current.scrollHeight, maxHeight);
    let left = align === "right" ? b.right - MENU_WIDTH : b.left;
    left = Math.min(Math.max(GAP, left), vw - MENU_WIDTH - GAP);
    let top = b.bottom + GAP;
    if (top + h > vh - GAP) {
      if (b.top - GAP - h >= GAP) {
        top = b.top - GAP - h; // above
      } else {
        // Fits neither below nor above: open beside the trigger so the card stays visible.
        top = Math.max(GAP, Math.min(b.top, vh - GAP - h));
        const beside = b.left - GAP - MENU_WIDTH;
        left = beside >= GAP ? beside : Math.min(b.right + GAP, vw - MENU_WIDTH - GAP);
      }
    }
    setPos({ top, left, maxHeight });
  }, [open, align]);

  // Move focus in once the menu is positioned (hidden elements can't take focus).
  useEffect(() => {
    if (!open || !pos || !menuRef.current) return;
    const items = [...menuRef.current.querySelectorAll<HTMLElement>(ITEM)];
    (items.find((i) => i.getAttribute("aria-checked") === "true") ?? items[0])?.focus({ preventScroll: true });
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    let width = window.innerWidth;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const start = buttonRef.current?.getBoundingClientRect();
    // Close when the page scroll moves the trigger away from the menu (not on scroll
    // adjustments that leave it in place, e.g. content shrinking while ticking filters).
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      const r = buttonRef.current?.getBoundingClientRect();
      if (start && r && Math.abs(r.top - start.top) < 1 && Math.abs(r.left - start.left) < 1) return;
      setOpen(false);
    };
    // Mobile URL bars change the height while scrolling; only a width change moves the trigger.
    const onResize = () => {
      if (window.innerWidth !== width) setOpen(false);
      width = window.innerWidth;
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>(ITEM) ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape" || e.key === "Tab") {
      e.preventDefault();
      close();
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        draggable={false}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setPos(null);
          setOpen((o) => !o);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setPos(null);
            setOpen(true);
          }
        }}
        className={className}
        {...triggerProps}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={onMenuKey}
            onClick={(e) => e.stopPropagation()}
            style={{
              top: pos?.top ?? 0,
              left: pos?.left ?? 0,
              width: MENU_WIDTH,
              maxHeight: pos?.maxHeight,
              visibility: pos ? "visible" : "hidden",
            }}
            className="fixed z-50 overflow-y-auto overscroll-contain rounded-2xl border border-line bg-surface p-1.5 shadow-[0_12px_40px_rgba(0,0,0,.14)]"
          >
            {title && (
              <p role="presentation" className="truncate border-b border-line px-2.5 pb-2 pt-1.5 text-sm font-semibold">
                {title}
              </p>
            )}
            {children(() => close())}
          </div>,
          document.body,
        )}
    </>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <p role="presentation" className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
      {children}
    </p>
  );
}

export function MenuItem({
  onSelect,
  active,
  kind = "radio",
  children,
}: {
  onSelect: () => void;
  active?: boolean;
  /** radio: pick one option · checkbox: toggle one of several · action: a one-off command. */
  kind?: "radio" | "checkbox" | "action";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      {...(kind === "action"
        ? { role: "menuitem" }
        : { role: kind === "radio" ? "menuitemradio" : "menuitemcheckbox", "aria-checked": Boolean(active) })}
      tabIndex={-1}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect();
      }}
      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm md:py-1.5 outline-none transition hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand/40 ${
        active ? "font-semibold text-ink" : "text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}
