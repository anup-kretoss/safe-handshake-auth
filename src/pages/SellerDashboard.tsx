import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, DollarSign, Eye, Edit, Trash2, Plus, TrendingUp, ShoppingBag } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

export default function SellerDashboard() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<'active' | 'sold' | 'orders'>('active');

    // Fetch seller's products
    const { data: products = [], isLoading: productsLoading } = useQuery({
        queryKey: ['seller-products'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('products?action=listed', {
                method: 'GET'
            });
            if (error) throw error;
            return data.data;
        },
        enabled: !!user,
    });

    // Fetch seller's orders
    const { data: orders = [], isLoading: ordersLoading } = useQuery({
        queryKey: ['seller-orders'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('orders?action=seller-orders', {
                method: 'GET'
            });
            if (error) throw error;
            return data.data;
        },
        enabled: !!user,
    });

    // Fetch delivery requests
    const { data: deliveryRequests = [] } = useQuery({
        queryKey: ['delivery-requests'],
        queryFn: async () => {
            const { data, error } = await supabase.functions.invoke('delivery-requests?action=list', {
                method: 'GET'
            });
            if (error) throw error;
            return data.data.filter((dr: any) => dr.seller_id === user?.id);
        },
        enabled: !!user,
    });

    const deleteProductMutation = useMutation({
        mutationFn: async (productId: string) => {
            const { error } = await supabase.functions.invoke(`products?action=delete&id=${productId}`, {
                method: 'DELETE'
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['seller-products'] });
            toast.success('Product deleted successfully');
        }
    });

    const activeProducts = products.filter((p: any) => !p.is_sold);
    const soldProducts = products.filter((p: any) => p.is_sold);
    const pendingDeliveryRequests = deliveryRequests.filter((dr: any) => dr.status === 'pending');

    const stats = {
        totalProducts: products.length,
        activeProducts: activeProducts.length,
        soldProducts: soldProducts.length,
        totalOrders: orders.length,
        pendingRequests: pendingDeliveryRequests.length,
        totalRevenue: soldProducts.reduce((sum: number, p: any) => sum + (p.price || 0), 0)
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link to="/profile">
                            <ArrowLeft className="h-5 w-5 text-gray-600" />
                        </Link>
                        <h1 className="text-lg font-semibold text-gray-900">Seller Dashboard</h1>
                    </div>
                    <Link
                        to="/sell"
                        className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Add Item
                    </Link>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="p-4">
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-medium text-gray-600">Active Items</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.activeProducts}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <span className="text-sm font-medium text-gray-600">Sold Items</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.soldProducts}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingBag className="h-5 w-5 text-purple-600" />
                            <span className="text-sm font-medium text-gray-600">Total Orders</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">{stats.totalOrders}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-5 w-5 text-orange-600" />
                            <span className="text-sm font-medium text-gray-600">Revenue</span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900">AED {stats.totalRevenue}</p>
                    </div>
                </div>

                {/* Pending Delivery Requests Alert */}
                {pendingDeliveryRequests.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Package className="h-5 w-5 text-orange-600" />
                            <span className="font-medium text-orange-800">
                                {pendingDeliveryRequests.length} Pending Delivery Request{pendingDeliveryRequests.length > 1 ? 's' : ''}
                            </span>
                        </div>
                        <p className="text-sm text-orange-700 mb-3">
                            You have delivery requests waiting for approval. Respond quickly to avoid expiration.
                        </p>
                        <Link
                            to="/orders"
                            className="inline-flex items-center gap-2 bg-orange-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-orange-700"
                        >
                            View Requests
                        </Link>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex bg-white rounded-lg border border-gray-200 p-1 mb-4">
                    <button
                        onClick={() => setTab('active')}
                        className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                            tab === 'active' 
                                ? 'bg-blue-600 text-white' 
                                : 'text-gray-600 hover:text-blue-600'
                        }`}
                    >
                        Active ({stats.activeProducts})
                    </button>
                    <button
                        onClick={() => setTab('sold')}
                        className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                            tab === 'sold' 
                                ? 'bg-blue-600 text-white' 
                                : 'text-gray-600 hover:text-blue-600'
                        }`}
                    >
                        Sold ({stats.soldProducts})
                    </button>
                    <button
                        onClick={() => setTab('orders')}
                        className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                            tab === 'orders' 
                                ? 'bg-blue-600 text-white' 
                                : 'text-gray-600 hover:text-blue-600'
                        }`}
                    >
                        Orders ({stats.totalOrders})
                    </button>
                </div>

                {/* Content */}
                {tab === 'active' && (
                    <div className="space-y-3">
                        {productsLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-24 bg-white rounded-lg border border-gray-200 animate-pulse" />
                                ))}
                            </div>
                        ) : activeProducts.length === 0 ? (
                            <div className="text-center py-12">
                                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No active items</h3>
                                <p className="text-gray-600 mb-4">Start selling by adding your first item</p>
                                <Link
                                    to="/sell"
                                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Item
                                </Link>
                            </div>
                        ) : (
                            activeProducts.map((product: any) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onDelete={() => deleteProductMutation.mutate(product.id)}
                                    showActions={true}
                                />
                            ))
                        )}
                    </div>
                )}

                {tab === 'sold' && (
                    <div className="space-y-3">
                        {soldProducts.length === 0 ? (
                            <div className="text-center py-12">
                                <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No sold items yet</h3>
                                <p className="text-gray-600">Your sold items will appear here</p>
                            </div>
                        ) : (
                            soldProducts.map((product: any) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    showActions={false}
                                />
                            ))
                        )}
                    </div>
                )}

                {tab === 'orders' && (
                    <div className="space-y-3">
                        {ordersLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-24 bg-white rounded-lg border border-gray-200 animate-pulse" />
                                ))}
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="text-center py-12">
                                <ShoppingBag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
                                <p className="text-gray-600">Orders for your items will appear here</p>
                            </div>
                        ) : (
                            orders.map((order: any) => (
                                <OrderCard key={order.id} order={order} />
                            ))
                        )}
                    </div>
                )}
            </div>

            <BottomNav />
        </div>
    );
}

function ProductCard({ product, onDelete, showActions }: { 
    product: any; 
    onDelete?: () => void; 
    showActions: boolean; 
}) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex gap-3">
                <img
                    src={product.images?.[0] || '/placeholder.svg'}
                    alt={product.title}
                    className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{product.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">AED {product.price}</p>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                            product.is_sold 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-blue-100 text-blue-700'
                        }`}>
                            {product.is_sold ? 'Sold' : 'Active'}
                        </span>
                        <span className="text-xs text-gray-500">
                            {new Date(product.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
                {showActions && (
                    <div className="flex flex-col gap-1">
                        <Link
                            to={`/product/${product.id}`}
                            className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                            <Eye className="h-4 w-4" />
                        </Link>
                        <button
                            onClick={onDelete}
                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

function OrderCard({ order }: { order: any }) {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'paid': return 'bg-blue-100 text-blue-700';
            case 'shipped': return 'bg-purple-100 text-purple-700';
            case 'delivered': return 'bg-green-100 text-green-700';
            case 'cancelled': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex gap-3">
                <img
                    src={order.products?.images?.[0] || '/placeholder.svg'}
                    alt={order.products?.title}
                    className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{order.products?.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">AED {order.products?.price}</p>
                    <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                            {order.delivery_type === '24hour' ? '24h Delivery' : 'Standard'}
                        </span>
                        <span className="text-xs text-gray-500">
                            {new Date(order.created_at).toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}