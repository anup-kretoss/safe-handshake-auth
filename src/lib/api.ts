import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = "https://ciywuwcwixbvmsezppya.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k";

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'apikey': SUPABASE_ANON_KEY,
    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
  };
}

// ---- PRODUCTS ----
export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  category_id: string;
  sub_category_id: string | null;
  seller_id: string;
  condition: string;
  size: string;
  color: string;
  brand: string;
  material: string;
  location: string;
  is_sold: boolean;
  isWishlist: boolean;
  created_at: string;
  updated_at: string;
  categories?: { name: string };
  sub_categories?: { name: string; group_name?: string };
  seller_name?: string;
  actual_price?: number;
  display_price?: number;
  service_fee_percentage?: number;
}

export interface Address {
  email: string;
  phone_number: string;
  address: string;
  town_city: string;
  postcode: string;
}

export interface Order {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  delivery_type: 'standard' | '24hour';
  delivery_price: number;
  shipping_address: Address;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface SubCategory {
  id: string;
  name: string;
  category_id: string;
  group_name: string;
  created_at: string;
}

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/products?action=categories`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function fetchSubCategories(categoryId?: string): Promise<SubCategory[]> {
  const params = new URLSearchParams({ action: 'sub_categories' });
  if (categoryId) params.set('category_id', categoryId);
  const res = await fetch(`${SUPABASE_URL}/functions/v1/products?${params}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function fetchProducts(filters?: {
  category_id?: string;
  sub_category_id?: string;
  q?: string;
  min_price?: string;
  max_price?: string;
  condition?: string;
  size?: string;
  brand?: string;
  seller_id?: string;
  limit?: number;
  offset?: number;
}): Promise<Product[]> {
  const params = new URLSearchParams({ action: 'list' });
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
  }
  const res = await fetch(`${SUPABASE_URL}/functions/v1/products?${params}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function searchProducts(query: string): Promise<Product[]> {
  const params = new URLSearchParams({ action: 'search', q: query });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/products?${params}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function fetchProductDetail(id: string): Promise<Product> {
  const params = new URLSearchParams({ action: 'detail', id });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/products?${params}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function createProduct(product: {
  title: string;
  description?: string;
  price: number;
  images?: string[];
  category_id: string;
  sub_category_id?: string;
  condition: string;
  size?: string;
  color?: string;
  brand?: string;
  material?: string;
  location?: string;
  pickup_address: Address;
}): Promise<Product> {
  const headers = await getAuthHeaders();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/products?action=create`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(product),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function deleteProduct(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/products?action=delete`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
}

// ---- WISHLIST ----
export interface WishlistItem {
  id: string;
  product_id: string;
  created_at: string;
  products: Pick<Product, 'id' | 'title' | 'price' | 'images' | 'condition'>;
}

export async function fetchWishlist(): Promise<WishlistItem[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wishlist`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function toggleWishlist(productId: string, isWishlist: boolean) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wishlist`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId, isWishlist }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- PROFILE ----
export interface ProfileData {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string | null;
  phone_number: string | null;
  country_code: string | null;
  gender: string | null;
  username: string | null;
  user_description: string | null;
  full_name: string | null;
  profile_image: string | null;
  profile_image_url: string | null;
  collection_address: Address | null;
  delivery_address: Address | null;
  notification_settings: NotificationSettings | null;
  fcm_token: string | null;
  role?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationSettings {
  general_notifications: boolean;
  email_notifications: boolean;
  message_notifications: boolean;
  payment_notifications: boolean;
  update_notifications: boolean;
}

export async function getProfile(): Promise<ProfileData> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/update-profile`, {
    method: 'GET',
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function updateProfile(data: {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  country_code?: string;
  phone_number?: string;
  gender?: string;
  username?: string;
  user_description?: string;
  full_name?: string;
  collection_address?: Address;
  delivery_address?: Address;
  fcm_token?: string;
  profile_image?: string;
} | FormData): Promise<ProfileData> {
  const headers = await getAuthHeaders();
  const isFormData = data instanceof FormData;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/update-profile`, {
    method: 'POST',
    headers: isFormData ? headers : { ...headers, 'Content-Type': 'application/json' },
    body: isFormData ? data : JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- AUTHENTICATION ----
export async function signUp(data: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  country_code: string;
  phone_number: string;
  collection_address: Address;
  delivery_address: Address;
}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json;
}

// ---- ADDRESSES ----
export async function getAddresses() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/addresses?action=get`, {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function updateAddress(type: 'pickup' | 'delivery', address: Address) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/addresses?action=update`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    },
    body: JSON.stringify({ type, ...address }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function deleteAddress(type: 'pickup' | 'delivery') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/addresses?action=delete`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    },
    body: JSON.stringify({ type }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- NOTIFICATION SETTINGS ----
export async function getNotificationSettings(): Promise<NotificationSettings> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notification-settings`, {
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function updateNotificationSettings(settings: NotificationSettings): Promise<NotificationSettings> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notification-settings`, {
    method: 'PUT',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    },
    body: JSON.stringify(settings),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function createNotificationSettings(settings: NotificationSettings): Promise<NotificationSettings> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notification-settings`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    },
    body: JSON.stringify(settings),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- LOCATIONS ----
export async function getLocations(country = 'UAE', active = true) {
  const params = new URLSearchParams({ country, active: String(active) });
  const res = await fetch(`${SUPABASE_URL}/functions/v1/locations?${params}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- CHANGE PASSWORD ----
export async function changePassword(oldPassword: string, newPassword: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/change-password`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpeXd1d2N3aXhidm1zZXpwcHlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMDAyOTcsImV4cCI6MjA4NzY3NjI5N30.1b-Y6kVbMA-AjpLLmyl-khzMVZx2H3ktSkgla3eK49k'
    },
    body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- IMAGE UPLOAD ----
export async function uploadImages(files: File[], type: 'product' | 'profile'): Promise<string[]> {
  const headers = await getAuthHeaders();
  const formData = new FormData();
  files.forEach(file => formData.append('images', file));
  formData.append('type', type);

  const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-images`, {
    method: 'POST',
    headers: headers,
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data.urls;
}

// ---- MAMO PAYMENT ----
export async function createMamoPaymentLink(data: { order_id: string }) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/mamo-payment?action=create-link`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function verifyMamoPayment(data: {
  order_id: string;
  transaction_id?: string;
  payment_link_id?: string;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/mamo-payment?action=verify`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function payApprovedOrder(orderId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/mamo-payment?action=create-link`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- ORDERS ----
export async function createOrder(data: {
  product_id: string;
  delivery_type: 'standard' | '24hour';
  shipping_address: Address;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/orders?action=create`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function fetchOrders(type: 'bought' | 'sold' = 'bought'): Promise<any[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/orders?action=list&type=${type}&_t=${Date.now()}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function completePayment(orderId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/orders?action=complete-payment`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function fetchOrderDetails(id: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/orders?action=detail&id=${id}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- DELIVERY REQUESTS (SELLER) ----
export async function fetchSellerDeliveryRequests(status: string = 'pending') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/seller-delivery-requests?action=list&status=${status}&_t=${Date.now()}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function approveDeliveryRequest(id: string, notes?: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/seller-delivery-requests?action=approve`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ delivery_request_id: id, seller_notes: notes }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function rejectDeliveryRequest(id: string, notes?: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/seller-delivery-requests?action=reject`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ delivery_request_id: id, seller_notes: notes }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function fetchShippingAddresses(): Promise<{ id: string; shipping_address: Address }[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/orders?action=shipping-addresses`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function markPickupReady(orderId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/orders?action=mark-pickup-ready`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- CONVERSATIONS ----
export async function fetchConversations() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/conversations?action=inbox`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function fetchMessages(conversationId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/conversations?action=messages&conversation_id=${conversationId}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function sendMessage(data: { conversation_id: string; content: string; message_type?: string; offer_amount?: number }) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/conversations?action=send`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function createConversation(data: { product_id: string; seller_id: string; type?: string }) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/conversations?action=create`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function respondToOffer(messageId: string, response: 'accepted' | 'rejected') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/conversations?action=respond-offer`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: messageId, response }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- NOTIFICATIONS ----
export async function fetchNotifications(limit = 20, offset = 0) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notifications?limit=${limit}&offset=${offset}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function markNotificationRead(notificationId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/notifications`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification_id: notificationId, is_read: true }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

// ---- SELLER PRODUCTS (listed) ----
export async function fetchListedProducts() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/products?action=listed`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function updateOrderStatus(orderId: string, status: 'shipped' | 'delivered' | 'cancelled') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/orders?action=update-status`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, status }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function updateProduct(data: { id: string; title?: string; price?: number; description?: string;[key: string]: any }) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/products?action=update`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', ...data }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}