import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext();

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('giftsity_cart')) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('giftsity_cart', JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1) => {
    const maxStock = product.stock || 999;
    setItems(prev => {
      const existing = prev.find(i => i.productId === product._id);
      if (existing) {
        const newQty = Math.min(existing.quantity + quantity, maxStock);
        if (newQty === existing.quantity) {
          toast.error(`Only ${maxStock} available in stock`);
          return prev;
        }
        toast.success('Updated quantity');
        return prev.map(i => i.productId === product._id ? { ...i, quantity: newQty } : i);
      }
      const cappedQty = Math.min(quantity, maxStock);
      toast.success('Added to cart');
      return [...prev, {
        productId: product._id,
        title: product.title,
        price: product.price,
        image: product.images?.[0]?.url || '',
        sellerId: product.sellerId?._id || product.sellerId,
        sellerName: product.sellerId?.sellerProfile?.businessName || product.sellerId?.name || 'Seller',
        quantity: cappedQty,
        stock: maxStock
      }];
    });
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) return removeItem(productId);
    setItems(prev => prev.map(i => {
      if (i.productId !== productId) return i;
      const capped = Math.min(quantity, i.stock || 999);
      if (capped < quantity) toast.error(`Only ${i.stock} available in stock`);
      return { ...i, quantity: capped };
    }));
  };

  const removeItem = (productId) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
    toast.success('Removed from cart');
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart, total, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
