import { NextResponse } from "next/server";

// /api/feedback — forwards user feedback into a Telegram chat so we
// see it in real time and can act on it without checking a separate
// inbox. Designed for the first ~hundred users; once volume requires
// triage we'd move to Linear / a real ticketing tool.
//
// We deliberately don't persist feedback in our own DB right now:
// Telegram is the source of truth, and not storing free-text user
// input avoids RLS / PII headaches. If the channel ever overflows
// we'll add a `feedback` table then.
//
// Auth is intentionally trust-the-client: the page sends along the
// signed-in user's email + id from the React context so we have
// something to reply to. There's no permission stake (the route
// doesn't read or write user data), so the worst case of a forged
// payload is one piece of mislabelled feedback — easy to spot, low
// blast radius. This keeps the route framework-agnostic and avoids
// pulling Supabase SSR into a one-off endpoint.

type FeedbackSource = "product" | "drive" | "md1";

type ReqBody = {
  // The actual feedback text.
  message: string;
  // Which surface submitted the feedback — drives the Telegram header.
  source?: FeedbackSource;
  // Contact email — from auth if signed in, or typed by the user.
  email?: string;
  // Auth user id, attached when the submitter is signed in. Used
  // so we can cross-reference the report with their account.
  userId?: string;
  // Where the user was when they submitted; helps us reproduce.
  path?: string;
  // User's active reading language at submission time. Often the
  // single most useful filter when triaging ("all the Polish bugs").
  language?: string;
  // Optional screenshot, as a `data:image/...;base64,…` URL. The
  // client downscales/re-encodes before sending, so this stays small.
  image?: string;
};

// Bound below by a sanity char limit — long-form feedback is welcome
// but a runaway request shouldn't be able to push megabytes through
// our function and into Telegram.
const MAX_MESSAGE_CHARS = 4000;

// Hard cap on the decoded attachment size. The client already shrinks
// images, so anything past this is almost certainly abuse or a bug;
// also keeps us well under Telegram's photo limit and Vercel's request
// body cap.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_FEEDBACK_CHAT_ID;
  if (!token || !chatId) {
    // Soft 503 — the front-end shows "Couldn't send" and we get a
    // server log to investigate, instead of a noisy 500.
    return NextResponse.json(
      { error: "Feedback channel not configured" },
      { status: 503 },
    );
  }

  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `message too long (max ${MAX_MESSAGE_CHARS} chars)` },
      { status: 400 },
    );
  }

  // Parse + validate the optional attachment up front, so a bad image
  // is rejected before we deliver the text half of the report.
  let photo: { bytes: ArrayBuffer; mime: string } | null = null;
  if (body.image) {
    const parsed = parseDataUrl(body.image);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid image attachment" },
        { status: 400 },
      );
    }
    if (parsed.bytes.byteLength > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: "Image too large" },
        { status: 413 },
      );
    }
    photo = parsed;
  }

  const submittedEmail = (body.email ?? "").trim();
  const contact = submittedEmail || "anonymous";
  const source: FeedbackSource =
    body.source === "md1"
      ? "md1"
      : body.source === "drive"
        ? "drive"
        : "product";
  const sourceLabel =
    source === "md1"
      ? "📝 md1 feedback"
      : source === "drive"
        ? "📝 Newt Drive feedback"
        : "📝 Newt feedback";

  // Composed Telegram message. HTML mode so we can use simple
  // formatting; we escape user-controlled fields to prevent the
  // textarea content from breaking the tag tree.
  const userIdLine = body.userId
    ? ` (<code>${escapeHtml(body.userId)}</code>)`
    : "";
  const lines = [
    `<b>${sourceLabel}</b>`,
    ``,
    escapeHtml(message),
    ``,
    `<i>— context —</i>`,
    `From: ${escapeHtml(contact)}${userIdLine}`,
    source === "md1"
      ? `Surface: <code>md1</code>`
      : source === "drive"
        ? `Surface: <code>drive</code>`
        : null,
    body.path ? `Page: <code>${escapeHtml(body.path)}</code>` : null,
    body.language ? `Lang: <code>${escapeHtml(body.language)}</code>` : null,
  ].filter(Boolean);

  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    },
  );

  if (!tgRes.ok) {
    const errText = await tgRes.text();
    // Log on the server so we notice if the bot token expired or the
    // chat_id became invalid (most common failure modes).
    console.error("[feedback] Telegram send failed:", tgRes.status, errText);
    return NextResponse.json(
      { error: "Couldn't deliver feedback" },
      { status: 502 },
    );
  }

  // Attachment goes as a separate sendPhoto so the full text above is
  // never truncated to Telegram's 1024-char caption limit. The text is
  // already delivered, so a photo failure is logged but doesn't fail
  // the request — the report itself made it through.
  if (photo) {
    try {
      const form = new FormData();
      form.append("chat_id", chatId);
      const attachmentLabel =
        source === "md1"
          ? `📎 md1 attachment — ${contact}`
          : source === "drive"
            ? `📎 Drive attachment — ${contact}`
            : `📎 Attachment — ${contact}`;
      form.append("caption", attachmentLabel);
      form.append(
        "photo",
        new Blob([photo.bytes], { type: photo.mime }),
        "feedback.jpg",
      );
      const photoRes = await fetch(
        `https://api.telegram.org/bot${token}/sendPhoto`,
        { method: "POST", body: form },
      );
      if (!photoRes.ok) {
        console.error(
          "[feedback] Telegram photo send failed:",
          photoRes.status,
          await photoRes.text(),
        );
      }
    } catch (err) {
      console.error("[feedback] Telegram photo send threw:", err);
    }
  }

  return NextResponse.json({ ok: true });
}

// Parse a `data:image/<type>;base64,<payload>` URL into raw bytes plus
// its MIME type. Returns null for anything that isn't a base64 image
// data URL (the only shape the client sends).
function parseDataUrl(
  input: string,
): { bytes: ArrayBuffer; mime: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(input.trim());
  if (!m) return null;
  try {
    const buf = Buffer.from(m[2], "base64");
    // Copy into a standalone ArrayBuffer so it's a valid BlobPart
    // (Node's Buffer can be SharedArrayBuffer-backed, which Blob rejects).
    const bytes = new ArrayBuffer(buf.byteLength);
    new Uint8Array(bytes).set(buf);
    return { mime: m[1], bytes };
  } catch {
    return null;
  }
}

// Minimal HTML escape — Telegram's HTML parse mode allows a small
// set of tags but rejects unescaped `<`, `>`, `&` in regular text.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
