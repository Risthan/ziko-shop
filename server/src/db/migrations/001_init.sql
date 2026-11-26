-- Schéma initial de ZIKO SHOP.
-- Les règles métier importantes sont AUSSI garanties par la base (CHECK,
-- UNIQUE, clés étrangères) : même un bug applicatif ne peut pas les casser.

CREATE TABLE products (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  -- Prix en francs congolais : un nombre entier, jamais de décimales.
  price_cdf   integer     NOT NULL CHECK (price_cdf > 0),
  -- Le stock ne peut jamais devenir négatif, quoi qu'il arrive.
  stock       integer     NOT NULL CHECK (stock >= 0),
  image_url   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_name_idx ON products (lower(name));

CREATE TYPE order_status AS ENUM ('en_attente', 'payee');

CREATE TABLE orders (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       uuid         NOT NULL REFERENCES products (id),
  quantity         integer      NOT NULL CHECK (quantity > 0),
  -- Prix figé au moment de la commande : un changement de prix ultérieur
  -- ne modifie pas ce que le client a accepté de payer.
  unit_price_cdf   integer      NOT NULL CHECK (unit_price_cdf > 0),
  total_cdf        integer      NOT NULL CHECK (total_cdf > 0),
  status           order_status NOT NULL DEFAULT 'en_attente',
  -- Clé facultative envoyée par l'app pour ne pas créer deux fois la même
  -- commande si le réseau coupe pendant sa création.
  idempotency_key  text         UNIQUE,
  created_at       timestamptz  NOT NULL DEFAULT now(),
  paid_at          timestamptz,
  CHECK (total_cdf = unit_price_cdf * quantity),
  CHECK ((status = 'payee') = (paid_at IS NOT NULL))
);

-- Un paiement = un identifiant fourni par l'opérateur Mobile Money.
-- La clé primaire sur cet identifiant interdit de l'enregistrer deux fois,
-- et l'unicité sur order_id interdit de payer deux fois la même commande.
CREATE TABLE payments (
  id          text        PRIMARY KEY CHECK (char_length(id) BETWEEN 8 AND 64),
  order_id    uuid        NOT NULL UNIQUE REFERENCES orders (id),
  amount_cdf  integer     NOT NULL CHECK (amount_cdf > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);
