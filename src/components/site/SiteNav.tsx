import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import courseCompassLogo from "@/assets/course-compass-logo.png";

const links = [
  { to: "/", label: "Home", exact: true },
  { to: "/features", label: "Features" },
  { to: "/demo", label: "Demo" },
  { to: "/pricing", label: "Pricing" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link
          to="/"
          className="font-paper-display flex min-w-0 items-center gap-2 text-lg font-bold"
        >
          <img
            src={courseCompassLogo}
            alt="Course Compass logo"
            width={28}
            height={28}
            className="size-7 shrink-0"
          />
          <span className="truncate">Course Compass</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeOptions={{ exact: link.to === "/" }}
              activeProps={{ className: "bg-secondary text-foreground" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <Link
            to="/auth"
            search={{ role: "teacher" as const }}
            className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            Sign In
          </Link>
          <Link
            to="/contact"
            search={{ plan: "teacher-pro" as const }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
          >
            Get Started
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-border p-2 transition-colors hover:bg-secondary active:scale-95 md:hidden"
        >
          {open ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {open ? (
        <nav aria-label="Mobile" className="border-t border-border px-6 py-3 md:hidden">
          <ul className="grid gap-1">
            {[...links, { to: "/auth", label: "Sign In" } as const].map((link) => (
              <li key={link.label}>
                <Link
                  to={link.to}
                  {...(link.to === "/auth" ? { search: { role: "teacher" as const } } : {})}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/contact"
                search={{ plan: "teacher-pro" as const }}
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-md bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground active:scale-[0.97]"
              >
                Get Started
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
