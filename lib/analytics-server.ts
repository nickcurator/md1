import { recordAnalyticsEvent } from "@/lib/analytics-events-server";

export async function captureServerEvent(
  event: string,
  userId: string,
  userEmail: string,
  properties?: Record<string, unknown>,
  pathname?: string,
): Promise<void> {
  await recordAnalyticsEvent({
    userId,
    userEmail,
    event,
    pathname,
    properties,
  });
}
