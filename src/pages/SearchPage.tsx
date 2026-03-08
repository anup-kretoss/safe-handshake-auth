import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSearchProducts } from '@/hooks/useApi';
import ProductCard from '@/components/ProductCard';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      if (query) setSearchParams({ q: query });
      else setSearchParams({});
    }, 400);
    return () => clearTimeout(timer);
  }, [query, setSearchParams]);

  const { data: products = [], isLoading } = useSearchProducts(debouncedQuery);

  return (
    <div className="min-h-screen bg-background">
      {/* Search Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="shrink-0">
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Link>
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products..."
              autoFocus
              className="w-full h-10 rounded-lg bg-secondary pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/30"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {!debouncedQuery ? (
          <div className="py-20 text-center text-muted-foreground text-sm">
            Start typing to search products
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-xl bg-secondary animate-pulse h-56" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground text-sm">
            No results for "{debouncedQuery}"
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">{products.length} results</p>
            <div className="grid grid-cols-2 gap-3">
              {products.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
