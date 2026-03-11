import { Link } from 'react-router-dom';
import { useWishlist, useToggleWishlist } from '@/hooks/useApi';
import { ArrowLeft, Heart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

export default function WishlistPage() {
  const { data: wishlistItems = [], isLoading } = useWishlist();
  const toggleWishlist = useToggleWishlist();

  const handleRemove = async (productId: string) => {
    try {
      await toggleWishlist.mutateAsync({ productId, isWishlist: false });
      toast.success('Removed from wishlist');
    } catch {
      toast.error('Failed to remove');
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-base font-semibold text-foreground">My Wishlist</h1>
        <span className="ml-auto text-xs text-muted-foreground">{wishlistItems.length} items</span>
      </header>

      <main className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-xl bg-secondary animate-pulse" />
            ))}
          </div>
        ) : wishlistItems.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Heart className="h-12 w-12 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Your wishlist is empty</p>
            <Link to="/dashboard" className="text-primary text-sm font-medium">Browse products</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {wishlistItems.map(item => (
              <Link
                key={item.id}
                to={`/product/${item.product_id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition"
              >
                <div className="h-20 w-20 rounded-lg bg-secondary shrink-0 overflow-hidden">
                  {item.products?.images && item.products.images.length > 0 ? (
                    <img src={item.products.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.products?.title}</p>
                  <p className="text-xs text-muted-foreground capitalize">{item.products?.condition}</p>
                  <p className="text-sm font-bold text-primary mt-1">${item.products?.price}</p>
                </div>
                <button
                  onClick={e => { e.preventDefault(); handleRemove(item.product_id); }}
                  className="shrink-0 h-9 w-9 flex items-center justify-center rounded-full hover:bg-destructive/10 transition"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </Link>
            ))}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
