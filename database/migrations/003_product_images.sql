BEGIN;

-- Product images are stored in the database so they survive redeploys on
-- hosts with an ephemeral filesystem (for example, Render). The bytes are
-- served by the public GET /api/products/:slug/image endpoint.
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data BYTEA;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_mime TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_updated_at TIMESTAMPTZ;

COMMIT;
