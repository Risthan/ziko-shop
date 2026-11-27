-- Remise du stock à son état de départ, avant la démonstration finale.
-- Les ventes de test (commandes et paiements) restent enregistrées : ce
-- sont des données financières, on ne les efface pas. Seul le stock
-- disponible repart des quantités de la collection d'origine
-- (les mêmes que dans src/db/seed.ts).
-- Sur une base neuve (tests, premier déploiement), la boutique est encore
-- vide à ce stade : cette mise à jour ne touche alors aucune ligne.
UPDATE products AS p
SET stock = initial.stock
FROM (
  VALUES
    ('Le Classique — Noir', 12),
    ('Le Classique — Crème', 9),
    ('Le Classique — Moka', 6),
    ('L''Essentiel — Noir', 10),
    ('L''Essentiel — Crème', 4),
    ('L''Essentiel — Moka', 7),
    ('Le Signature — Noir', 5),
    ('Le Signature — Crème', 3),
    ('Le Signature — Moka', 2)
) AS initial (name, stock)
WHERE p.name = initial.name;
