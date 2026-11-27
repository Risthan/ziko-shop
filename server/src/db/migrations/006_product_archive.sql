-- Retirer un produit de la vente sans casser l'historique.
-- Un produit déjà commandé ne peut pas être effacé (les lignes de commande
-- y font référence, c'est la comptabilité) : on le marque « retiré ».
-- Retiré = invisible dans la boutique et impossible à commander ; les
-- commandes passées l'affichent toujours.
ALTER TABLE products ADD COLUMN archived_at timestamptz;
