import { useEffect, useState } from 'react';
import { getOrders } from '../services/orders.js';
import { useAdmin } from './AdminProvider.jsx';
import { formatPrice } from '../utils/products.js';

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const { expire } = useAdmin();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getOrders(controller.signal)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('El servidor no devolvió una lista de pedidos.');
        setOrders(data);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        if (failure.status === 401) expire();
        setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [reload]);

  return (
    <section className="admin-orders" aria-labelledby="orders-heading">
      <h2 id="orders-heading">Pedidos para retirar</h2>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => setReload((value) => value + 1)}
        disabled={loading}
      >
        Actualizar pedidos
      </button>
      {loading ? (
        <p>Cargando pedidos…</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : !orders.length ? (
        <p>Todavía no hay pedidos.</p>
      ) : (
        <ul className="order-items">
          {orders.map((order) => (
            <li key={order.id}>
              <div>
                <strong>
                  {order.customerName} · {order.phone}
                </strong>
                <p>
                  Pedido {order.id} · {new Date(order.createdAt).toLocaleString('es-AR')} ·{' '}
                  {formatPrice(order.total)}
                </p>
                <ul>
                  {order.items.map((item) => (
                    <li key={item.productId}>
                      {item.quantity} × {item.name} · {formatPrice(item.unitPrice)} c/u
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
