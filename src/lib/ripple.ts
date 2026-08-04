/** Global click ripple: a satisfying circle that expands from the press point. */
export function installRipple() {
  if (typeof document === "undefined") return () => {};
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  const onPointerDown = (event: PointerEvent) => {
    // Respect the in-app reduced-motion toggle, checked at click time.
    if (document.documentElement.dataset["reducedMotion"] === "true") return;
    const target = event.target as HTMLElement | null;
    const host = target?.closest<HTMLElement>(
      "button, [role='button'], a[data-ripple], [data-ripple]",
    );
    if (!host || host.hasAttribute("disabled") || host.dataset["ripple"] === "off") return;

    const rect = host.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const style = getComputedStyle(host);
    if (style.position === "static") host.style.position = "relative";
    if (style.overflow === "visible") host.style.overflow = "hidden";

    const size = Math.max(rect.width, rect.height) * 2;
    const span = document.createElement("span");
    span.className = "cc-ripple";
    span.style.width = `${size}px`;
    span.style.height = `${size}px`;
    span.style.left = `${event.clientX - rect.left - size / 2}px`;
    span.style.top = `${event.clientY - rect.top - size / 2}px`;
    span.addEventListener("animationend", () => span.remove());
    host.appendChild(span);
    window.setTimeout(() => span.remove(), 800);
  };

  document.addEventListener("pointerdown", onPointerDown, true);
  return () => document.removeEventListener("pointerdown", onPointerDown, true);
}
