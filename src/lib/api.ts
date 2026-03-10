import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = "https://ciywuwcwixbvmsezppya.supabase.co";

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
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
  created_at: string;
  updated_at: string;
  categories?: { name: string };
  sub_categories?: { name: string; group_name?: string };
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
  condition?: string;
  size?: string;
  color?: string;
  brand?: string;
  material?: string;
  location?: string;
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
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wishlist?action=list`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function addToWishlist(productId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wishlist?action=add`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function removeFromWishlist(productId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wishlist?action=remove`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ product_id: productId }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
}

export async function checkWishlist(productId: string): Promise<boolean> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wishlist?action=check&product_id=${productId}`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.in_wishlist;
}

// ---- PROFILE ----
export async function getProfile() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-profile`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}

export async function updateProfile(data: {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  countryCode?: string;
  phoneNumber?: string;
  gender?: string;
  fcmToken?: string;
}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/update-profile`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.message);
  return json.data;
}
