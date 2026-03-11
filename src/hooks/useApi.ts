import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchCategories, fetchSubCategories, fetchProducts, searchProducts,
  fetchProductDetail, createProduct, deleteProduct,
  fetchWishlist, toggleWishlist,
  getProfile, updateProfile,
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

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
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
