-- Nouvelles photos produits (nouveau logo « Ziko Shop », fond anthracite).
-- Les fichiers portent un nouveau nom (-v2) pour que les téléphones et
-- navigateurs n'affichent pas l'ancienne version restée en cache.
-- Seules les images de la collection d'origine sont concernées.
UPDATE products
SET image_url = regexp_replace(image_url, '\.jpg$', '-v2.jpg')
WHERE image_url IN (
  '/images/classique-noir.jpg', '/images/classique-creme.jpg', '/images/classique-moka.jpg',
  '/images/essentiel-noir.jpg', '/images/essentiel-creme.jpg', '/images/essentiel-moka.jpg',
  '/images/signature-noir.jpg', '/images/signature-creme.jpg', '/images/signature-moka.jpg'
);
