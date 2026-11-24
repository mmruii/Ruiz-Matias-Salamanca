import { randomUUID } from "node:crypto";
import Order from "../models/Order.js";
import orderRepository from "../repositories/OrderRepository.js";
import productRepository from "../repositories/ProductRepository.js";
import { BadRequestError, ConflictError, NotFoundError } from "../exceptions/AppError.js";
import { toCents } from "../utils/money.js";

class OrderService {
  getAll() {
    return orderRepository.getAll().map(({ request, ...order }) => order).reverse();
  }

  create(data) {
    const request = Order.validate(data);
    const previous = orderRepository.getAll().find((order) => order.request.requestId === request.requestId);
    if (previous) {
      if (JSON.stringify(previous.request) !== JSON.stringify(request)) {
        throw new ConflictError("Este identificador ya corresponde a otro pedido.");
      }
      const { request: ignored, ...receipt } = previous;
      return receipt;
    }

    const products = productRepository.getAll();
    let totalCents = 0;
    const items = request.items.map(({ productId, quantity, expectedUnitPrice }) => {
      const product = products.find((entry) => entry.id === productId);
      if (!product) throw new NotFoundError("Uno de los productos del pedido ya no existe.");
      if (!product.available || product.stock < quantity) {
        throw new ConflictError(`No hay stock suficiente o el producto no está disponible: ${product.name}.`);
      }
      const priceCents = toCents(product.price);
      if (priceCents < 1) {
        throw new ConflictError(`El precio de ${product.name} no es válido para realizar un pedido.`);
      }
      if (toCents(expectedUnitPrice) !== priceCents) {
        throw new ConflictError(`El precio de ${product.name} cambió. Revisá tu pedido antes de confirmarlo.`);
      }
      totalCents += priceCents * quantity;
      if (!Number.isSafeInteger(priceCents) || !Number.isSafeInteger(totalCents)) {
        throw new BadRequestError("El importe del pedido es demasiado grande.");
      }
      return { productId, name: product.name, quantity, unitPrice: priceCents / 100 };
    });
    const order = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      customerName: request.customerName,
      phone: request.phone,
      items,
      total: totalCents / 100,
      request,
    };
    const updated = products.map((product) => {
      const item = request.items.find((entry) => entry.productId === product.id);
      return item ? { ...product, stock: product.stock - item.quantity } : product;
    });
    orderRepository.save(order, updated);
    const { request: ignored, ...receipt } = order;
    return receipt;
  }
}

export default new OrderService();
