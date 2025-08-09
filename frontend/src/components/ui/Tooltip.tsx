import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children, className }) => {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    placement: "top" | "bottom";
  } | null>(null);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const preferredPlacement: "top" | "bottom" =
      rect.top > viewportHeight / 2 ? "top" : "bottom";
    const offset = 8; // px gap from trigger
    const top =
      preferredPlacement === "top" ? rect.top - offset : rect.bottom + offset;
    const triggerCenter = rect.left + rect.width / 2;
    // Fixed width per breakpoint for consistent readability
    const tooltipWidth = window.matchMedia("(min-width: 768px)").matches
      ? 384
      : 320; // md: 24rem, base: 20rem
    const half = tooltipWidth / 2;
    // Clamp so the tooltip stays within viewport with a small margin
    const margin = 12;
    const minLeft = margin + half;
    const maxLeft = window.innerWidth - margin - half;
    const clampedLeft = Math.min(Math.max(triggerCenter, minLeft), maxLeft);
    setCoords({ top, left: clampedLeft, placement: preferredPlacement });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <span
      ref={triggerRef}
      className={`inline-flex items-center ${className ?? ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && coords && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position: "fixed",
                top: coords.top,
                left: coords.left,
                transform: `translate(-50%, ${coords.placement === "top" ? "-100%" : "0"})`,
                zIndex: 9999,
              }}
              className="pointer-events-none w-80 md:w-96 whitespace-normal break-words rounded-md border border-white/30 bg-white/95 px-3 py-2 text-xs md:text-sm leading-snug text-gray-800 shadow-2xl backdrop-blur-sm"
            >
              {content}
              <div
                className={
                  coords.placement === "top"
                    ? "absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-l border-t border-white/30 bg-white/95"
                    : "absolute left-1/2 -top-1 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-white/30 bg-white/95"
                }
              />
            </div>,
            document.body
          )
        : null}
    </span>
  );
};

export default Tooltip;
