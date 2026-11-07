BEGIN;

CREATE TABLE sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'suspended')),
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name TEXT NOT NULL,
  license_ciphertext BYTEA NOT NULL,
  license_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (license_status IN ('pending', 'verified', 'rejected', 'suspended')),
  specialties TEXT[] NOT NULL DEFAULT '{}',
  languages TEXT[] NOT NULL DEFAULT '{English}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  skin_types TEXT[] NOT NULL DEFAULT '{}',
  concerns TEXT[] NOT NULL DEFAULT '{}',
  ingredients TEXT[] NOT NULL DEFAULT '{}',
  how_to_use TEXT NOT NULL DEFAULT '',
  warnings TEXT[] NOT NULL DEFAULT '{}',
  expiry_information TEXT NOT NULL DEFAULT 'Expiry details not provided.',
  supplier_verification TEXT NOT NULL DEFAULT 'pending'
    CHECK (supplier_verification IN ('pending', 'verified', 'rejected')),
  sample_listing BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT false,
  stock_count INTEGER NOT NULL DEFAULT 0 CHECK (stock_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX products_catalog_idx ON products (published, category, name);
CREATE INDEX products_skin_types_idx ON products USING GIN (skin_types);
CREATE INDEX products_concerns_idx ON products USING GIN (concerns);

CREATE TABLE consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID REFERENCES doctors(id),
  contact_ciphertext BYTEA NOT NULL,
  city TEXT NOT NULL,
  preferred_mode TEXT NOT NULL CHECK (preferred_mode IN ('text', 'voice', 'video')),
  status TEXT NOT NULL DEFAULT 'pilot_waitlist'
    CHECK (status IN ('pilot_waitlist', 'requested', 'scheduled', 'completed', 'cancelled')),
  privacy_consent_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_ciphertext BYTEA NOT NULL,
  delivery_ciphertext BYTEA NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'ETB',
  subtotal_cents INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  delivery_fee_cents INTEGER NOT NULL CHECK (delivery_fee_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents = subtotal_cents + delivery_fee_cents),
  status TEXT NOT NULL DEFAULT 'payment_pending'
    CHECK (status IN ('payment_pending', 'paid', 'preparing', 'dispatched', 'delivered', 'payment_failed', 'cancelled')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 20),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0)
);

CREATE TABLE payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  provider TEXT NOT NULL CHECK (provider IN ('chapa')),
  merchant_reference VARCHAR(20) NOT NULL UNIQUE,
  chapa_reference TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 100),
  currency CHAR(3) NOT NULL DEFAULT 'ETB',
  status TEXT NOT NULL DEFAULT 'initializing'
    CHECK (status IN ('initializing', 'pending', 'success', 'failed', 'initialization_failed')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payment_attempts_order_idx ON payment_attempts (order_id, created_at DESC);

CREATE TABLE webhook_receipts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL,
  payload_sha256 CHAR(64) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, payload_sha256)
);

INSERT INTO sellers (display_name, verification_status, is_demo)
VALUES ('Beauty Face sample catalog', 'pending', true);

INSERT INTO products (
  seller_id, slug, name, brand, category, description, price_cents,
  skin_types, concerns, ingredients, how_to_use, warnings,
  supplier_verification, sample_listing, published, stock_count
)
SELECT seller.id, seed.slug, seed.name, seed.brand, seed.category, seed.description, seed.price_cents,
       seed.skin_types, seed.concerns, seed.ingredients, seed.how_to_use, seed.warnings,
       'pending', true, true, 20
FROM sellers seller
CROSS JOIN (VALUES
  ('daily-gentle-cleanser', 'Daily Gentle Cleanser', 'Demo Botanics', 'Skincare',
   'A sample listing to demonstrate how product details and label information will appear.', 145000,
   ARRAY['normal','dry','sensitive'], ARRAY['dryness'], ARRAY['Water','Glycerin','Cleansing agents'],
   'Follow the directions printed on the verified product label.', ARRAY['Sample catalog listing. Check the real package label and suitability before use.']),
  ('calm-barrier-moisturizer', 'Calm Barrier Moisturizer', 'Demo Botanics', 'Skincare',
   'A sample moisturizer listing with ingredient, use, and warning fields for review.', 225000,
   ARRAY['dry','sensitive','combination'], ARRAY['dryness'], ARRAY['Water','Glycerin','Emollients'],
   'Follow the directions printed on the verified product label.', ARRAY['Sample catalog listing. Patch testing and professional advice may be appropriate.']),
  ('daily-sun-fluid', 'Daily Sun Fluid SPF 30', 'Demo Shade', 'Sun care',
   'A sample sun-care listing. SPF and broad-spectrum claims must be verified from the product label and source documents.', 310000,
   ARRAY['normal','dry','oily','combination'], ARRAY['sun protection'], ARRAY['See package label'],
   'Apply according to the verified package label and reapply as directed there.', ARRAY['Sample catalog listing. The SPF claim has not been verified.']),
  ('nourishing-scalp-oil', 'Nourishing Scalp Oil', 'Demo Roots', 'Hair care',
   'A sample hair-care listing used to demonstrate searchable catalog metadata.', 185000,
   ARRAY['all'], ARRAY['dryness'], ARRAY['See package label'],
   'Follow the directions printed on the verified product label.', ARRAY['Sample catalog listing. Avoid use if the package is damaged or the ingredients are unclear.']),
  ('comfort-body-lotion', 'Comfort Body Lotion', 'Demo Botanics', 'Body care',
   'A sample body-care listing. This placeholder is not a recommendation for a medical condition.', 199000,
   ARRAY['normal','dry'], ARRAY['dryness'], ARRAY['Water','Glycerin','Emollients'],
   'Follow the directions printed on the verified product label.', ARRAY['Sample catalog listing. Stop use if irritation occurs and seek professional advice if needed.'])
) AS seed(slug, name, brand, category, description, price_cents, skin_types, concerns, ingredients, how_to_use, warnings)
WHERE seller.is_demo = true AND seller.display_name = 'Beauty Face sample catalog';

COMMIT;
