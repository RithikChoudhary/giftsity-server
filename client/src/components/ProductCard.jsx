import { Link } from 'react-router-dom';
import { ShoppingBag, Star, Eye, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product._id);

  const handleWishlist = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(product._id);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      productId: product._id,
      title: product.title,
      price: product.price,
      image: product.images?.[0]?.url,
      sellerId: product.sellerId?._id || product.sellerId,
      sellerName: product.sellerId?.sellerProfile?.businessName || 'Seller',
      stock: product.stock,
      slug: product.slug
    });
  };

  return (
    <Link to={`/product/${product.slug}`} className="group block">
      <div className="bg-card border border-edge/50 rounded-2xl overflow-hidden hover:border-edge-strong hover:shadow-lg transition-all duration-300">
        <div className="relative aspect-square overflow-hidden bg-inset">
          {product.images?.[0]?.url ? (
            <img src={product.images[0].url} alt={product.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-theme-dim">
              <ShoppingBag className="w-12 h-12" />
            </div>
          )}
          {product.isFeatured && (
            <span className="absolute top-2 left-2 px-2 py-0.5 bg-amber-500 text-zinc-950 text-xs font-bold rounded-full">Featured</span>
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          <button onClick={handleWishlist} className={`absolute top-3 right-3 p-2 rounded-full transition-all shadow-lg ${wishlisted ? 'bg-red-500 text-white' : 'bg-black/40 text-white opacity-0 group-hover:opacity-100'}`} title={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}>
            <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-white' : ''}`} />
          </button>
          <button onClick={handleAdd} className="absolute bottom-3 right-3 p-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all shadow-lg" title="Add to cart">
            <ShoppingBag className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-xs text-amber-400/80 font-medium mb-1">{product.sellerId?.sellerProfile?.businessName || 'Seller'}</p>
          <h3 className="font-semibold text-theme-primary text-sm line-clamp-2 mb-2 group-hover:text-amber-400 transition-colors">{product.title}</h3>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-theme-primary">Rs. {product.price?.toLocaleString('en-IN')}</span>
            {product.averageRating > 0 && (
              <div className="flex items-center gap-1 text-xs text-theme-muted">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {product.averageRating.toFixed(1)}
              </div>
            )}
          </div>
          {product.stock <= 5 && product.stock > 0 && (
            <p className="text-xs text-red-400 mt-1">Only {product.stock} left!</p>
          )}
        </div>
      </div>
    </Link>
  );
}
