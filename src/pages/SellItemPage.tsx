import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCategories, useSubCategories, useCreateProduct } from '@/hooks/useApi';
import { ArrowLeft, ImagePlus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'worn', label: 'Worn' },
];

export default function SellItemPage() {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const [categoryId, setCategoryId] = useState('');
  const { data: subCategories = [] } = useSubCategories(categoryId || undefined);
  const createProduct = useCreateProduct();

  // Group sub-categories by group_name
  const groupedSubs = subCategories.reduce((acc, sc) => {
    const group = sc.group_name || '';
    if (!acc[group]) acc[group] = [];
    acc[group].push(sc);
    return acc;
  }, {} as Record<string, typeof subCategories>);

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
    material: '',
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

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title *</label>
          <input name="title" value={form.title} onChange={handleChange} placeholder="What are you selling?" className="auth-input w-full" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea name="description" value={form.description} onChange={handleChange} placeholder="Describe your item..." rows={3} className="auth-input w-full resize-none pt-3" />
        </div>

        {/* Category */}
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

        {/* Sub Category (grouped) */}
        {subCategories.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Sub Category</label>
            <select name="sub_category_id" value={form.sub_category_id} onChange={handleChange} className="auth-input w-full bg-card">
              <option value="">Select Sub Category</option>
              {Object.entries(groupedSubs).map(([group, subs]) => (
                group ? (
                  <optgroup key={group} label={group}>
                    {subs.map(sc => (
                      <option key={sc.id} value={sc.id}>{sc.name}</option>
                    ))}
                  </optgroup>
                ) : (
                  subs.map(sc => (
                    <option key={sc.id} value={sc.id}>{sc.name}</option>
                  ))
                )
              ))}
            </select>
          </div>
        )}

        {/* Price & Condition */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Price *</label>
            <input name="price" type="number" value={form.price} onChange={handleChange} placeholder="0.00" className="auth-input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Condition</label>
            <select name="condition" value={form.condition} onChange={handleChange} className="auth-input w-full bg-card">
              {CONDITIONS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Size & Color */}
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

        {/* Brand & Material */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Brand</label>
            <input name="brand" value={form.brand} onChange={handleChange} placeholder="Nike, Zara..." className="auth-input w-full" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Material</label>
            <input name="material" value={form.material} onChange={handleChange} placeholder="Cotton, Silk..." className="auth-input w-full" />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
          <input name="location" value={form.location} onChange={handleChange} placeholder="City..." className="auth-input w-full" />
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
