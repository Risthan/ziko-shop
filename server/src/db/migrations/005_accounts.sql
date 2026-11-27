-- Comptes clients : inscription, connexion, profil et historique d'achats.

CREATE TABLE users (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Toujours enregistrée en minuscules : une seule inscription par adresse.
  email          text        NOT NULL UNIQUE CHECK (email = lower(email) AND char_length(email) BETWEEN 5 AND 254),
  -- « scrypt$N$r$p$sel$empreinte » : le mot de passe n'est jamais stocké.
  password_hash  text        NOT NULL,
  full_name      text        NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 80),
  phone          text        CHECK (phone IS NULL OR char_length(phone) BETWEEN 8 AND 20),
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Une session = un téléphone connecté. Le jeton n'est gardé qu'en empreinte
-- (SHA-256) : une fuite de la base ne permet pas de se connecter.
CREATE TABLE sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash    text        NOT NULL UNIQUE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  last_used_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Une commande peut appartenir à un client. Si le client supprime son
-- compte, la commande (donnée comptable) reste, sans lien vers lui.
ALTER TABLE orders ADD COLUMN user_id uuid REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX orders_user_idx ON orders (user_id, created_at DESC);
