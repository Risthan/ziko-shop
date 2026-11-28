-- La taille choisie par le client pour chaque article (S à XXL).
-- Facultative : les commandes passées avant, et celles envoyées à l'API sans
-- taille (format de l'énoncé), gardent NULL.
-- Une couleur n'apparaît toujours qu'une fois par commande (clé primaire
-- inchangée), donc dans une seule taille : le paiement et le décompte du stock
-- ne changent pas. Le stock reste suivi par couleur, toutes tailles confondues.
ALTER TABLE order_items
  ADD COLUMN size text CHECK (size IN ('S', 'M', 'L', 'XL', 'XXL'));
