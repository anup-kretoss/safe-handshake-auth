import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, DollarSign, Eye, Trash2, Plus, TrendingUp, ShoppingBag, Clock, Check, X, AlertCircle, Truck } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import { useListedProducts, useDeleteProduct, useOrders, useSellerDeliveryRequests, useApproveDeliveryRequest, useRejectDeliveryRequest, useMarkPickupReady, useUpdateOrderStatus } from '@/hooks/useApi';
import { useEffect } from 'react';

export default function SellerDashboard() {
  const [tab, setTab] = useState<'active' | 'sold' | 'orders' | 'requests'>('active');

  const { data: products = [], isLoading: productsLoading } = useListedProducts();
  const { data: orders = [], isLoading: ordersLoading } = useOrders('sold');
  const { data: pendingRequests = [], isLoading: requestsLoading, refetch: refetchRequests } = useSellerDeliveryRequests('pending');
  const deleteProductMutation = useDeleteProduct();
  const approveMutation = useApproveDeliveryRequest();
  const rejectMutation = useRejectDeliveryRequest();
  const markPickupMutation = useMarkPickupReady();
  const updateStatusMutation = useUpdateOrderStatus();

  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  const activeProducts = products.filter((p: any) => !p.is_sold);
  const soldProducts = products.filter((p: any) => p.is_sold);

  const stats = {
    activeProducts: activeProducts.length,
    soldProducts: soldProducts.length,
    totalOrders: orders.length,
    pendingRequests: pendingRequests.length,
  };

  // Initialize countdowns from delivery requests
  useEffect(() => {
    const newCountdowns: Record<string, number> = {};
    pendingRequests.forEach((req: any) => {
      if (req.status === 'pending' && req.remaining_seconds !== undefined) {
        newCountdowns[req.id] = req.remaining_seconds;
      }
    });
    setCountdowns(newCountdowns);
  }, [pendingRequests]);

  // Tick countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdowns(prev => {
        const updated = { ...prev };
        let changed = false;
        Object.keys(updated).forEach(key => {
          if (updated[key] > 0) { updated[key] -= 1; changed = true; }
        });
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'Expired';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProductMutation.mutateAsync(id);
      toast.success('Product deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync({ id });
      toast.success('24-hour delivery approved!');
      refetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync({ id });
      toast.success('Request declined. Switched to standard delivery.');
      refetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject');
    }
  };

  const handleMarkPickupReady = async (orderId: string) => {
    try {
      await markPickupMutation.mutateAsync(orderId);
      toast.success('Item marked as ready for pickup!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    try {
      await updateStatusMutation.mutateAsync({ orderId, status: 'delivered' });
      toast.success('Order marked as delivered! Buyer has been notified.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await updateStatusMutation.mutateAsync({ orderId, status: 'cancelled' });
      toast.success('Order cancelled. Both parties have been notified.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  };

  const tabs = [
    { key: 'active', label: `Active (${stats.activeProducts})` },
    { key: 'sold', label: `Sold (${stats.soldProducts})` },
    { key: 'orders', label: `Orders (${stats.totalOrders})` },
    { key: 'requests', label: `Requests${stats.pendingRequests > 0 ? ` (${stats.pendingRequests})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </Link>
            <h1 className="text-lg font-semibold text-foreground">Seller Dashboard</h1>
          </div>
          <Link
            to="/sell"
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Item
          </Link>
        </div>
      </header>

      <div className="p-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-card p-4 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Package className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Active Items</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.activeProducts}</p>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-muted-foreground">Sold Items</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.soldProducts}</p>
          </div>
          <div className="bg-card p-4 rounded-xl border border-border">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingBag className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium text-muted-foreground">Total Orders</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalOrders}</p>
          </div>
          <div className={`bg-card p-4 rounded-xl border ${stats.pendingRequests > 0 ? 'border-orange-300 bg-orange-50' : 'border-border'}`}>
            <div className="flex items-center gap-2 mb-2">
              <Clock className={`h-5 w-5 ${stats.pendingRequests > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
              <span className="text-sm font-medium text-muted-foreground">Pending Requests</span>
            </div>
            <p className={`text-2xl font-bold ${stats.pendingRequests > 0 ? 'text-orange-600' : 'text-foreground'}`}>{stats.pendingRequests}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-secondary rounded-lg p-1 mb-4 overflow-x-auto gap-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key as any)}
              className={`flex-1 py-2 px-2 rounded-md text-xs font-medium transition whitespace-nowrap ${tab === key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'} ${key === 'requests' && stats.pendingRequests > 0 ? 'text-orange-600' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Active Products */}
        {tab === 'active' && (
          <div className="space-y-3">
            {productsLoading ? (
              [1, 2, 3].map(i => <div key={i} className="h-24 bg-card rounded-xl border border-border animate-pulse" />)
            ) : activeProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No active items</h3>
                <Link to="/sell" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium">
                  <Plus className="h-4 w-4" /> Add Item
                </Link>
              </div>
            ) : (
              activeProducts.map((product: any) => (
                <SellerProductCard key={product.id} product={product} onDelete={() => handleDelete(product.id)} showActions />
              ))
            )}
          </div>
        )}

        {/* Sold Products */}
        {tab === 'sold' && (
          <div className="space-y-3">
            {soldProducts.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No sold items yet</p>
              </div>
            ) : (
              soldProducts.map((product: any) => (
                <SellerProductCard key={product.id} product={product} showActions={false} />
              ))
            )}
          </div>
        )}

        {/* Orders */}
        {tab === 'orders' && (
          <div className="space-y-3">
            {ordersLoading ? (
              [1, 2, 3].map(i => <div key={i} className="h-24 bg-card rounded-xl border border-border animate-pulse" />)
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No orders yet</p>
              </div>
            ) : (
              orders.map((order: any) => (
                <SellerOrderCard
                  key={order.id}
                  order={order}
                  onMarkPickupReady={() => handleMarkPickupReady(order.id)}
                  onMarkDelivered={() => handleMarkDelivered(order.id)}
                  onCancel={() => handleCancelOrder(order.id)}
                  isUpdating={markPickupMutation.isPending || updateStatusMutation.isPending}
                />
              ))
            )}
          </div>
        )}

        {/* Delivery Requests */}
        {tab === 'requests' && (
          <div className="space-y-3">
            {requestsLoading ? (
              [1, 2].map(i => <div key={i} className="h-32 bg-card rounded-xl border border-border animate-pulse" />)
            ) : pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">No pending requests</h3>
                <p className="text-sm text-muted-foreground">24-hour delivery requests from buyers will appear here.</p>
              </div>
            ) : (
              pendingRequests.map((req: any) => (
                <DeliveryRequestCard
                  key={req.id}
                  request={req}
                  countdown={countdowns[req.id]}
                  formatTime={formatTime}
                  onApprove={() => handleApprove(req.id)}
                  onReject={() => handleReject(req.id)}
                  isApproving={approveMutation.isPending}
                  isRejecting={rejectMutation.isPending}
                />
              ))
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

function DeliveryRequestCard({
  request, countdown, formatTime, onApprove, onReject, isApproving, isRejecting
}: {
  request: any;
  countdown: number;
  formatTime: (s: number) => string;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const isExpired = !countdown || countdown <= 0;
  const isUrgent = countdown > 0 && countdown < 600; // < 10 mins

  return (
    <div className={`bg-card rounded-xl border-2 overflow-hidden ${isExpired ? 'border-red-200 opacity-70' : isUrgent ? 'border-orange-400 shadow-lg shadow-orange-100' : 'border-primary/20 shadow-lg shadow-primary/5'}`}>
      <div className="p-4 flex gap-4">
        <div className="h-16 w-16 rounded-xl bg-muted shrink-0 overflow-hidden border border-border">
          {request.orders?.products?.images?.[0] ? (
            <img src={request.orders.products.images[0]} className="w-full h-full object-cover" alt="" />
          ) : (
            <Package className="w-full h-full p-3 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <h4 className="text-sm font-bold text-foreground truncate">
              {request.orders?.products?.title || 'Unknown Item'}
            </h4>
            <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              #{request.id.split('-')[0]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            AED {request.orders?.products?.price || '—'}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <div className={`flex items-center gap-1.5 text-xs font-black px-2 py-1 rounded-lg ${isExpired ? 'bg-red-100 text-red-600' : isUrgent ? 'bg-orange-100 text-orange-600' : 'bg-primary/10 text-primary'}`}>
              <Clock className="h-3.5 w-3.5" />
              {isExpired ? 'Expired' : formatTime(countdown)}
            </div>
            <span className="text-xs text-muted-foreground">
              Buyer: <span className="text-foreground font-medium">{request.orders?.profiles?.first_name || 'Guest'}</span>
            </span>
          </div>
        </div>
      </div>

      {isExpired ? (
        <div className="px-4 py-3 bg-red-50 border-t border-red-100 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-600 font-medium">This request has expired and switched to standard delivery.</p>
        </div>
      ) : (
        <div className="px-4 py-3 bg-muted/20 flex gap-3 border-t border-border/50">
          <button
            onClick={onReject}
            disabled={isRejecting || isApproving}
            className="flex-1 py-2.5 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-secondary transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Decline
          </button>
          <button
            onClick={onApprove}
            disabled={isApproving || isRejecting}
            className="flex-[2] py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Check className="h-4 w-4" />
            Approve 24h Delivery
          </button>
        </div>
      )}
    </div>
  );
}

function SellerProductCard({ product, onDelete, showActions }: { product: any; onDelete?: () => void; showActions: boolean }) {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex gap-3">
        <img
          src={product.images?.[0] || '/placeholder.svg'}
          alt={product.title}
          className="w-16 h-16 rounded-lg object-cover"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{product.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">AED {product.price}</p>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded-full ${product.is_sold ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'}`}>
              {product.is_sold ? 'Sold' : 'Active'}
            </span>
            <span className="text-xs text-muted-foreground">{new Date(product.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        {showActions && (
          <div className="flex flex-col gap-1">
            <Link to={`/product/${product.id}`} className="p-1.5 text-muted-foreground hover:text-primary rounded">
              <Eye className="h-4 w-4" />
            </Link>
            <button onClick={onDelete} className="p-1.5 text-muted-foreground hover:text-destructive rounded">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SellerOrderCard({ order, onMarkPickupReady, onMarkDelivered, onCancel, isUpdating }: {
  order: any;
  onMarkPickupReady: () => void;
  onMarkDelivered: () => void;
  onCancel: () => void;
  isUpdating: boolean;
}) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex gap-3">
        <img
          src={order.products?.images?.[0] || '/placeholder.svg'}
          alt={order.products?.title}
          className="w-16 h-16 rounded-lg object-cover"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{order.products?.title}</h3>
          <p className="text-sm text-muted-foreground mb-2">AED {order.products?.price}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[order.status] || 'bg-secondary text-muted-foreground'}`}>
              {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
            </span>
            <span className={`text-xs px-2 py-1 rounded-full ${order.delivery_type === '24hour' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
              {order.delivery_type === '24hour' ? '24H' : 'Standard'}
            </span>
          </div>
        </div>
      </div>
      {/* Action buttons based on status */}
      {order.status === 'paid' && (
        <div className="flex gap-2">
          <button
            onClick={onMarkPickupReady}
            disabled={isUpdating}
            className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Truck className="h-3.5 w-3.5" /> Mark Ready for Pickup
          </button>
          <button
            onClick={onCancel}
            disabled={isUpdating}
            className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      )}
      {order.status === 'shipped' && (
        <div className="flex gap-2">
          <button
            onClick={onMarkDelivered}
            disabled={isUpdating}
            className="flex-1 py-2 rounded-xl bg-green-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" /> Mark as Delivered
          </button>
        </div>
      )}
    </div>
  );
}
