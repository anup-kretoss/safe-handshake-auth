import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCategories, fetchSubCategories, fetchProducts,
  fetchProductDetail, createProduct, deleteProduct, updateProduct,
  fetchWishlist, toggleWishlist,
  getProfile, updateProfile,
  fetchOrders, completePayment, approveDeliveryRequest, rejectDeliveryRequest,
  createOrder, fetchShippingAddresses, uploadImages, fetchSellerDeliveryRequests,
  markPickupReady, updateOrderStatus,
  fetchConversations, fetchMessages, sendMessage, createConversation, respondToOffer,
  fetchNotifications, markNotificationRead,
  fetchListedProducts,
  getNotificationSettings, updateNotificationSettings, createNotificationSettings,
  createMamoPaymentLink, payApprovedOrder,
} from '@/lib/api';

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: fetchCategories, staleTime: 60000 });
}

export function useSubCategories(categoryId?: string) {
  return useQuery({
    queryKey: ['sub_categories', categoryId],
    queryFn: () => fetchSubCategories(categoryId),
    enabled: !!categoryId,
    staleTime: 60000,
  });
}

export function useProducts(filters?: Parameters<typeof fetchProducts>[0]) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: () => fetchProducts(filters),
    staleTime: 30000,
  });
}

export function useSearchProducts(query: string, filters?: Parameters<typeof fetchProducts>[0]) {
  return useQuery({
    queryKey: ['products', 'search', query, filters],
    queryFn: () => fetchProducts({ ...filters, q: query }),
    enabled: query.length > 0,
    staleTime: 15000,
  });
}

export function useProductDetail(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProductDetail(id),
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['listed-products'] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['listed-products'] });
    },
  });
}

export function useWishlist() {
  return useQuery({ queryKey: ['wishlist'], queryFn: fetchWishlist });
}

export function useToggleWishlist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, isWishlist }: { productId: string; isWishlist: boolean }) =>
      toggleWishlist(productId, isWishlist),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });
}

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: getProfile });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] }),
  });
}

export function useOrders(type: 'bought' | 'sold' = 'bought') {
  return useQuery({
    queryKey: ['orders', type],
    queryFn: () => fetchOrders(type)
  });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useCreateMamoPaymentLink() {
  return useMutation({ mutationFn: createMamoPaymentLink });
}

export function usePayApprovedOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payApprovedOrder,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useCompletePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: completePayment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useMarkPickupReady() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markPickupReady,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useUpdateOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: 'shipped' | 'delivered' | 'cancelled' }) =>
      updateOrderStatus(orderId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  });
}

export function useSellerDeliveryRequests(status: string = 'pending') {
  return useQuery({
    queryKey: ['seller_delivery_requests', status],
    queryFn: () => fetchSellerDeliveryRequests(status),
  });
}

export function useApproveDeliveryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string, notes?: string }) => approveDeliveryRequest(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['seller_delivery_requests'] });
    },
  });
}

export function useRejectDeliveryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string, notes?: string }) => rejectDeliveryRequest(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['seller_delivery_requests'] });
    },
  });
}

export function useShippingAddresses() {
  return useQuery({
    queryKey: ['shipping_addresses'],
    queryFn: fetchShippingAddresses,
  });
}

export function useUploadImages() {
  return useMutation({
    mutationFn: ({ files, type }: { files: File[], type: 'product' | 'profile' }) =>
      uploadImages(files, type),
  });
}

// ---- CONVERSATIONS ----
export function useConversations() {
  return useQuery({
    queryKey: ['conversations'],
    queryFn: fetchConversations,
  });
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => fetchMessages(conversationId),
    enabled: !!conversationId,
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: sendMessage,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['messages', vars.conversation_id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createConversation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useRespondToOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, response }: { messageId: string; response: 'accepted' | 'rejected' }) =>
      respondToOffer(messageId, response),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  });
}

// ---- NOTIFICATIONS ----
export function useNotifications(limit = 20) {
  return useQuery({
    queryKey: ['notifications', limit],
    queryFn: () => fetchNotifications(limit),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ---- NOTIFICATION SETTINGS ----
export function useNotificationSettings() {
  return useQuery({
    queryKey: ['notification-settings'],
    queryFn: getNotificationSettings,
  });
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-settings'] }),
  });
}

export function useCreateNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createNotificationSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notification-settings'] }),
  });
}

// ---- SELLER LISTED PRODUCTS ----
export function useListedProducts() {
  return useQuery({
    queryKey: ['listed-products'],
    queryFn: fetchListedProducts,
  });
}
