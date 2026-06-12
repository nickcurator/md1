-- First-party product analytics for md1 (no PostHog). Written by the app on
-- user actions; read by /admin/analytics via service role.

CREATE TABLE analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES drive_users(id) ON DELETE SET NULL,
  user_email text,
  event text NOT NULL,
  pathname text,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX analytics_events_created_at_idx ON analytics_events(created_at DESC);
CREATE INDEX analytics_events_event_created_idx ON analytics_events(event, created_at DESC);
CREATE INDEX analytics_events_user_created_idx ON analytics_events(user_id, created_at DESC);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
