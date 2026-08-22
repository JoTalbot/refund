-- Order lines and optional policy source. Rollback: db/ROLLBACK.md

CREATE TABLE order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  sku text,
  title text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  amount numeric(18, 4) NOT NULL,
  currency char(3) NOT NULL
);

CREATE INDEX order_lines_order ON order_lines (order_id);

ALTER TABLE policy_snapshots
  ALTER COLUMN source_id DROP NOT NULL;
