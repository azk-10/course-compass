import * as startCore from "@tanstack/react-start";
import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests. Older @tanstack/react-start builds (which some
// deploy hosts resolve to) do not export it, so resolve it defensively.
const createCsrf = (
  startCore as {
    createCsrfMiddleware?: (opts: {
      filter?: (ctx: { handlerType: string }) => boolean;
    }) => ReturnType<typeof createMiddleware>;
  }
).createCsrfMiddleware;

const csrfMiddleware = createCsrf
  ? createCsrf({ filter: (ctx) => ctx.handlerType === "serverFn" })
  : undefined;

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: csrfMiddleware ? [errorMiddleware, csrfMiddleware] : [errorMiddleware],
}));
