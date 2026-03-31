import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCategories, useSubCategories, useCreateProduct, useUploadImages, useProfile } from '@/hooks/useApi';
import { ArrowLeft, ImagePlus, X, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const CONDITIONS = [
  { value: 'new', label: 'New', desc: 'Never worn / used' },
  { value: 'good', label: 'Good', desc: 'Gently used' },
  { value: 'worn', label: 'Worn', desc: 'Visible signs of use' },
];

const MAX_IMAGES = 8;

export default function SellItemPage() {
  const navigate = useNavigate();
  const { data: categories = [] } = useCategories();
  const { data: profile } = useProfile();
  const [categoryId, setCategoryId] = useState('');
  const { data: subCategories = [] } = useSubCategories(categoryId || undefined);
  const createProductMutation = useCreateProduct();
  const uploadImagesMutation = useUploadImages();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    sub_category_id: '',
    condition: 'new',
    size: '',
    color: '',
    brand: '',
    material: '',
    location: '',
  });

  const [pickupAddress, setPickupAddress] = useState({
    email: '',
    phone_number: '',
    address: '',
    town_city: '',
    postcode: '',
  });

  // Pre-fill pickup address from profile's collection_address
  useEffect(() => {
    if (profile) {
      const src = profile.collection_address;
      if (src) {
        setPickupAddress({
          email: src.email || profile.email || '',
          phone_number: src.phone_number || profile.phone_number || '',
          address: src.address || '',
          town_city: src.town_city || '',
          postcode: src.postcode || '',
        });
      } else {
        setPickupAddress(prev => ({
          ...prev,
          email: profile.email || '',
          phone_number: profile.phone_number || '',
        }));
      }
    }
  }, [profile]);

  // Group sub-categories by group_name
  const groupedSubs = subCategories.reduce((acc, sc) => {
    const group = sc.group_name || '';
    if (!acc[group]) acc[group] = [];
    acc[group].push(sc);
    return acc;
  }, {} as Record<string, typeof subCategories>);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    const remaining = MAX_IMAGES - selectedImages.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} photos allowed`);
      return;
    }
    const toAdd = incoming.slice(0, remaining);
    const oversized = toAdd.filter(f => f.size > 5 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} file(s) exceed 5MB limit`);
    }
    const valid = toAdd.filter(f => f.size <= 5 * 1024 * 1024);
    if (valid.length === 0) return;
    setSelectedImages(prev => [...prev, ...valid]);
    setPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))]);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handlePickupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPickupAddress(p => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) return toast.error('Title is required');
    if (!form.price || parseFloat(form.price) <= 0) return toast.error('Enter a valid price');
    if (!categoryId) return toast.error('Please select a category');
    if (selectedImages.length === 0) return toast.error('Add at least one photo');

    const missingPickup = (['email', 'phone_number', 'address', 'town_city', 'postcode'] as const)
      .filter(k => !pickupAddress[k].trim());
    if (missingPickup.length > 0) {
      return toast.error(`Pickup address: ${missingPickup.join(', ')} required`);
    }

    setIsSubmitting(true);
    try {
      // Step 1 — upload images
      toast.loading('Uploading photos…', { id: 'sell' });
      const imageUrls = await uploadImagesMutation.mutateAsync({
        files: selectedImages,
        type: 'product',
      });

      // Step 2 — create product
      toast.loading('Publishing listing…', { id: 'sell' });
      await createProductMutation.mutateAsync({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        price: parseFloat(form.price),
        images: imageUrls,
        category_id: categoryId,
        sub_category_id: form.sub_category_id || undefined,
        condition: form.condition,
        size: form.size.trim() || undefined,
        color: form.color.trim() || undefined,
        brand: form.brand.trim() || undefined,
        material: form.material.trim() || undefined,
        location: form.location.trim() || undefined,
        pickup_address: pickupAddress,
      });

      toast.success('Item listed! Check your email for confirmation.', { id: 'sell' });
      navigate('/seller-dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Failed to list item', { id: 'sell' });
    } finally {
      setIsSubmitting(false);
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

      <form onSubmit={handleSubmit} id="sell-form" className="px-4 py-5 space-y-7 pb-28">

        {/* ── Photos ── */}
        <section className="space-y-3">
          <SectionLabel>Photos ({selectedImages.length}/{MAX_IMAGES})</SectionLabel>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {previews.map((src, i) => (
              <div key={i} className="relative shrink-0 h-28 w-28 rounded-2xl border border-border overflow-hidden shadow-sm group">
                <img src={src} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 text-[9px] font-bold bg-black/60 text-white px-1.5 py-0.5 rounded-full">Cover</span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute top-1.5 right-1.5 h-5 w-5 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {selectedImages.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 h-28 w-28 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-1.5 text-primary hover:border-primary/60 hover:bg-primary/10 transition"
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-[10px] font-semibold">Add Photo</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
          <p className="text-[10px] text-muted-foreground ml-1">First photo is the cover. Max 5MB per image.</p>
        </section>

        {/* ── Basic Info ── */}
        <section className="space-y-4">
          <SectionLabel>Basic Information</SectionLabel>

          <Field label="Title *">
            <input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g. Vintage Denim Jacket"
              className="auth-input w-full"
            />
          </Field>

          <Field label="Description">
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Describe the item — condition, fit, style, any flaws…"
              rows={3}
              className="auth-input w-full resize-none pt-3"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category *">
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="auth-input w-full bg-card"
              >
                <option value="">Select</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>

            {subCategories.length > 0 && (
              <Field label="Sub-category">
                <select
                  name="sub_category_id"
                  value={form.sub_category_id}
                  onChange={handleChange}
                  className="auth-input w-full bg-card"
                >
                  <option value="">Select</option>
                  {Object.entries(groupedSubs).map(([group, subs]) =>
                    group ? (
                      <optgroup key={group} label={group}>
                        {subs.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
                      </optgroup>
                    ) : (
                      subs.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)
                    )
                  )}
                </select>
              </Field>
            )}
          </div>
        </section>

        {/* ── Pricing & Condition ── */}
        <section className="space-y-4">
          <SectionLabel>Pricing & Condition</SectionLabel>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (AED) *">
              <div className="relative">
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="0.00"
                  className="auth-input w-full pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">AED</span>
              </div>
            </Field>

            <Field label="Condition *">
              <select name="condition" value={form.condition} onChange={handleChange} className="auth-input w-full bg-card">
                {CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label} — {c.desc}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        {/* ── Product Specifics ── */}
        <section className="space-y-4">
          <SectionLabel>Product Specifics</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: 'size', label: 'Size', placeholder: 'M, 10, 42…' },
              { name: 'color', label: 'Color', placeholder: 'Navy, Red…' },
              { name: 'brand', label: 'Brand', placeholder: 'Brand name' },
              { name: 'material', label: 'Material', placeholder: 'Cotton, Leather…' },
            ].map(({ name, label, placeholder }) => (
              <Field key={name} label={label}>
                <input
                  name={name}
                  value={(form as any)[name]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  className="auth-input w-full"
                />
              </Field>
            ))}
          </div>

          <Field label="City / Area">
            <input
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="e.g. Dubai Marina"
              className="auth-input w-full"
            />
          </Field>
        </section>

        {/* ── Pickup Address ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <SectionLabel>Pickup Address *</SectionLabel>
          </div>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Where the courier will collect the item from you after a sale.</p>
          </div>

          <Field label="Email *">
            <input
              name="email"
              type="email"
              value={pickupAddress.email}
              onChange={handlePickupChange}
              placeholder="your@email.com"
              className="auth-input w-full"
            />
          </Field>

          <Field label="Phone Number *">
            <input
              name="phone_number"
              type="tel"
              value={pickupAddress.phone_number}
              onChange={handlePickupChange}
              placeholder="+971 50 000 0000"
              className="auth-input w-full"
            />
          </Field>

          <Field label="Street Address *">
            <input
              name="address"
              value={pickupAddress.address}
              onChange={handlePickupChange}
              placeholder="Building, Street, Area"
              className="auth-input w-full"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Town / City *">
              <input
                name="town_city"
                value={pickupAddress.town_city}
                onChange={handlePickupChange}
                placeholder="Dubai"
                className="auth-input w-full"
              />
            </Field>
            <Field label="Postcode *">
              <input
                name="postcode"
                value={pickupAddress.postcode}
                onChange={handlePickupChange}
                placeholder="00000"
                className="auth-input w-full"
              />
            </Field>
          </div>
        </section>
      </form>

      {/* Fixed submit bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur border-t border-border px-4 py-4">
        <button
          type="submit"
          form="sell-form"
          disabled={isSubmitting}
          className="auth-btn w-full flex items-center justify-center gap-2 shadow-lg shadow-primary/20 active:scale-[0.98] transition disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {isSubmitting ? 'Publishing…' : 'List Item Now'}
        </button>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-l-2 border-primary pl-2">
      {children}
    </p>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-muted-foreground ml-1">{label}</label>
      {children}
    </div>
  );
}
