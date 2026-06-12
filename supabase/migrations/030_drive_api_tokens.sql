-- Personal API tokens for programmatic access (HTTP API, MCP server, scripts).
-- Only token_hash is stored; the plain token is shown once at creation.

CREATE TABLE drive_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES drive_users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'API token',
  token_hash text NOT NULL,
  token_prefix text NOT NULL,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX drive_api_tokens_hash_idx ON drive_api_tokens(token_hash);
CREATE INDEX drive_api_tokens_user_idx ON drive_api_tokens(user_id);

ALTER TABLE drive_api_tokens ENABLE ROW LEVEL SECURITY;
