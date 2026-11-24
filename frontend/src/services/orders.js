import { request } from './api.js';

export function createOrder(data) {
  return request('/orders', { method: 'POST', body: JSON.stringify(data) });
}

export function getOrders(signal) {
  return request('/orders', { signal });
}
