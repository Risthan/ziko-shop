-- Nouvelle collection : les mêmes trois modèles (Le Classique = sweat col rond,
-- L'Essentiel = hoodie, Le Signature = pull demi-zip), photographiés sur fond
-- clair (1440 × 1920), et deux couleurs en plus par modèle : Bleu roi et Rouge.
-- La boutique passe de 9 à 15 pulls.

-- 1. Nouvelles photos pour les 9 pulls existants. Les produits gardent leur
--    identifiant : paniers, commandes et historiques restent intacts.
--    Nouveau nom de fichier (-v4) : les téléphones n'affichent pas l'ancienne
--    photo restée en cache.
UPDATE products
SET image_url = regexp_replace(image_url, '-v3\.jpg$', '-v4.jpg')
WHERE image_url IN (
  '/images/classique-noir-v3.jpg', '/images/classique-creme-v3.jpg', '/images/classique-moka-v3.jpg',
  '/images/essentiel-noir-v3.jpg', '/images/essentiel-creme-v3.jpg', '/images/essentiel-moka-v3.jpg',
  '/images/signature-noir-v3.jpg', '/images/signature-creme-v3.jpg', '/images/signature-moka-v3.jpg'
);

-- 2. Les 6 nouvelles couleurs, ajoutées seulement à une boutique déjà remplie
--    (une base neuve reçoit les 15 pulls par le seed au démarrage), et jamais
--    en double. created_at décalé d'une milliseconde : ordre d'affichage stable.
INSERT INTO products (name, price_cdf, stock, image_url, created_at)
SELECT v.name, v.price_cdf, v.stock, v.image_url, now() + v.ord * interval '1 millisecond'
FROM (VALUES
  (1, 'Le Classique — Bleu roi', 75000, 8, '/images/classique-bleu-v4.jpg'),
  (2, 'Le Classique — Rouge', 75000, 11, '/images/classique-rouge-v4.jpg'),
  (3, 'L''Essentiel — Bleu roi', 95000, 6, '/images/essentiel-bleu-v4.jpg'),
  (4, 'L''Essentiel — Rouge', 95000, 5, '/images/essentiel-rouge-v4.jpg'),
  (5, 'Le Signature — Bleu roi', 125000, 4, '/images/signature-bleu-v4.jpg'),
  (6, 'Le Signature — Rouge', 125000, 3, '/images/signature-rouge-v4.jpg')
) AS v (ord, name, price_cdf, stock, image_url)
WHERE EXISTS (SELECT 1 FROM products)
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = v.name);
