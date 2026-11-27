-- Photos produits en 4K (3584 × 4800), plus nettes : la boutique et l'essayage
-- en direct (photo de référence envoyée à iKawn) en profitent.
-- Nouveau nom de fichier (-v3) : les téléphones n'affichent pas l'ancienne
-- version restée en cache. Seule la collection d'origine est concernée.
UPDATE products
SET image_url = regexp_replace(image_url, '-v2\.jpg$', '-v3.jpg')
WHERE image_url IN (
  '/images/classique-noir-v2.jpg', '/images/classique-creme-v2.jpg', '/images/classique-moka-v2.jpg',
  '/images/essentiel-noir-v2.jpg', '/images/essentiel-creme-v2.jpg', '/images/essentiel-moka-v2.jpg',
  '/images/signature-noir-v2.jpg', '/images/signature-creme-v2.jpg', '/images/signature-moka-v2.jpg'
);
