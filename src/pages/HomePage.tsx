import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories, useSubCategories, useProducts } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import ProductCard from '@/components/ProductCard';
import BottomNav from '@/components/BottomNav';
import { Search, Bell, SlidersHorizontal, X } from 'lucide-react';

const CONDITIONS = ['new', 'good', 'worn'];

export default function HomePage() {
  const { profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | undefined>();
  const [showFilters, setShowFilters] = useState(false);
  const [filterCondition, setFilterCondition] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');

  const { data: categories = [] } = useCategories();
  const { data: subCategories = [] } = useSubCategories(selectedCategory);

  // Group sub-categories by group_name
  const groupedSubs = subCategories.reduce((acc, sc) => {
    const group = sc.group_name || '';
    if (!acc[group]) acc[group] = [];
    acc[group].push(sc);
    return acc;
  }, {} as Record<string, typeof subCategories>);

  const filters: Record<string, string | number | undefined> = {};
  if (selectedCategory) filters.category_id = selectedCategory;
  if (selectedSubCategory) filters.sub_category_id = selectedSubCategory;
  if (filterCondition) filters.condition = filterCondition;
  if (filterSize) filters.size = filterSize;
  if (filterBrand) filters.brand = filterBrand;
  if (filterMinPrice) filters.min_price = filterMinPrice;
  if (filterMaxPrice) filters.max_price = filterMaxPrice;

  const { data: products = [], isLoading } = useProducts(
    Object.keys(filters).length > 0 ? filters : undefined
  );

  const clearFilters = () => {
    setFilterCondition('');
    setFilterSize('');
    setFilterBrand('');
    setFilterMinPrice('');
    setFilterMaxPrice('');
  };

  const hasActiveFilters = filterCondition || filterSize || filterBrand || filterMinPrice || filterMaxPrice;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Welcome back,</p>
            <h1 className="text-lg font-bold text-foreground">{profile?.first_name || 'User'} 👋</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/search" className="h-10 w-10 flex items-center justify-center rounded-full bg-secondary">
              <Search className="h-5 w-5 text-foreground" />
            </Link>
            <button className="h-10 w-10 flex items-center justify-center rounded-full bg-secondary relative">
              <Bell className="h-5 w-5 text-foreground" />
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-destructive" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Categories: All, Man, Women, Kids */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Categories</h2>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`h-9 w-9 flex items-center justify-center rounded-full transition ${
                hasActiveFilters ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => { setSelectedCategory(undefined); setSelectedSubCategory(undefined); }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                !selectedCategory
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-foreground'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setSelectedCategory(cat.id); setSelectedSubCategory(undefined); }}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-foreground'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-categories grouped */}
        {selectedCategory && subCategories.length > 0 && (
          <div className="space-y-3">
            {Object.entries(groupedSubs).map(([group, subs]) => (
              <div key={group}>
                {group && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group}</p>
                )}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {subs.map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => setSelectedSubCategory(selectedSubCategory === sc.id ? undefined : sc.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                        selectedSubCategory === sc.id
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-secondary text-foreground'
                      }`}
                    >
                      {sc.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-card rounded-xl border border-border p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Filters</h3>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-primary font-medium flex items-center gap-1">
                  <X className="h-3 w-3" /> Clear
                </button>
              )}
            </div>

            {/* Condition */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Condition</label>
              <div className="flex gap-2">
                {CONDITIONS.map(c => (
                  <button
                    key={c}
                    onClick={() => setFilterCondition(filterCondition === c ? '' : c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${
                      filterCondition === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Min Price</label>
                <input
                  type="number"
                  value={filterMinPrice}
                  onChange={e => setFilterMinPrice(e.target.value)}
                  placeholder="0"
                  className="auth-input w-full h-9 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Max Price</label>
                <input
                  type="number"
                  value={filterMaxPrice}
                  onChange={e => setFilterMaxPrice(e.target.value)}
                  placeholder="999"
                  className="auth-input w-full h-9 text-xs"
                />
              </div>
            </div>

            {/* Size */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Size</label>
              <input
                value={filterSize}
                onChange={e => setFilterSize(e.target.value)}
                placeholder="S, M, L, XL..."
                className="auth-input w-full h-9 text-xs"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Brand</label>
              <input
                value={filterBrand}
                onChange={e => setFilterBrand(e.target.value)}
                placeholder="Nike, Zara..."
                className="auth-input w-full h-9 text-xs"
              />
            </div>
          </div>
        )}

        {/* Products Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">
              {selectedCategory
                ? categories.find(c => c.id === selectedCategory)?.name || 'Products'
                : 'All Products'}
            </h2>
            <span className="text-xs text-muted-foreground">{products.length} items</span>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-xl bg-secondary animate-pulse h-56" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground text-sm">
              No products found
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
