import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext();

// Generate a unique cart item key
const genCartKey = (productId, hasCustom) =>
  hasCustom ? `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : productId;

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('giftsity_cart')) || [];
      // Ensure all items have a cartKey (migration for old cart data)
      return saved.map(i => ({ ...i, cartKey: i.cartKey || i.productId }));
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('giftsity_cart', JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1) => {
    const maxStock = product.stock || 999;
    const hasCustomizations = product.customizations && product.customizations.length > 0;
    const pid = product._id || product.productId;
    setItems(prev => {
      // If NOT customized, merge with existing non-customized entry
      if (!hasCustomizations) {
        const existing = prev.find(i => i.productId === pid && !i.customizations?.length);
        if (existing) {
          const newQty = Math.min(existing.quantity + (product.quantity || quantity), maxStock);
          if (newQty === existing.quantity) {
            toast.error(`Only ${maxStock} available in stock`);
            return prev;
          }
          toast.success('Updated quantity');
          return prev.map(i => i.cartKey === existing.cartKey ? { ...i, quantity: newQty } : i);
        }
      }
      // Add as new item with unique cartKey
      const cappedQty = Math.min(product.quantity || quantity, maxStock);
      toast.success('Added to cart');
      return [...prev, {
        cartKey: genCartKey(pid, hasCustomizations),
        productId: pid,
        title: product.title,
        price: product.price,
        image: product.image || product.images?.[0]?.url || '',
        sellerId: product.sellerId?._id || product.sellerId,
        sellerName: product.sellerName || product.sellerId?.sellerProfile?.businessName || product.sellerId?.name || 'Seller',
        quantity: cappedQty,
        stock: maxStock,
        slug: product.slug,
        customizations: product.customizations || []
      }];
    });
  };

  const updateQuantity = (cartKey, quantity) => {
    if (quantity <= 0) return removeItem(cartKey);
    setItems(prev => prev.map(i => {
      if (i.cartKey !== cartKey) return i;
      const capped = Math.min(quantity, i.stock || 999);
      if (capped < quantity) toast.error(`Only ${i.stock} available in stock`);
      return { ...i, quantity: capped };
    }));
  };

  const removeItem = (cartKey) => {
    setItems(prev => prev.filter(i => i.cartKey !== cartKey));
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

/** Check if a product has required customization options that must be filled before add-to-cart */
export const needsCustomization = (product) =>
  product?.isCustomizable && product?.customizationOptions?.some(o => o.required);
