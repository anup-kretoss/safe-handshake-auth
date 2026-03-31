import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Check, Clock, Package, AlertCircle, Truck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import {
    useOrders,
    useSellerDeliveryRequests,
    useApproveDeliveryRequest,
    useRejectDeliveryRequest,
    usePayApprovedOrder,
    useMarkPickupReady,
} from '@/hooks/useApi';

const STATUS_STYLES: Record<string, { dot: string; label: string; badge: string }> = {
    pending:         { dot: 'bg-yellow-500', label: 'Pending',         badge: 'bg-yellow-100 text-yellow-700' },
    pending_payment: { dot: 'bg-orange-500', label: 'Awaiting Payment', badge: 'bg-orange-100 text-orange-700' },
    approved:        { dot: 'bg-blue-500',   label: 'Approved',        badge: 'bg-blue-100 text-blue-700' },
    paid:            { dot: 'bg-green-500',  label: 'Paid',            badge: 'bg-green-100 text-green-700' },
    shipped:         { dot: 'bg-purple-500', label: 'Shipped',         badge: 'bg-purple-100 text-purple-700' },
    delivered:       { dot: 'bg-green-600',  label: 'Delivered',       badge: 'bg-green-100 text-green-800' },
    cancelled:       { dot: 'bg-red-500',    label: 'Cancelled',       badge: 'bg-red-100 text-red-700' },
};

