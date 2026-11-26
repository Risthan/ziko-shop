import { Router } from "express";
import type { Db } from "../db/pool.js";
import { errors } from "../http/errors.js";
import { requireAdminKey } from "../http/middleware.js";
import { parse, uuidSchema } from "../http/validation.js";
import { createProductSchema, listProductsQuerySchema } from "./products.schemas.js";
import { createProduct, getProduct, listProducts } from "./products.service.js";

export function productsRouter(db: Db, adminKey: string): Router {
  const router = Router();

  // 1. Créer un produit (réservé à l'administration).
  router.post("/", requireAdminKey(adminKey), async (req, res) => {
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

  router.get("/:id", async (req, res) => {
    const id = uuidSchema.safeParse(req.params.id);
    if (!id.success) throw errors.productNotFound();
    res.json({ product: await getProduct(db, id.data) });
  });

  return router;
}
