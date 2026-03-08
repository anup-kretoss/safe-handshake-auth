import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCategories, useSubCategories, useCreateProduct } from '@/hooks/useApi';
import { ArrowLeft, ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SellItemPage() {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const [categoryId, setCategoryId] = useState('');
  const { data: subCategories = [] } = useSubCategories(categoryId || undefined);
  const createProduct = useCreateProduct();

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category_id: '',
    sub_category_id: '',
    condition: 'new',
    size: '',
    color: '',
    brand: '',
    location: '',
    images: [] as string[],
  });

  useEffect(() => {
    setForm(f => ({ ...f, category_id: categoryId, sub_category_id: '' }));
  }, [categoryId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.price || !form.category_id) {
      toast.error('Title, price, and category are required');
      return;
    }
    try {
      await createProduct.mutateAsync({
        ...form,
        price: parseFloat(form.price),
        sub_category_id: form.sub_category_id || undefined,
      });
      toast.success('Item listed successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to list item');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link to="/dashboard">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </Link>
        <h1 className="text-base font-semibold text-foreground">Sell an Item</h1>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-4 pb-24">
        {/* Image upload placeholder */}
        <div className="flex gap-3 overflow-x-auto pb-2">
          <button type="button" className="shrink-0 h-24 w-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/40 transition">
            <ImagePlus className="h-6 w-6" />
            <span className="text-[10px]">Add Photo</span>
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
          <input name="title" value={form.title} onChange={handleChange} placeholder="What are you selling?" className="auth-input w-full" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Describe your item..." rows={3} className="auth-input w-full resize-none pt-3" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Price *</label>
            <input name="price" type="number" value={form.price} onChange={handleChange} placeholder="0.00" className="auth-input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Condition</label>
            <select name="condition" value={form.condition} onChange={handleChange} className="auth-input w-full bg-card">
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Category *</label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="auth-input w-full bg-card"
          >
            <option value="">Select Category</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {subCategories.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sub Category</label>
            <select name="sub_category_id" value={form.sub_category_id} onChange={handleChange} className="auth-input w-full bg-card">
              <option value="">Select Sub Category</option>
              {subCategories.map(sc => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Size</label>
            <input name="size" value={form.size} onChange={handleChange} placeholder="M, L, XL..." className="auth-input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Color</label>
            <input name="color" value={form.color} onChange={handleChange} placeholder="Blue, Red..." className="auth-input w-full" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Brand</label>
            <input name="brand" value={form.brand} onChange={handleChange} placeholder="Nike, Zara..." className="auth-input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
            <input name="location" value={form.location} onChange={handleChange} placeholder="City..." className="auth-input w-full" />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3">
          <button type="submit" disabled={createProduct.isPending} className="auth-btn flex items-center justify-center gap-2">
            {createProduct.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {createProduct.isPending ? 'Listing...' : 'List Item'}
          </button>
        </div>
      </form>
    </div>
  );
}