export default function OrdersPage() {
    const [tab, setTab] = useState<'buying' | 'selling'>('buying');

    const { data: orders = [], isLoading: ordersLoading, refetch: refetchOrders } = useOrders(tab === 'buying' ? 'bought' : 'sold');
    const { data: deliveryRequests = [], isLoading: drLoading, refetch: refetchRequests } = useSellerDeliveryRequests('pending');

    const approveMutation = useApproveDeliveryRequest();
    const rejectMutation = useRejectDeliveryRequest();
    const payMutation = usePayApprovedOrder();
    const markReadyMutation = useMarkPickupReady();

    const [countdowns, setCountdowns] = useState<Record<string, number>>({});

    useEffect(() => {
        const next: Record<string, number> = {};
        orders.forEach((o: any) => {
            if (o.remaining_seconds !== undefined) next[o.id] = o.remaining_seconds;
        });
        deliveryRequests.forEach((r: any) => {
            if (r.remaining_seconds !== undefined) next[r.id] = r.remaining_seconds;
        });
        setCountdowns(next);
    }, [orders, deliveryRequests]);

    useEffect(() => {
        const t = setInterval(() => {
            setCountdowns(prev => {
                const next = { ...prev };
                let changed = false;
                for (const k in next) {
                    if (next[k] > 0) { next[k]--; changed = true; }
                }
                return changed ? next : prev;
            });
        }, 1000);
        return () => clearInterval(t);
    }, []);

    const fmt = (s: number) => {
        if (!s || s <= 0) return 'Expired';
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };

    const handleApprove = async (id: string) => {
        try {
            await approveMutation.mutateAsync({ id });
            toast.success('24-hour delivery approved!');
            refetchOrders(); refetchRequests();
        } catch (e: any) { toast.error(e.message || 'Failed to approve'); }
    };

    const handleReject = async (id: string) => {
        try {
            await rejectMutation.mutateAsync({ id });
            toast.success('Declined. Switched to standard delivery.');
            refetchOrders(); refetchRequests();
        } catch (e: any) { toast.error(e.message || 'Failed to reject'); }
    };

    const handlePay = async (orderId: string) => {
        try {
            const res = await payMutation.mutateAsync(orderId);
            if (res.requires_payment && res.payment_url) {
                sessionStorage.setItem('pending_order_id', orderId);
                window.location.href = res.payment_url;
            }
        } catch (e: any) { toast.error(e.message || 'Payment failed'); }
    };

    const isEmpty = orders.length === 0 && (tab === 'buying' || deliveryRequests.length === 0);

    return (
        <div className="min-h-screen bg-background pb-20">
            <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
                <div className="flex items-center gap-3 mb-3">
                    <Link to="/profile"><ArrowLeft className="h-5 w-5 text-foreground" /></Link>
                    <h1 className="text-base font-semibold text-foreground">My Orders</h1>
                </div>
                <div className="flex bg-muted rounded-lg p-1">
                    {(['buying', 'selling'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition capitalize ${tab === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </header>

            <main className="px-4 py-5 space-y-4">
                {(ordersLoading || drLoading) ? (
                    [1, 2, 3].map(i => <div key={i} className="h-32 animate-pulse bg-card rounded-xl border border-border" />)
                ) : isEmpty ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                            <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No orders yet</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Items you {tab === 'buying' ? 'buy' : 'sell'} will appear here.
                        </p>
                    </div>
                ) : (
                    <>
                        {tab === 'selling' && deliveryRequests.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
                                    Pending Requests ({deliveryRequests.length})
                                </p>
                                {deliveryRequests.map((req: any) => (
                                    <div key={req.id} className="bg-card rounded-xl border-2 border-orange-300 overflow-hidden shadow-md">
                                        <div className="p-4 flex gap-3">
                                            <div className="h-14 w-14 rounded-xl bg-muted shrink-0 overflow-hidden border border-border">
                                                {req.orders?.products?.images?.[0]
                                                    ? <img src={req.orders.products.images[0]} className="w-full h-full object-cover" alt="" />
                                                    : <Package className="w-full h-full p-3 text-muted-foreground" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold truncate">{req.orders?.products?.title || 'Unknown Item'}</p>
                                                <p className="text-xs text-muted-foreground">AED {req.orders?.products?.price}</p>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg ${(countdowns[req.id] || 0) < 600 ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                                        <Clock className="h-3 w-3" />
                                                        {fmt(countdowns[req.id])}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Buyer: {req.orders?.profiles?.first_name || 'Guest'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3 bg-muted/20 border-t border-border/50 flex gap-2">
                                            <button
                                                onClick={() => handleReject(req.id)}
                                                disabled={rejectMutation.isPending}
                                                className="flex-1 py-2 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:bg-secondary transition disabled:opacity-50"
                                            >
                                                Decline
                                            </button>
                                            <button
                                                onClick={() => handleApprove(req.id)}
                                                disabled={approveMutation.isPending}
                                                className="flex-[2] py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 disabled:opacity-50"
                                            >
                                                <Check className="h-3.5 w-3.5" />
                                                Approve 24h Delivery
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {orders.length > 0 && (
                            <div className="space-y-3">
                                {tab === 'selling' && (
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">Order History</p>
                                )}
                                {orders.map((order: any) => (
                                    <OrderCard
                                        key={order.id}
                                        order={order}
                                        tab={tab}
                                        countdown={countdowns[order.id]}
                                        fmt={fmt}
                                        onPay={handlePay}
                                        onMarkReady={() => markReadyMutation.mutate(order.id)}
                                        isPaying={payMutation.isPending}
                                        isMarkingReady={markReadyMutation.isPending}
                                    />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </main>
            <BottomNav />
        </div>
    );
}

function OrderCard({
    order, tab, countdown, fmt, onPay, onMarkReady, isPaying, isMarkingReady
}: {
    order: any;
    tab: 'buying' | 'selling';
    countdown: number;
    fmt: (s: number) => string;
    onPay: (id: string) => void;
    onMarkReady: () => void;
    isPaying: boolean;
    isMarkingReady: boolean;
}) {
    const st = STATUS_STYLES[order.status] || STATUS_STYLES.pending;

    const itemPrice: number = order.products?.display_price ?? order.products?.price ?? 0;
    const deliveryFee: number = order.delivery_price ?? 0;
    const total: number = order.total_price ?? (itemPrice + deliveryFee);

    // 24h order still waiting for seller response
    const is24hPending =
        order.delivery_type === '24hour' &&
        order.status === 'pending' &&
        order.delivery_request_status === 'pending';

    // Buyer can pay: seller approved 24h, OR order switched to standard (rejected/expired)
    const canPay =
        order.status === 'approved' ||
        (order.status === 'pending' && order.delivery_type === 'standard');

    const isExpiredOrRejected =
        order.delivery_request_status === 'expired' ||
        order.delivery_request_status === 'rejected';

    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Amber banner when 24h was rejected or expired */}
            {tab === 'buying' && isExpiredOrRejected && order.status === 'pending' && (
                <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                        {order.delivery_request_status === 'expired'
                            ? 'Seller did not respond in time.'
                            : 'Seller declined 24-hour delivery.'}
                        {' '}Switched to standard delivery (AED {deliveryFee.toFixed(2)}). You can pay now.
                    </p>
                </div>
            )}

            <div className="p-3 flex gap-3">
                <div className="h-16 w-16 rounded-lg bg-muted overflow-hidden shrink-0">
                    {order.products?.images?.[0]
                        ? <img src={order.products.images[0]} alt="" className="h-full w-full object-cover" />
                        : <Package className="h-full w-full p-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate mb-1.5">{order.products?.title || 'Unknown Item'}</p>
                    {/* Price breakdown */}
                    <div className="space-y-0.5">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Item price</span>
                            <span>AED {itemPrice.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Delivery ({order.delivery_type === '24hour' ? '24-Hour' : 'Standard'})</span>
                            <span>AED {deliveryFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-xs font-bold text-foreground border-t border-border/40 pt-0.5">
                            <span>Total</span>
                            <span>AED {total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-3 py-2 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
                {/* Status */}
                <div className="flex items-center gap-1.5">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${st.dot}`} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{st.label}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Buyer: waiting for seller */}
                    {tab === 'buying' && is24hPending && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded border border-orange-200">
                            <Clock className="h-3 w-3 animate-pulse" />
                            Awaiting seller ({fmt(countdown)})
                        </div>
                    )}

                    {/* Buyer: pay now */}
                    {tab === 'buying' && canPay && (
                        <button
                            onClick={() => onPay(order.id)}
                            disabled={isPaying}
                            className="px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-extrabold rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1"
                        >
                            {isPaying
                                ? <span className="h-3 w-3 border border-white border-t-transparent rounded-full animate-spin" />
                                : <CheckCircle2 className="h-3 w-3" />}
                            Pay AED {total.toFixed(2)}
                        </button>
                    )}

                    {/* Seller: mark ready */}
                    {tab === 'selling' && order.status === 'paid' && (
                        <button
                            onClick={onMarkReady}
                            disabled={isMarkingReady}
                            className="px-3 py-1.5 bg-secondary text-foreground text-[11px] font-bold rounded-lg border border-border disabled:opacity-50 flex items-center gap-1"
                        >
                            <Truck className="h-3 w-3" />
                            Mark Ready
                        </button>
                    )}

                    {/* Shipped / Delivered badge */}
                    {(order.status === 'shipped' || order.status === 'delivered') && (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${st.badge}`}>
                            {st.label}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
