import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertTriangle, Package, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';

interface AdminDeliveryRequest {
  id: string;
  delivery_request_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  admin_notes?: string;
  created_at: string;
  expires_at: string;
  remaining_seconds: number;
  remaining_minutes: number;
  is_expired: boolean;
  delivery_requests: {
    id: string;
    product_id: string;
    orders: {
      id: string;
      buyer_id: string;
      shipping_address: any;
      products: {
        id: string;
        title: string;
        images: string[];
        price: number;
        seller_id: string;
      };
      profiles: {
        first_name: string;
        last_name: string;
        email: string;
      };
    };
    profiles: {
      first_name: string;
      last_name: string;
      email: string;
    };
  };
}

export default function AdminDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'approved' | 'rejected' | 'expired' | 'all'>('pending');
  const [selectedRequest, setSelectedRequest] = useState<AdminDeliveryRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  // Check if user is admin
  useEffect(() => {
    if (profile && !['admin', 'super_admin'].includes(profile.role || '')) {
      navigate('/dashboard');
      toast.error('Admin access required');
    }
  }, [profile, navigate]);

  const { data: requestsData, isLoading, refetch } = useQuery({
    queryKey: ['admin-delivery-requests', selectedStatus],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(`admin-delivery-requests?action=list&status=${selectedStatus}&limit=50`, {
        method: 'GET'
      });
      if (error) throw error;
      return data;
    },
    enabled: !!user && ['admin', 'super_admin'].includes(profile?.role || ''),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-delivery-requests?action=approve', {
        method: 'POST',
        body: { admin_delivery_request_id: requestId, admin_notes: notes }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('24-hour delivery approved successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-requests'] });
      setSelectedRequest(null);
      setAdminNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve request');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ requestId, notes }: { requestId: string; notes?: string }) => {
      const { data, error } = await supabase.functions.invoke('admin-delivery-requests?action=reject', {
        method: 'POST',
        body: { admin_delivery_request_id: requestId, admin_notes: notes }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Request rejected and moved to standard delivery');
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-requests'] });
      setSelectedRequest(null);
      setAdminNotes('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject request');
    }
  });

  const requests = requestsData?.data || [];
  const stats = requestsData?.stats || { pending: 0, approved: 0, rejected: 0, expired: 0, total: 0 };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'approved': return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      case 'expired': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'approved': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'expired': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return 'Expired';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  if (!profile || !['admin', 'super_admin'].includes(profile.role || '')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Admin access required to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/profile">
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <span className="text-sm font-medium text-gray-600">Pending</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Approved</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600">Rejected</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex bg-white rounded-lg border border-gray-200 p-1 mb-4 overflow-x-auto">
          {[
            { key: 'pending', label: 'Pending', count: stats.pending },
            { key: 'approved', label: 'Approved', count: stats.approved },
            { key: 'rejected', label: 'Rejected', count: stats.rejected },
            { key: 'expired', label: 'Expired', count: stats.expired },
            { key: 'all', label: 'All', count: stats.total },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setSelectedStatus(key as any)}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors whitespace-nowrap ${
                selectedStatus === key 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Requests List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-white rounded-lg border border-gray-200 animate-pulse" />
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No requests found</h3>
              <p className="text-gray-600">No {selectedStatus === 'all' ? '' : selectedStatus} delivery requests at the moment.</p>
            </div>
          ) : (
            requests.map((request: AdminDeliveryRequest) => (
              <div key={request.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex gap-3">
                  <img
                    src={request.delivery_requests.orders.products.images?.[0] || '/placeholder.svg'}
                    alt={request.delivery_requests.orders.products.title}
                    className="w-16 h-16 rounded-lg object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-gray-900 truncate">
                        {request.delivery_requests.orders.products.title}
                      </h3>
                      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </div>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><span className="font-medium">Price:</span> AED {request.delivery_requests.orders.products.price}</p>
                      <p><span className="font-medium">Buyer:</span> {request.delivery_requests.orders.profiles.first_name} {request.delivery_requests.orders.profiles.last_name}</p>
                      <p><span className="font-medium">Seller:</span> {request.delivery_requests.profiles.first_name} {request.delivery_requests.profiles.last_name}</p>
                      
                      {request.status === 'pending' && (
                        <p className={`font-medium ${request.is_expired ? 'text-red-600' : 'text-orange-600'}`}>
                          <span className="font-medium">Time remaining:</span> {formatTimeRemaining(request.remaining_seconds)}
                        </p>
                      )}
                      
                      {request.admin_notes && (
                        <p><span className="font-medium">Admin notes:</span> {request.admin_notes}</p>
                      )}
                    </div>

                    {request.status === 'pending' && !request.is_expired && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setSelectedRequest(request)}
                          className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                          Review Request
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Review Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Review 24-Hour Delivery Request</h3>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">{selectedRequest.delivery_requests.orders.products.title}</h4>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="font-medium">Price:</span> AED {selectedRequest.delivery_requests.orders.products.price}</p>
                  <p><span className="font-medium">Buyer:</span> {selectedRequest.delivery_requests.orders.profiles.first_name} {selectedRequest.delivery_requests.orders.profiles.last_name}</p>
                  <p><span className="font-medium">Seller:</span> {selectedRequest.delivery_requests.profiles.first_name} {selectedRequest.delivery_requests.profiles.last_name}</p>
                  <p><span className="font-medium">Time remaining:</span> {formatTimeRemaining(selectedRequest.remaining_seconds)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes (Optional)
                </label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Add notes about your decision..."
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => {
                  setSelectedRequest(null);
                  setAdminNotes('');
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => rejectMutation.mutate({ 
                  requestId: selectedRequest.id, 
                  notes: adminNotes || 'Request rejected by admin' 
                })}
                disabled={rejectMutation.isPending}
                className="flex-1 px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                onClick={() => approveMutation.mutate({ 
                  requestId: selectedRequest.id, 
                  notes: adminNotes 
                })}
                disabled={approveMutation.isPending}
                className="flex-1 px-4 py-2 text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}