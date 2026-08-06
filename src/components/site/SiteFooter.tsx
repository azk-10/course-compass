import { Link } from "@tanstack/react-router";
import { Github, Linkedin, Twitter } from "lucide-react";

import courseCompassLogo from "@/assets/course-compass-logo.png";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/30">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="font-paper-display flex items-center gap-2 text-base font-bold">
            <img
              src={courseCompassLogo}
              alt=""
              width={24}
              height={24}
              className="size-6"
              aria-hidden="true"
            />
            Course Compass
          </span>
          <p className="mt-3 max-w-xs text-sm/6 text-muted-foreground">
            A Zoom chat companion for live classes of 100–1000+ students.
          </p>
        </div>

        <nav aria-label="Product">
          <h2 className="text-xs font-semibold tracking-[0.16em] uppercase">Product</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/features" className="transition-colors hover:text-foreground">
                Features
              </Link>
            </li>
            <li>
              <Link to="/demo" className="transition-colors hover:text-foreground">
                Interactive demo
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="transition-colors hover:text-foreground">
                Pricing
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="text-xs font-semibold tracking-[0.16em] uppercase">Company</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link to="/about" className="transition-colors hover:text-foreground">
                About
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="transition-colors hover:text-foreground">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="transition-colors hover:text-foreground">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link to="/contact" search={{ plan: "teacher-pro" as const }} className="transition-colors hover:text-foreground">
                Contact
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="text-xs font-semibold tracking-[0.16em] uppercase">Follow</h2>
          <div className="mt-3 flex gap-2">
            {[
              { icon: Twitter, label: "Course Compass on X" },
              { icon: Linkedin, label: "Course Compass on LinkedIn" },
              { icon: Github, label: "Course Compass on GitHub" },
            ].map(({ icon: Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="rounded-md border border-border p-2 transition-colors hover:bg-secondary active:scale-95"
              >
                <Icon className="size-4" aria-hidden="true" />
              </a>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Sales enquiries go through our{" "}
            <Link
              to="/contact" search={{ plan: "teacher-pro" as const }}
              className="font-semibold text-foreground underline-offset-4 hover:underline"
            >
              contact form
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="border-t border-border px-6 py-5">
        <p className="mx-auto max-w-7xl text-xs text-muted-foreground">
          © {new Date().getFullYear()} Course Compass. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
