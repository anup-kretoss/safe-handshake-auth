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

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
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
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedImages(prev => [...prev, ...files]);

      const newPreviews = files.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

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

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      formData.append(k, v);
    });
    selectedImages.forEach((img) => {
      formData.append('images', img);
    });

    try {
      await createProduct.mutateAsync(formData);
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

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-6 pb-24">
        {/* Section: Images */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">Photos</label>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {previews.map((preview, index) => (
              <div key={index} className="shrink-0 relative h-28 w-28 rounded-2xl border border-border overflow-hidden shadow-sm group">
                <img src={preview} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1.5 right-1.5 h-6 w-6 bg-black/60 text-white rounded-full flex items-center justify-center text-[10px] backdrop-blur-sm hover:bg-black/80 transition"
                >
                  ✕
                </button>
              </div>
            ))}
            <label className="shrink-0 h-28 w-28 rounded-2xl border-2 border-dashed border-primary/20 bg-primary/5 flex flex-col items-center justify-center gap-1.5 text-primary hover:border-primary/40 hover:bg-primary/10 transition cursor-pointer">
              <ImagePlus className="h-6 w-6" />
              <span className="text-[10px] font-semibold">Add Photo</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageChange} />
            </label>
          </div>
        </div>

        {/* Section: Basic Info */}
        <div className="space-y-4 pt-2">
          <h3 className="block text-xs font-bold uppercase tracking-wider text-muted-foreground border-l-2 border-primary pl-2">Basic Information</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Title *</label>
              <input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Vintage Denim Jacket" className="auth-input w-full" />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} placeholder="Tell buyers about the condition, fit, and style..." rows={4} className="auth-input w-full resize-none pt-3" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Category *</label>
                <select
                  value={categoryId}
                  onChange={e => setCategoryId(e.target.value)}
                  className="auth-input w-full bg-card appearance-none"
                >
                  <option value="">Select</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {subCategories.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Sub Category</label>
                  <select name="sub_category_id" value={form.sub_category_id} onChange={handleChange} className="auth-input w-full bg-card appearance-none">
                    <option value="">Select</option>
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
            </div>
          </div>
        </div>

        {/* Section: Details */}
        <div className="space-y-4 pt-2">
          <h3 className="block text-xs font-bold uppercase tracking-wider text-muted-foreground border-l-2 border-primary pl-2">Pricing & Condition</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Price (AED) *</label>
              <div className="relative">
                <input name="price" type="number" value={form.price} onChange={handleChange} placeholder="0.00" className="auth-input w-full pr-10" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">AED</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Condition</label>
              <select name="condition" value={form.condition} onChange={handleChange} className="auth-input w-full bg-card appearance-none">
                {CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section: Specifics */}
        <div className="space-y-4 pt-2">
          <h3 className="block text-xs font-bold uppercase tracking-wider text-muted-foreground border-l-2 border-primary pl-2">Product Specifics</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Size</label>
              <input name="size" value={form.size} onChange={handleChange} placeholder="M, 10, 42..." className="auth-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Color</label>
              <input name="color" value={form.color} onChange={handleChange} placeholder="Navy, Red..." className="auth-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Brand</label>
              <input name="brand" value={form.brand} onChange={handleChange} placeholder="Brand name" className="auth-input w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">Material</label>
              <input name="material" value={form.material} onChange={handleChange} placeholder="Cotton, Leather..." className="auth-input w-full" />
            </div>
          </div>
        </div>

        {/* Section: Location */}
        <div className="space-y-4 pt-2">
          <h3 className="block text-xs font-bold uppercase tracking-wider text-muted-foreground border-l-2 border-primary pl-2">Location</h3>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5 ml-1">City / Area</label>
            <input name="location" value={form.location} onChange={handleChange} placeholder="e.g. Dubai Marina" className="auth-input w-full" />
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-4 backdrop-blur-lg bg-card/90">
          <button type="submit" disabled={createProduct.isPending} className="auth-btn w-full flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]">
            {createProduct.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
            {createProduct.isPending ? 'Publishing...' : 'List Item Now'}
          </button>
        </div>
      </form>
    </div>
  );
}
