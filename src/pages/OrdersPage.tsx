import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Truck, Check, X, Clock, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

export default function OrdersPage() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<'buying' | 'selling'>('buying');

    const { data: orders = [], isLoading } = useQuery({
        queryKey: ['orders', tab],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke(`orders?action=${tab === 'buying' ? 'list' : 'seller-orders'}`, {
                method: 'GET'
            });
            if (error) throw error;
            return data.data;
        },
        enabled: !!user,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ orderId, status }: { orderId: string, status: string }) => {
            const { data, error } = await supabase.functions.invoke('orders?action=update-status', {
                method: 'POST',
                body: { order_id: orderId, status }
            });
            if (error) throw error;
            return data.data;
        },
        onSuccess: () => {
            toast.success('Status updated');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
    });

    const approveDeliveryMutation = useMutation({
        mutationFn: async (drId: string) => {
            const { data, error } = await supabase.functions.invoke('delivery-requests?action=approve', {
                method: 'POST',
                body: { delivery_request_id: drId }
            });
            if (error) throw error;
            return data.data;
        },
        onSuccess: () => {
            toast.success('24-hour delivery approved');
            queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
    });

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
                <div className="flex items-center gap-3 mb-4">
                    <Link to="/profile">
                        <ArrowLeft className="h-5 w-5 text-foreground" />
                    </Link>
                    <h1 className="text-base font-semibold text-foreground">My Orders</h1>
                </div>

                <div className="flex bg-muted rounded-lg p-1">
                    <button
                        onClick={() => setTab('buying')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${tab === 'buying' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                        Buying
                    </button>
                    <button
                        onClick={() => setTab('selling')}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition ${tab === 'selling' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                    >
                        Selling
                    </button>
                </div>
            </header>

            <main className="px-4 py-6 space-y-4">
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2].map(i => (
                            <div key={i} className="h-32 w-full animate-pulse bg-card rounded-xl border border-border" />
                        ))}
                    </div>
                ) : orders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No orders yet</h3>
                        <p className="text-sm text-muted-foreground max-w-[200px]">Items you buy or sell will appear here.</p>
                    </div>
                ) : (
                    orders.map((order: any) => (
                        <div key={order.id} className="bg-card rounded-xl border border-border overflow-hidden">
                            <div className="p-3 border-b border-border flex gap-3">
                                <div className="h-16 w-16 rounded-lg bg-muted object-cover overflow-hidden shrink-0">
                                    {order.products?.images?.[0] ? (
                                        <img src={order.products.images[0]} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <Package className="h-full w-full p-4 text-muted-foreground" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-semibold truncate">{order.products?.title || 'Unknown Item'}</h3>
                                    <p className="text-xs text-muted-foreground mb-1">AED {order.delivery_price + (order.products?.price || 0)}</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className={`inline-block w-2 h-2 rounded-full ${order.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{order.status}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${order.delivery_type === '24hour' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {order.delivery_type === '24hour' ? '24H' : 'Standard'}
                                    </div>
                                </div>
                            </div>

                            <div className="px-3 py-2 bg-muted/30 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {new Date(order.created_at).toLocaleDateString()}
                                </div>

                                <div className="flex gap-2">
                                    {/* Seller Actions */}
                                    {tab === 'selling' && order.status === 'paid' && (
                                        <button
                                            onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'shipped' })}
                                            className="px-3 py-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-lg"
                                        >
                                            Mark Shipped
                                        </button>
                                    )}

                                    {/* Approval Flow for 24H Delivery */}
                                    {tab === 'selling' && order.status === 'pending' && order.delivery_type === '24hour' && (
                                        <button
                                            onClick={() => approveDeliveryMutation.mutate(order.id)}
                                            className="px-3 py-1 bg-green-500 text-white text-[10px] font-bold rounded-lg"
                                        >
                                            Approve 24H Delivery
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </main>
            <BottomNav />
        </div>
    );
}
