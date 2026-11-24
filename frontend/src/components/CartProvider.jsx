import { createContext, useContext, useState } from 'react';
import { useNotifications } from './Notifications.jsx';

const CartContext = createContext(null);
const pendingKey = 'salamanca.pendingOrder';

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [pendingState, setPendingState] = useState(() => {
    try {
      const saved = sessionStorage.getItem(pendingKey);
      if (!saved) return { pending: null, error: '' };
      const pending = JSON.parse(saved);
      if (!pending || typeof pending.requestId !== 'string' || !Array.isArray(pending.items)) {
        throw new Error('Pedido pendiente inválido');
      }
      return { pending, error: '' };
    } catch {
      return {
        pending: null,
        error:
          'No se pudo leer el pedido pendiente de esta pestaña. Revisá el almacenamiento del navegador antes de confirmar otro pedido.',
      };
    }
  });
  const { notify } = useNotifications();

  function setPending(pending) {
    if (pending) sessionStorage.setItem(pendingKey, JSON.stringify(pending));
    else sessionStorage.removeItem(pendingKey);
    setPendingState({ pending, error: '' });
  }

  function add(product) {
    if (pendingState.pending || pendingState.error) {
      notify('Resolvé primero la confirmación pendiente en Mi pedido.', 'error');
      return;
    }
    const existing = items.find((item) => item.productId === product.id);
    if (!product.available || product.stock <= (existing?.quantity || 0)) {
      notify('No hay más unidades disponibles de este producto.', 'error');
      return;
    }
    setItems((current) =>
      existing
        ? current.map((item) =>
            item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          )
        : [...current, { productId: product.id, quantity: 1 }],
    );
    notify(`${product.name} agregado al pedido.`);
  }

  function setQuantity(productId, quantity) {
    setItems((current) =>
      quantity === 0
        ? current.filter((item) => item.productId !== productId)
        : current.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
    );
  }

  return (
    <CartContext.Provider
      value={{
        items,
        add,
        setQuantity,
        clear: () => setItems([]),
        restore: (saved) =>
          setItems(saved.map(({ productId, quantity }) => ({ productId, quantity }))),
        ...pendingState,
        setPending,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
