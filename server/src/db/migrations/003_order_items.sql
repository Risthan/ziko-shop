-- Panier : une commande peut contenir plusieurs articles.
-- Chaque ligne fige le prix au moment de la commande, comme avant.

CREATE TABLE order_items (
  order_id        uuid     NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id      uuid     NOT NULL REFERENCES products (id),
  -- Ordre d'affichage des articles, tel que le client les a ajoutés.
  position        smallint NOT NULL CHECK (position >= 0),
  quantity        integer  NOT NULL CHECK (quantity > 0),
  unit_price_cdf  integer  NOT NULL CHECK (unit_price_cdf > 0),
  line_total_cdf  integer  NOT NULL CHECK (line_total_cdf > 0),
  -- Un produit n'apparaît qu'une fois par commande (les quantités sont regroupées).
  PRIMARY KEY (order_id, product_id),
  UNIQUE (order_id, position),
  CHECK (line_total_cdf = unit_price_cdf * quantity)
);

CREATE INDEX order_items_product_idx ON order_items (product_id);

-- Les commandes existantes (un seul article) deviennent une commande à une ligne.
INSERT INTO order_items (order_id, product_id, position, quantity, unit_price_cdf, line_total_cdf)
SELECT id, product_id, 0, quantity, unit_price_cdf, total_cdf FROM orders;

-- Ces colonnes vivent désormais dans order_items. Les supprimer retire aussi
-- leurs contraintes (dont « total = prix × quantité », remplacée par la somme des lignes).
ALTER TABLE orders
  DROP COLUMN product_id,
  DROP COLUMN quantity,
  DROP COLUMN unit_price_cdf;
