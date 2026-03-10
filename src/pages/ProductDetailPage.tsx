import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProductDetail, useCheckWishlist, useAddToWishlist, useRemoveFromWishlist } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Heart, Share2, MapPin, Tag, Ruler, Palette, Package, Layers } from 'lucide-react';
import { toast } from 'sonner';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: product, isLoading } = useProductDetail(id!);
  const { data: isWishlisted } = useCheckWishlist(id!);
  const addWishlist = useAddToWishlist();
  const removeWishlist = useRemoveFromWishlist();

  const toggleWishlist = async () => {
    if (!user) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }
    try {
      if (isWishlisted) {
        await removeWishlist.mutateAsync(id!);
        toast.success('Removed from wishlist');
      } else {
        await addWishlist.mutateAsync(id!);
        toast.success('Added to wishlist');
      }
    } catch {
      toast.error('Failed to update wishlist');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Product not found</p>
        <Link to="/dashboard" className="text-primary text-sm font-medium">Go back</Link>
      </div>
    );
  }

  const details = [
    { icon: Tag, label: 'Condition', value: product.condition },
    { icon: Ruler, label: 'Size', value: product.size },
    { icon: Palette, label: 'Color', value: product.color },
    { icon: Package, label: 'Brand', value: product.brand },
    { icon: Layers, label: 'Material', value: product.material },
    { icon: MapPin, label: 'Location', value: product.location },
  ].filter(d => d.value);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Image */}
      <div className="relative aspect-square bg-secondary">
        {product.images && product.images.length > 0 ? (
          <img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
        <div className="absolute top-4 left-4 right-4 flex justify-between">
          <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
          <div className="flex gap-2">
            <button className="h-10 w-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center">
              <Share2 className="h-5 w-5 text-foreground" />
            </button>
            <button onClick={toggleWishlist} className="h-10 w-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center">
              <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-destructive text-destructive' : 'text-foreground'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-5 space-y-5">
        {/* Title & Price */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold text-foreground">{product.title}</h1>
            <p className="text-xl font-bold text-primary shrink-0">${product.price}</p>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {product.categories?.name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                {product.categories.name}
              </span>
            )}
            {product.sub_categories?.name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium">
                {product.sub_categories.group_name ? `${product.sub_categories.group_name} · ` : ''}
                {product.sub_categories.name}
              </span>
            )}
          </div>
        </div>

        {/* Product Details Grid */}
        {details.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {details.map((d) => (
              <div key={d.label} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary">
                <d.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground">{d.label}</p>
                  <p className="text-xs font-medium text-foreground capitalize truncate">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-1">Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3">
        <button className="auth-btn w-full">Contact Seller</button>
      </div>
    </div>
  );
}
