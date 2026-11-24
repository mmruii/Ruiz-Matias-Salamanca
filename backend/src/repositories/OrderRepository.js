import productRepository from "./ProductRepository.js";

class OrderRepository {
  getAll() {
    return productRepository.getOrders();
  }

  save(order, products) {
    return productRepository.saveOrder(order, products);
  }
}

export default new OrderRepository();
