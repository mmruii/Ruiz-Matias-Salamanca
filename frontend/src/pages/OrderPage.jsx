import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeading from '../components/PageHeading.jsx';
import { useCart } from '../components/CartProvider.jsx';
import { useProducts } from '../components/ProductsProvider.jsx';
import { useNotifications } from '../components/Notifications.jsx';
import { createOrder } from '../services/orders.js';
import { formatPrice, priceInCents } from '../utils/products.js';

export default function OrderPage() {
  const {
    items,
    setQuantity,
    clear,
    restore,
    pending,
    setPending,
    error: pendingError,
  } = useCart();
  const { products, loading, error, retry } = useProducts();
  const { notify } = useNotifications();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const lines = items.map((item) => ({
    ...item,
    product: products.find((product) => product.id === item.productId),
  }));
  const total =
    lines.reduce((sum, item) => sum + priceInCents(item.product?.price || 0) * item.quantity, 0) /
    100;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const payload = pending || {
      requestId: crypto.randomUUID(),
      customerName: name,
      phone,
      items: lines.map(({ productId, quantity, product }) => ({
        productId,
        quantity,
        expectedUnitPrice: product?.price,
      })),
    };
    try {
      setPending(payload);
    } catch {
      notify(
        'No se pudo guardar el intento de pedido en esta pestaña. Habilitá el almacenamiento e intentá nuevamente.',
        'error',
      );
      return;
    }
    setBusy(true);
    try {
      const result = await createOrder(payload);
      setPending(null);
      clear();
      setReceipt(result);
      retry();
      notify('Pedido confirmado correctamente.');
    } catch (failure) {
      if (failure.status >= 400 && failure.status < 500) {
        try {
          setPending(null);
        } catch {
          notify(
            'No se pudo actualizar el almacenamiento del navegador. Reintentá la confirmación.',
            'error',
          );
          return;
        }
        restore(payload.items);
        setName(payload.customerName);
        setPhone(payload.phone);
        retry();
        notify(failure.message, 'error');
      } else {
        notify(
          `${failure.message} Reintentá el mismo pedido para verificar si se confirmó.`,
          'error',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section container order-page">
      <PageHeading
        eyebrow="Para retirar"
        title="Mi pedido"
        description="Elegí tus productos y confirmá tu pedido para retirarlo en el local."
      />
      {pendingError && <p role="alert">{pendingError}</p>}
      {receipt && (
        <div className="order-receipt" role="status">
          <h2>Pedido confirmado</h2>
          <p>
            Comprobante: <strong>{receipt.id}</strong>
          </p>
          <p>
            Para {receipt.customerName} · Total: {formatPrice(receipt.total)}
          </p>
          <p>Retirá tu pedido en el local. El pago se realiza allí.</p>
          <ul>
            {receipt.items.map((item) => (
              <li key={item.productId}>
                {item.quantity} × {item.name}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pendingError ? null : pending ? (
        <form onSubmit={submit} className="order-form">
          <p>
            La confirmación anterior quedó pendiente. Reintentá para recuperar el comprobante sin
            duplicar el pedido.
          </p>
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? 'Consultando…' : 'Reintentar confirmación'}
          </button>
        </form>
      ) : (
        <>
          {loading && <p>Actualizando la carta…</p>}
          {error && (
            <p role="alert">
              {error}{' '}
              <button type="button" onClick={retry}>
                Reintentar
              </button>
            </p>
          )}
          {!items.length ? (
            <p>
              Tu pedido está vacío.{' '}
              <Link className="text-link" to="/productos">
                Elegir productos
              </Link>
            </p>
          ) : (
            <form onSubmit={submit} className="order-form">
              <ul className="order-items">
                {lines.map(({ productId, quantity, product }) => (
                  <li key={productId}>
                    <div>
                      <strong>{product?.name || 'Producto ya no disponible'}</strong>
                      {product && (
                        <p>
                          {formatPrice(product.price)} por unidad · Stock: {product.stock}
                        </p>
                      )}
                    </div>
                    <label>
                      Cantidad de {product?.name || `producto ${productId}`}
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        required
                        value={quantity}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isSafeInteger(value) && value >= 1 && value <= 1000)
                            setQuantity(productId, value);
                        }}
                      />
                    </label>
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setQuantity(productId, 0)}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
              <p>
                <strong>Total estimado: {formatPrice(total)}</strong>
              </p>
              <p>El precio y el stock se verifican al confirmar. El pago se realiza en el local.</p>
              <label>
                Nombre{' '}
                <input
                  required
                  minLength="2"
                  maxLength="100"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </label>
              <label>
                Teléfono{' '}
                <input
                  type="tel"
                  required
                  minLength="6"
                  maxLength="30"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
              </label>
              <button
                className="button button-primary"
                type="submit"
                disabled={busy || loading || Boolean(error)}
              >
                {busy ? 'Confirmando…' : 'Confirmar pedido'}
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
