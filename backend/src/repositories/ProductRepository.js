import Product from "../models/Product.js";
import Order from "../models/Order.js";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const initialProducts = [
  Product.create(
    {
      name: "Medialuna de manteca",
      description: "Medialuna artesanal, hojaldrada y horneada cada mañana.",
      category: "Panadería",
      price: 1200,
      imageUrl: "",
      available: true,
    },
    1,
  ),
  Product.create(
    {
      name: "Croissant",
      description: "Croissant de masa madre con manteca de primera calidad.",
      category: "Panadería",
      price: 1800,
      imageUrl: "",
      available: true,
    },
    2,
  ),
  Product.create(
    {
      name: "Café espresso",
      description: "Café de especialidad, extraído en el momento.",
      category: "Cafetería",
      price: 2200,
      imageUrl: "",
      available: true,
    },
    3,
  ),
];

export class ProductRepository {
  constructor(
    filePath = process.env.PRODUCTS_FILE ||
      fileURLToPath(new URL("../../data/products.json", import.meta.url)),
  ) {
    this.filePath = filePath;
    let stored;
    try {
      stored = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      stored = { nextId: 4, products: initialProducts, orders: [] };
      this.persist(stored.products, stored.nextId);
    }
    if (
      !Array.isArray(stored.products) ||
      !Number.isSafeInteger(stored.nextId) ||
      stored.nextId < 1
    ) {
      throw new Error(
        "El archivo de productos tiene un formato invalido. No se sobrescribio.",
      );
    }
    this.products = stored.products.map((product) => {
      if (!Number.isSafeInteger(product.id) || product.id < 1)
        throw new Error("ID persistido invalido.");
      return Product.create(product, product.id);
    });
    const ids = new Set(this.products.map((product) => product.id));
    if (
      ids.size !== this.products.length ||
      this.products.some((product) => product.id >= stored.nextId)
    ) {
      throw new Error(
        "Los IDs del archivo de productos son invalidos. No se sobrescribio.",
      );
    }
    if (stored.orders !== undefined && !Array.isArray(stored.orders)) {
      throw new Error("El archivo de pedidos tiene un formato invalido. No se sobrescribio.");
    }
    this.orders = stored.orders || [];
    const orderIds = new Set();
    const requestIds = new Set();
    for (const order of this.orders) {
      if (!order || typeof order !== "object" || typeof order.id !== "string" ||
          !order.id || orderIds.has(order.id) ||
          typeof order.createdAt !== "string" || !Number.isFinite(Date.parse(order.createdAt)) ||
          typeof order.customerName !== "string" || typeof order.phone !== "string" ||
          !Array.isArray(order.items) || !order.items.length ||
          !Number.isFinite(order.total) || order.total <= 0 ||
          order.items.some((item) => !item || !Number.isSafeInteger(item.productId) ||
            typeof item.name !== "string" || !Number.isSafeInteger(item.quantity) ||
            item.quantity < 1 || !Number.isFinite(item.unitPrice) || item.unitPrice <= 0)) {
        throw new Error("El archivo de pedidos tiene un formato invalido. No se sobrescribio.");
      }
      const request = Order.validate(order.request);
      if (requestIds.has(request.requestId)) {
        throw new Error("El archivo de pedidos contiene identificadores duplicados. No se sobrescribio.");
      }
      orderIds.add(order.id);
      requestIds.add(request.requestId);
    }
    this.nextId = stored.nextId;
  }

  persist(products, nextId, orders = this.orders || []) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${randomUUID()}.tmp`;
    writeFileSync(
      temporaryPath,
      JSON.stringify({ nextId, products, orders }, null, 2),
      { mode: 0o600 },
    );
    renameSync(temporaryPath, this.filePath);
  }

  getAll() {
    return [...this.products];
  }

  getById(id) {
    return this.products.find((product) => product.id === id) ?? null;
  }

  getOrders() {
    return [...this.orders];
  }

  saveOrder(order, products) {
    const orders = [...this.orders, order];
    this.persist(products, this.nextId, orders);
    this.products = products;
    this.orders = orders;
    return order;
  }

  create(product) {
    const newProduct = Product.create(product, this.nextId);
    const updatedProducts = [...this.products, newProduct];
    this.persist(updatedProducts, this.nextId + 1);
    this.products = updatedProducts;
    this.nextId += 1;
    return newProduct;
  }

  update(id, updatedProduct) {
    const index = this.products.findIndex((product) => product.id === id);

    if (index === -1) {
      return null;
    }

    const updatedProducts = [...this.products];
    updatedProducts[index] = updatedProduct;
    this.persist(updatedProducts, this.nextId);
    this.products = updatedProducts;
    return updatedProduct;
  }

  delete(id) {
    const index = this.products.findIndex((product) => product.id === id);

    if (index === -1) {
      return null;
    }

    const deleted = this.products[index];
    const updatedProducts = this.products.filter(
      (product) => product.id !== id,
    );
    this.persist(updatedProducts, this.nextId);
    this.products = updatedProducts;
    return deleted;
  }
}

export default new ProductRepository();
