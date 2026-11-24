import { BadRequestError } from "../exceptions/AppError.js";

export default class Order {
  static validate(data) {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new BadRequestError("Los datos del pedido son inválidos.");
    }
    const { customerName, phone, items, requestId } = data;
    if (typeof customerName !== "string" || customerName.trim().length < 2 || customerName.trim().length > 100) {
      throw new BadRequestError("Ingresá un nombre de entre 2 y 100 caracteres.");
    }
    if (typeof phone !== "string" || !/^[+\d\s()-]{6,30}$/.test(phone.trim()) || (phone.match(/\d/g) || []).length < 6) {
      throw new BadRequestError("Ingresá un teléfono válido.");
    }
    if (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      throw new BadRequestError("El identificador del pedido es inválido.");
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
      throw new BadRequestError("Agregá entre 1 y 100 productos al pedido.");
    }
    const ids = new Set();
    for (const item of items) {
      if (!item || !Number.isSafeInteger(item.productId) || item.productId < 1 ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000 ||
          !Number.isFinite(item.expectedUnitPrice) || item.expectedUnitPrice <= 0 ||
          ids.has(item.productId)) {
        throw new BadRequestError("Los productos o cantidades del pedido son inválidos.");
      }
      ids.add(item.productId);
    }
    return {
      customerName: customerName.trim(),
      phone: phone.trim(),
      requestId,
      items: items.map(({ productId, quantity, expectedUnitPrice }) => ({ productId, quantity, expectedUnitPrice })).sort((a, b) => a.productId - b.productId),
    };
  }
}
