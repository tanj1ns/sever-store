import React, { useEffect, useState } from 'react';
import { Check, ShoppingBag, ShieldCheck, X } from 'lucide-react';
import { STORE_CATEGORIES, formatRub, resolveAssetUrl } from '../api';

export default function ProductModal({ product, onClose, onAddToCart }) {
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || 'One Size');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    setSelectedSize(product.sizes?.[0] || 'One Size');
    setAdded(false);
  }, [product]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const catLabel = STORE_CATEGORIES.find((c) => c.id === product.category)?.label || product.category;

  function handleAdd() {
    onAddToCart(product, selectedSize);
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box modal-box--wide" role="dialog" aria-modal="true" aria-label={product.title}>
        <div className="modal-head">
          <span className="eyebrow" style={{ marginBottom: 0 }}>{catLabel}</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            <X size={16} />
          </button>
        </div>

        <div className="product-modal-grid">
          <div className="product-modal-media">
            <img src={resolveAssetUrl(product.image)} alt={product.title} draggable={false} />
          </div>

          <div className="product-modal-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2>{product.title}</h2>
              {product.badge && <span className="badge-pill">{product.badge}</span>}
            </div>

            <div className="price-row" style={{ margin: '10px 0 14px' }}>
              <strong className="mono price-main">{formatRub(product.price)}</strong>
              {product.oldPrice > 0 && (
                <span className="mono price-old">{formatRub(product.oldPrice)}</span>
              )}
              <span className="stock-tag">
                {product.stock > 0 ? `В наличии: ${product.stock} шт.` : 'Нет в наличии'}
              </span>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              {product.description}
            </p>

            <div className="specs-box">
              <strong>Материалы и технологии</strong>
              <p>{product.specs}</p>
            </div>

            <div className="field" style={{ marginTop: 14 }}>
              <label>Выберите размер</label>
              <div className="size-row">
                {(product.sizes || ['One Size']).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`size-btn mono ${selectedSize === size ? 'is-active' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn--primary"
                disabled={product.stock <= 0}
                onClick={handleAdd}
              >
                {added ? <Check size={16} /> : <ShoppingBag size={16} />}
                {added ? 'Добавлено в корзину' : 'Добавить в корзину'}
              </button>
              <span className="hint-inline">
                <ShieldCheck size={14} /> Бесплатная доставка от 7 000 ₽
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
