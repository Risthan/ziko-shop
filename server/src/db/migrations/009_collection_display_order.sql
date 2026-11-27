-- Même ordre partout (API, administration, app) : modèle par modèle, et les
-- couleurs toujours dans le même ordre (Noir, Crème, Moka, Bleu roi, Rouge).
-- La boutique en ligne a reçu Bleu roi et Rouge après coup (migration 008), donc
-- en fin de liste, puisque les produits sont triés par date d'ajout. On recale
-- la date d'ajout des 15 pulls, à une seconde d'écart, dans l'ordre voulu, à
-- partir de la plus ancienne. Seul l'ordre change ; un produit ajouté plus tard
-- depuis l'administration reste après. Sans effet sur une base vide.
WITH wanted (name, rank) AS (
  VALUES
    ('Le Classique — Noir', 1), ('Le Classique — Crème', 2), ('Le Classique — Moka', 3),
    ('Le Classique — Bleu roi', 4), ('Le Classique — Rouge', 5),
    ('L''Essentiel — Noir', 6), ('L''Essentiel — Crème', 7), ('L''Essentiel — Moka', 8),
    ('L''Essentiel — Bleu roi', 9), ('L''Essentiel — Rouge', 10),
    ('Le Signature — Noir', 11), ('Le Signature — Crème', 12), ('Le Signature — Moka', 13),
    ('Le Signature — Bleu roi', 14), ('Le Signature — Rouge', 15)
),
base AS (
  SELECT min(p.created_at) AS at FROM products p JOIN wanted w ON w.name = p.name
)
UPDATE products p
SET created_at = base.at + (w.rank - 1) * interval '1 second'
FROM wanted w, base
WHERE p.name = w.name AND base.at IS NOT NULL;
