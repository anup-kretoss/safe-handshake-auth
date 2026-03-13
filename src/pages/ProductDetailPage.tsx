import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProductDetail, useWishlist, useToggleWishlist, useCreateOrder, useShippingAddresses } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeft, Heart, Share2, MapPin, Tag, Ruler, Palette, Package, Layers, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: product, isLoading } = useProductDetail(id!);
  const { data: wishlistItems = [] } = useWishlist();
  const toggleWishlistMutation = useToggleWishlist();

  const isWishlisted = useMemo(
    () => wishlistItems.some(item => item.product_id === id),
    [wishlistItems, id]
  );

  const [isBuyModalOpen, setIsBuyModalOpen] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'standard' | '24hour'>('standard');
  const [address, setAddress] = useState({
    email: '',
    phone_number: '',
    address: '',
    town_city: '',
    postcode: '',
  });

  const { data: pastAddresses } = useShippingAddresses();
  const createOrderMutation = useCreateOrder();

  useEffect(() => {
    if (user && pastAddresses && pastAddresses.length > 0) {
      setAddress(pastAddresses[0].shipping_address);
    } else if (user) {
      setAddress(prev => ({ ...prev, email: user.email || '' }));
    }
  }, [user, pastAddresses]);

  const toggleWishlist = async () => {
    if (!user) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }
    try {
      await toggleWishlistMutation.mutateAsync({ productId: id!, isWishlist: !isWishlisted });
      toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    } catch {
      toast.error('Failed to update wishlist');
    }
  };

  const handleContactSeller = async () => {
    if (!user) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    if (user.id === product.seller_id) {
      toast.error('You cannot message yourself');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('conversations?action=create', {
        method: 'POST',
        body: {
          seller_id: product.seller_id,
          product_id: product.id,
          type: 'chat'
        }
      });

      if (error) throw error;
      if (data.success) {
        navigate(`/chat/${data.data.id}`);
      } else {
        throw new Error(data.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start conversation');
    }
  };

  const handleBuy = async () => {
    if (!user) {
      toast.error('Please login first');
      navigate('/login');
      return;
    }

    const missing = Object.entries(address).filter(([k, v]) => !String(v).trim());
    if (missing.length > 0) {
      toast.error('Please complete your shipping address');
      return;
    }

    try {
      const res = await createOrderMutation.mutateAsync({
        product_id: product.id,
        delivery_type: deliveryType,
        shipping_address: address,
      });

      toast.success(res.message || 'Order placed!');
      setIsBuyModalOpen(false);
      navigate('/orders');
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
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
    <div className="min-h-screen bg-background pb-24">
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
            <p className="text-xl font-bold text-primary shrink-0">${product.display_price || product.price}</p>
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
          {product.seller_name && (
            <div className="mt-4 p-3 rounded-xl border border-border bg-card flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {(product as any).seller_name[0]}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Seller</p>
                <p className="text-sm font-semibold">{(product as any).seller_name}</p>
              </div>
            </div>
          )}
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
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-4 flex gap-3 backdrop-blur-lg bg-card/90">
        <button
          onClick={handleContactSeller}
          className="flex-1 h-12 rounded-xl border border-border flex items-center justify-center gap-2 font-semibold hover:bg-secondary transition active:scale-[0.98]"
        >
          Message Seller
        </button>
        <button
          onClick={() => setIsBuyModalOpen(true)}
          className="flex-1 h-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition active:scale-[0.98]"
        >
          Buy Now
        </button>
      </div>

      {/* Buy Modal */}
      {isBuyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <h2 className="text-xl font-bold mb-4">Complete Your Order</h2>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Delivery Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setDeliveryType('standard')}
                    className={`p-3 rounded-xl border-2 transition text-left ${deliveryType === 'standard' ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <p className="text-sm font-bold">Standard</p>
                    <p className="text-[10px] text-muted-foreground">3-5 Days · $20</p>
                  </button>
                  <button
                    onClick={() => setDeliveryType('24hour')}
                    className={`p-3 rounded-xl border-2 transition text-left ${deliveryType === '24hour' ? 'border-primary bg-primary/5' : 'border-border'}`}
                  >
                    <p className="text-sm font-bold">24-Hour</p>
                    <p className="text-[10px] text-muted-foreground">Next Day · $40</p>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Shipping Address</label>
                <input
                  placeholder="Email"
                  value={address.email}
                  onChange={e => setAddress({ ...address, email: e.target.value })}
                  className="auth-input w-full"
                />
                <input
                  placeholder="Phone Number"
                  value={address.phone_number}
                  onChange={e => setAddress({ ...address, phone_number: e.target.value })}
                  className="auth-input w-full"
                />
                <textarea
                  placeholder="Street Address"
                  value={address.address}
                  onChange={e => setAddress({ ...address, address: e.target.value })}
                  className="auth-input w-full pt-3"
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Town / City"
                    value={address.town_city}
                    onChange={e => setAddress({ ...address, town_city: e.target.value })}
                    className="auth-input w-full"
                  />
                  <input
                    placeholder="Postcode"
                    value={address.postcode}
                    onChange={e => setAddress({ ...address, postcode: e.target.value })}
                    className="auth-input w-full"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setIsBuyModalOpen(false)}
                className="flex-1 h-12 rounded-xl text-sm font-semibold hover:bg-secondary transition"
              >
                Cancel
              </button>
              <button
                onClick={handleBuy}
                disabled={createOrderMutation.isPending}
                className="flex-[2] h-12 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {createOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Confirm Purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
