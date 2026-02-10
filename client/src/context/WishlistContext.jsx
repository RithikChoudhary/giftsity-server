import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import API from '../api';
import toast from 'react-hot-toast';

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState([]);

  const loadWishlist = useCallback(async () => {
    if (!user) { setWishlistIds([]); return; }
    try {
      const { data } = await API.get('/wishlist/ids');
      setWishlistIds(data.productIds || []);
    } catch (e) { /* silent */ }
  }, [user]);

  useEffect(() => { loadWishlist(); }, [loadWishlist]);

  const isWishlisted = (productId) => wishlistIds.includes(productId);

  const toggleWishlist = async (productId) => {
    if (!user) { toast.error('Please sign in to use wishlist'); return; }
    try {
      if (isWishlisted(productId)) {
        await API.delete(`/wishlist/${productId}`);
        setWishlistIds(prev => prev.filter(id => id !== productId));
        toast.success('Removed from wishlist');
      } else {
        await API.post('/wishlist', { productId });
        setWishlistIds(prev => [...prev, productId]);
        toast.success('Added to wishlist');
      }
    } catch (e) { toast.error('Failed to update wishlist'); }
  };

  return (
    <WishlistContext.Provider value={{ wishlistIds, isWishlisted, toggleWishlist, count: wishlistIds.length }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
