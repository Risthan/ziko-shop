import { Router } from "express";
import type { Db } from "../db/pool.js";
import { errors } from "../http/errors.js";
import { adminLimiter, requireAdminKey } from "../http/middleware.js";
import { parse, uuidSchema } from "../http/validation.js";
import { createProductSchema, listProductsQuerySchema, updateProductSchema } from "./products.schemas.js";
import { createProduct, getProduct, listProducts, updateProduct } from "./products.service.js";

export function productsRouter(db: Db, adminKey: string): Router {
  const router = Router();
  const admin = [adminLimiter(), requireAdminKey(adminKey)];

  // 1. Créer un produit (réservé à l'administration).
  router.post("/", ...admin, async (req, res) => {
    const input = parse(createProductSchema, req.body);
    const product = await createProduct(db, input);
    res.status(201).json({ product });
  });

  // 2. Lister les produits, avec une recherche facultative par nom (?search=).
  router.get("/", async (req, res) => {
    const { search } = parse(listProductsQuerySchema, req.query);
    const products = await listProducts(db, search || undefined);
    res.json({ products });
  });

  // Modifier un produit : prix, stock, nom ou image (réservé à l'administration).
  router.patch("/:id", ...admin, async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    if (!id.success) throw errors.productNotFound();
    res.json({ product: await updateProduct(db, id.data, parse(updateProductSchema, req.body)) });
  });

  router.get("/:id", async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    if (!id.success) throw errors.productNotFound();
    res.json({ product: await getProduct(db, id.data) });
  });

  return router;
}
