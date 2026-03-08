import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCategories, useProducts } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import ProductCard from '@/components/ProductCard';
import BottomNav from '@/components/BottomNav';
import { Search, Bell } from 'lucide-react';

export default function HomePage() {
  const { profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const { data: categories = [] } = useCategories();
  const { data: products = [], isLoading } = useProducts(
    selectedCategory ? { category_id: selectedCategory } : undefined
  );

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

      <main className="px-4 py-4 space-y-6">
        {/* Categories */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Categories</h2>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory(undefined)}
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
                onClick={() => setSelectedCategory(cat.id)}
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
