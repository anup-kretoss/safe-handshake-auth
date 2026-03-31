import { Link } from 'react-router-dom';
import type { Product } from '@/lib/api';
import { Heart } from 'lucide-react';

interface Props {
  product: Product;
}

export default function ProductCard({ product }: Props) {
  return (
    <Link to={`/product/${product.id}`} className="group block">
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-secondary">
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No image
          </div>
        )}
        <button
          onClick={e => e.preventDefault()}
          className="absolute top-2 right-2 h-8 w-8 rounded-full bg-card/70 backdrop-blur flex items-center justify-center"
        >
          <Heart className="h-4 w-4 text-foreground" />
        </button>
        {product.condition && product.condition !== 'new' && (
          <span className="absolute bottom-2 left-2 text-[10px] px-2 py-0.5 rounded-full bg-card/70 backdrop-blur text-foreground capitalize">
            {product.condition}
          </span>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-sm font-medium text-foreground truncate">{product.title}</p>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-sm font-bold text-primary">AED {product.price}</p>
          {product.categories?.name && (
            <p className="text-[10px] text-muted-foreground">{product.categories.name}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
