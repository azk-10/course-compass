import { useEffect, useState } from "react";
import { Building2, Check, Loader2, Search, UserRound } from "lucide-react";

import { searchOrganizations, type Organization } from "@/lib/org";

/**
 * Search-and-join control for schools, colleges and academies. A teacher either
 * picks the organization whose owner will approve them, or continues as an
 * independent teacher with no approval step.
 */
export function OrganizationPicker({
  value,
  onSelect,
  independent,
  onIndependent,
  allowIndependent = true,
}: {
  value: Organization | null;
  onSelect: (org: Organization | null) => void;
  independent: boolean;
  onIndependent: (independent: boolean) => void;
  allowIndependent?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (value) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      searchOrganizations(query)
        .then((rows) => {
          if (cancelled) return;
          setResults(rows);
          setFailed(false);
        })
        .catch(() => !cancelled && setFailed(true))
        .finally(() => !cancelled && setLoading(false));
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, value]);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm">
        <Building2 className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate font-medium">{value.name}</span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="shrink-0 text-xs font-medium underline underline-offset-4"
        >
          Change
        </button>
      </div>
    );
  }

  if (independent) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-input bg-secondary px-3 py-2.5 text-sm">
        <UserRound className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate font-medium">Independent teacher</span>
        <button
          type="button"
          onClick={() => onIndependent(false)}
          className="shrink-0 text-xs font-medium underline underline-offset-4"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search schools, colleges, academies"
          aria-label="Search organizations"
          className="w-full bg-transparent text-sm outline-none"
        />
        {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto">
        {failed && (
          <li className="px-1 py-2 text-xs text-destructive">
            Could not load organizations. Check your connection and try again.
          </li>
        )}
        {!failed && !loading && results.length === 0 && (
          <li className="px-1 py-2 text-xs text-muted-foreground">
            {query.trim()
              ? `No organization matches “${query.trim()}”. Check the spelling, or ask your admin to register it.`
              : "No organizations registered yet."}
          </li>
        )}
        {results.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
            >
              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <Check className="size-3.5 shrink-0 opacity-0" />
            </button>
          </li>
        ))}
      </ul>

      {allowIndependent && (
        <button
          type="button"
          onClick={() => onIndependent(true)}
          className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-left text-sm transition-colors hover:bg-secondary"
        >
          <UserRound className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">
            Not part of one — continue as an independent teacher
          </span>
        </button>
      )}
    </div>
  );
}
