// Client analytics — POSTs events to our API (stored in Supabase).

const ALLOWED = new Set([
  "pageview",
  "signup",
  "doc_created",
  "doc_deleted",
  "doc_published",
  "api_token_created",
  "feedback_sent",
]);

function send(
  event: string,
  props?: Record<string, unknown>,
  pathname?: string,
) {
  if (typeof window === "undefined") return;
  if (!ALLOWED.has(event)) return;
  void fetch("/api/analytics/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event, properties: props ?? {}, pathname }),
    keepalive: true,
  }).catch(() => {
    // analytics must never throw
  });
}

export const analytics = {
  init() {
    // no-op — kept for AnalyticsTracker compatibility
  },

  pageview(pathname: string, _url: string) {
    send("pageview", {}, pathname);
  },

  signup(props?: { method?: string }) {
    send("signup", props);
  },

  docCreated(props: { docId: string; via?: "ui" | "api" }) {
    send("doc_created", props);
  },

  docDeleted(props: { docId: string }) {
    send("doc_deleted", props);
  },

  docPublished(props: { docId: string; isPublic: boolean }) {
    send("doc_published", props);
  },

  apiTokenCreated() {
    send("api_token_created");
  },

  feedbackSent(props?: { hasImage?: boolean }) {
    send("feedback_sent", props);
  },
};
