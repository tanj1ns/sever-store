import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Compass,
  Menu,
  Minus,
  Moon,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Tag,
  Trash2,
  Truck,
  X
} from 'lucide-react';
import {
  DELIVERY_METHODS,
  ORDER_STATUS,
  SIZE_FILTERS,
  STORE_CATEGORIES,
  calculateTotals,
  formatPhone,
  formatRub,
  getSavedOrderCodes,
  isSecretAdminHash,
  loadSavedCart,
  resolveAssetUrl,
  saveCart,
  storeApi
} from './api';
import ProductModal from './components/ProductModal';
import PrivacyModal from './components/PrivacyModal';
import AdminStore from './pages/AdminStore';

export default function App() {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const [isAdminRoute, setIsAdminRoute] = useState(false);

  const [activeCategory, setActiveCategory] = useState('all');
  const [activeSize, setActiveSize] = useState('all');
  const [sortBy, setSortBy] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');

  const [activeProduct, setActiveProduct] = useState(null);
  const [cart, setCart] = useState(() => loadSavedCart());
  const [cartOpen, setCartOpen] = useState(false);

  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('cdek');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [city, setCity] = useState('Москва');
  const [address, setAddress] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [consent, setConsent] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [orderBusy, setOrderBusy] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [createdOrder, setCreatedOrder] = useState(null);

  const [trackCode, setTrackCode] = useState('SVR-2041');
  const [trackedOrder, setTrackedOrder] = useState(null);
  const [trackError, setTrackError] = useState('');
  const [savedCodes, setSavedCodes] = useState(() => getSavedOrderCodes());

  const formOpenAt = useRef(Date.now());

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('sever_theme', next);
    } catch {}
  }

  async function refreshCatalog() {
    try {
      const res = await storeApi.bootstrap();
      setProducts(res.products || []);
      setUser(res.user || null);
    } catch {}
  }

  useEffect(() => {
    refreshCatalog();

    async function syncHash() {
      const adminOk = await isSecretAdminHash(window.location.hash);
      setIsAdminRoute(adminOk);
    }
    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  useEffect(() => {
    if (cartOpen) formOpenAt.current = Date.now();
  }, [cartOpen]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = products.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (activeSize !== 'all' && !(p.sizes || []).includes(activeSize)) return false;
      if (q && !`${p.title} ${p.specs} ${p.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sortBy === 'price_asc') list = [...list].sort((a, b) => a.price - b.price);
    else if (sortBy === 'price_desc') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [products, activeCategory, activeSize, sortBy, searchQuery]);

  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const totals = useMemo(() => calculateTotals(cart, appliedPromo, deliveryMethod), [cart, appliedPromo, deliveryMethod]);

  function addToCart(product, size) {
    const chosenSize = size || product.sizes?.[0] || 'One Size';
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.productId === product.id && i.size === chosenSize);
      if (idx >= 0) {
        return prev.map((item, k) =>
          k === idx ? { ...item, qty: Math.min(product.stock || 20, item.qty + 1) } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          title: product.title,
          price: product.price,
          image: product.image,
          size: chosenSize,
          qty: 1
        }
      ];
    });
  }

  function updateQty(productId, size, delta) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId && item.size === size
            ? { ...item, qty: item.qty + delta }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  function applyPromoCode() {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      setAppliedPromo('');
      return;
    }
    if (code === 'SEVER10') {
      setAppliedPromo('SEVER10');
      setOrderError('');
    } else {
      setOrderError('Промокод не найден. Попробуйте SEVER10 (-10%).');
    }
  }

  async function handleCheckout(e) {
    e.preventDefault();
    setOrderError('');

    if (Date.now() - formOpenAt.current < 1200) {
      setOrderError('Слишком быстрая отправка формы. Проверьте поля и повторите попытку.');
      return;
    }

    setOrderBusy(true);
    try {
      const res = await storeApi.createOrder({
        items: cart.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty })),
        promoCode: appliedPromo,
        deliveryMethod,
        city,
        address,
        clientName,
        clientPhone,
        consent,
        website: honeypot
      });
      setCreatedOrder(res.order);
      setCart([]);
      setTrackCode(res.order.code);
      setTrackedOrder(res.order);
      setSavedCodes(getSavedOrderCodes());
      await refreshCatalog();
    } catch (err) {
      setOrderError(err.message);
    } finally {
      setOrderBusy(false);
    }
  }

  async function handleTrack(e, manualCode) {
    if (e) e.preventDefault();
    setTrackError('');
    const targetCode = (manualCode || trackCode).trim().toUpperCase();
    try {
      const res = await storeApi.trackOrder(targetCode);
      setTrackedOrder(res.order);
      setTrackCode(targetCode);
    } catch (err) {
      setTrackedOrder(null);
      setTrackError(err.message);
    }
  }

  function scrollToId(id) {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="app-shell">
      <header className="header">
        <div className="container header__inner">
          <a
            href="#catalog"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              if (isAdminRoute) {
                window.location.hash = '';
                setIsAdminRoute(false);
              } else {
                scrollToId('catalog');
              }
            }}
          >
            <span className="brand__icon">
              <Compass size={17} />
            </span>
            <span>СЕВЕР</span>
          </a>

          {!isAdminRoute && (
            <nav className={`nav ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Навигация">
              <button type="button" className="nav__link" onClick={() => scrollToId('catalog')}>
                Каталог
              </button>
              <button type="button" className="nav__link" onClick={() => scrollToId('tracker')}>
                Отследить заказ
              </button>
              <button type="button" className="nav__link" onClick={() => scrollToId('delivery')}>
                Доставка и гарантия
              </button>
            </nav>
          )}

          <div className="header__right">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setCartOpen(true)}
              aria-label="Открыть корзину"
            >
              <ShoppingBag size={15} />
              <span>Корзина</span>
              {cartCount > 0 && <span className="cart-badge mono">{cartCount}</span>}
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Переключить тему"
            >
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {!isAdminRoute && (
              <button
                type="button"
                className="icon-btn mobile-menu-btn"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Меню"
              >
                {mobileMenuOpen ? <X size={17} /> : <Menu size={17} />}
              </button>
            )}
          </div>
        </div>
      </header>

      {isAdminRoute ? (
        <AdminStore
          user={user}
          products={products}
          onUserChange={setUser}
          onRefreshCatalog={refreshCatalog}
          onExit={() => {
            window.location.hash = '';
            setIsAdminRoute(false);
          }}
        />
      ) : (
        <main>
          <section className="hero">
            <div className="container hero-grid">
              <div>
                <span className="eyebrow">Дроп 04 • Осень — Зима</span>
                <h1 className="hero__title">Технологичная одежда для северного города</h1>
                <p className="hero__bio">
                  Мембранные ветровки, тяжёлый органический футер 460 г/м² и городские рюкзаки из Cordura 1000D.
                  Отправляем заказы в день оформления.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button type="button" className="btn btn--primary" onClick={() => scrollToId('catalog')}>
                    Смотреть коллекцию
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline promo-copy"
                    onClick={() => {
                      setPromoInput('SEVER10');
                      setAppliedPromo('SEVER10');
                      setCartOpen(true);
                    }}
                  >
                    <Tag size={15} /> Промокод <strong className="mono">SEVER10</strong> (−10%)
                  </button>
                </div>
                <div className="hero__stats">
                  <div>
                    <strong className="mono">от 7 000 ₽</strong>
                    <span>Бесплатная доставка</span>
                  </div>
                  <div>
                    <strong className="mono">14 дней</strong>
                    <span>Обмен и возврат</span>
                  </div>
                  <div>
                    <strong className="mono">СДЭК / Курьер</strong>
                    <span>Отслеживание по треку</span>
                  </div>
                </div>
              </div>

              <div className="hero-showcase">
                {products[0] && (
                  <button
                    type="button"
                    className="hero-card"
                    onClick={() => setActiveProduct(products[0])}
                  >
                    <img src={resolveAssetUrl(products[0].image)} alt={products[0].title} draggable={false} />
                    <div className="hero-card__caption">
                      <span>Флагман коллекции</span>
                      <strong>{products[0].title} &bull; {formatRub(products[0].price)}</strong>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </section>

          <section id="catalog" className="container section">
            <div className="section-head">
              <div>
                <span className="eyebrow">Каталог</span>
                <h2 className="section-title">Доступно сейчас</h2>
              </div>

              <div className="catalog-controls">
                <div className="search-wrap">
                  <Search size={15} />
                  <input
                    type="search"
                    className="search-input"
                    placeholder="Поиск товара..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Поиск по каталогу"
                  />
                </div>
                <select
                  className="input select-sm"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Сортировка"
                >
                  <option value="popular">По популярности</option>
                  <option value="price_asc">Сначала дешевле</option>
                  <option value="price_desc">Сначала дороже</option>
                </select>
              </div>
            </div>

            <div className="filter-bar">
              <div className="tabs">
                {STORE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`tab ${activeCategory === cat.id ? 'is-active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <div className="size-filter">
                {SIZE_FILTERS.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    className={`size-chip mono ${activeSize === sz ? 'is-active' : ''}`}
                    onClick={() => setActiveSize(sz)}
                  >
                    {sz === 'all' ? 'Все размеры' : sz}
                  </button>
                ))}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="panel" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                По выбранным фильтрам товаров не найдено.
              </div>
            ) : (
              <div className="products-grid">
                {filteredProducts.map((product) => (
                  <article key={product.id} className="product-card">
                    <div
                      className="product-card__media"
                      onClick={() => setActiveProduct(product)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && setActiveProduct(product)}
                    >
                      {product.badge && <span className="product-badge">{product.badge}</span>}
                      <img
                        src={resolveAssetUrl(product.image)}
                        alt={product.title}
                        loading="lazy"
                        draggable={false}
                      />
                    </div>
                    <div className="product-card__body">
                      <div className="product-card__head">
                        <h3 onClick={() => setActiveProduct(product)}>{product.title}</h3>
                        <div className="price-row">
                          <strong className="mono">{formatRub(product.price)}</strong>
                          {product.oldPrice > 0 && (
                            <span className="mono price-old">{formatRub(product.oldPrice)}</span>
                          )}
                        </div>
                      </div>
                      <p className="product-card__specs">{product.specs}</p>
                      <div className="product-card__foot">
                        <span className="sizes-inline mono">{(product.sizes || []).join(' · ')}</span>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={product.stock <= 0}
                          onClick={() => {
                            addToCart(product, product.sizes?.[0]);
                            setCartOpen(true);
                          }}
                        >
                          <Plus size={14} /> В корзину
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section id="tracker" className="container section" style={{ paddingTop: 0 }}>
            <div className="tracker-grid">
              <div className="panel">
                <span className="eyebrow">Статус посылки</span>
                <h2 style={{ fontSize: '1.3rem', marginBottom: 8 }}>Отследить заказ</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 14 }}>
                  Введите номер заказа формата <span className="mono">SVR-2041</span> или выберите недавний заказ.
                </p>
                <form onSubmit={(e) => handleTrack(e)} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    className="input mono"
                    style={{ maxWidth: 190 }}
                    value={trackCode}
                    onChange={(e) => setTrackCode(e.target.value)}
                    placeholder="SVR-2041"
                    required
                  />
                  <button type="submit" className="btn btn--primary">
                    <PackageSearch size={15} /> Проверить
                  </button>
                </form>

                {savedCodes.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Недавние:</span>
                    {savedCodes.slice(0, 4).map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="size-chip mono"
                        onClick={() => handleTrack(null, c)}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}

                {trackError && <div className="status-msg status-msg--err" style={{ marginTop: 12 }}>{trackError}</div>}

                {trackedOrder && (
                  <div className="track-result">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <strong className="mono">{trackedOrder.code}</strong>
                      <span className={`status-pill ${(ORDER_STATUS[trackedOrder.status] || ORDER_STATUS.new).cls}`}>
                        {(ORDER_STATUS[trackedOrder.status] || ORDER_STATUS.new).label}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      {trackedOrder.city} &bull; Сумма: <strong className="mono">{formatRub(trackedOrder.total)}</strong>
                    </div>
                    <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {trackedOrder.items.map((i) => `${i.title} (${i.size}) x${i.qty}`).join(', ')}
                    </div>
                  </div>
                )}
              </div>

              <div id="delivery" className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span className="eyebrow">Сервис</span>
                <h2 style={{ fontSize: '1.3rem' }}>Условия доставки и возврата</h2>
                <div className="service-feature">
                  <Truck size={18} />
                  <div>
                    <strong>Доставка по всей России</strong>
                    <p>ПВЗ СДЭК (350 ₽) и курьер (490 ₽) бесплатно при сумме заказа от 7 000 ₽.</p>
                  </div>
                </div>
                <div className="service-feature">
                  <ShieldCheck size={18} />
                  <div>
                    <strong>Гарантия на швы и фурнитуру 1 год</strong>
                    <p>Обмен размера или возврат в течение 14 дней с момента получения посылки.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {cartOpen && (
        <div className="drawer-backdrop" onClick={(e) => e.target === e.currentTarget && setCartOpen(false)}>
          <aside className="drawer" role="dialog" aria-modal="true" aria-label="Корзина и оформление заказа">
            <div className="drawer-head">
              <h3>Корзина {cartCount > 0 ? `(${cartCount})` : ''}</h3>
              <button type="button" className="icon-btn" onClick={() => setCartOpen(false)} aria-label="Закрыть корзину">
                <X size={16} />
              </button>
            </div>

            {createdOrder && cart.length === 0 ? (
              <div className="confirm-box panel" style={{ marginTop: 12 }}>
                <span className="status-pill status--live">Заказ оформлен</span>
                <h4>Номер заказа: <span className="mono">{createdOrder.code}</span></h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Итого к оплате при получении или по ссылке: <strong className="mono">{formatRub(createdOrder.total)}</strong>.
                  Статус заказа уже доступен в трекере по номеру.
                </p>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={() => {
                    setCreatedOrder(null);
                    setCartOpen(false);
                    scrollToId('tracker');
                  }}
                >
                  Перейти к отслеживанию
                </button>
              </div>
            ) : cart.length === 0 ? (
              <div className="empty-cart">
                <ShoppingBag size={28} />
                <p>Корзина пока пуста</p>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setCartOpen(false)}>
                  Вернуться к покупкам
                </button>
              </div>
            ) : (
              <div className="drawer-body">
                <div className="cart-items">
                  {cart.map((item) => (
                    <div key={`${item.productId}-${item.size}`} className="cart-item">
                      <img src={resolveAssetUrl(item.image)} alt={item.title} draggable={false} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ fontSize: '0.9rem', display: 'block' }}>{item.title}</strong>
                        <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          Размер: {item.size} &bull; {formatRub(item.price)}
                        </span>
                        <div className="qty-row">
                          <button type="button" className="qty-btn" onClick={() => updateQty(item.productId, item.size, -1)} aria-label="Уменьшить">
                            <Minus size={13} />
                          </button>
                          <span className="mono">{item.qty}</span>
                          <button type="button" className="qty-btn" onClick={() => updateQty(item.productId, item.size, 1)} aria-label="Увеличить">
                            <Plus size={13} />
                          </button>
                          <button
                            type="button"
                            className="qty-btn"
                            style={{ marginLeft: 'auto' }}
                            onClick={() => updateQty(item.productId, item.size, -999)}
                            aria-label="Удалить"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="promo-row">
                  <input
                    className="input mono"
                    placeholder="Промокод (SEVER10)"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                  />
                  <button type="button" className="btn btn--outline btn--sm" onClick={applyPromoCode}>
                    Применить
                  </button>
                </div>
                {totals.validPromo && (
                  <div className="status-msg status-msg--ok">
                    <Check size={14} style={{ verticalAlign: 'middle' }} /> Промокод {totals.validPromo} активен (−10%)
                  </div>
                )}

                <div className="totals-box">
                  <div><span>Товары</span><span className="mono">{formatRub(totals.subtotal)}</span></div>
                  {totals.discount > 0 && (
                    <div><span>Скидка</span><span className="mono">−{formatRub(totals.discount)}</span></div>
                  )}
                  <div>
                    <span>Доставка</span>
                    <span className="mono">{totals.deliveryFee === 0 ? 'Бесплатно' : formatRub(totals.deliveryFee)}</span>
                  </div>
                  <div className="totals-total">
                    <strong>Итого</strong>
                    <strong className="mono">{formatRub(totals.total)}</strong>
                  </div>
                </div>

                <form onSubmit={handleCheckout} className="form">
                  <div className="field">
                    <label>Способ доставки</label>
                    <select
                      className="input"
                      value={deliveryMethod}
                      onChange={(e) => setDeliveryMethod(e.target.value)}
                    >
                      {DELIVERY_METHODS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.label} ({m.note})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Имя</label>
                    <input
                      className="input"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Максим Воронов"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Телефон</label>
                    <input
                      className="input mono"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(formatPhone(e.target.value))}
                      placeholder="+7 (999) 000-00-00"
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Город</label>
                    <input
                      className="input"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                    />
                  </div>
                  {deliveryMethod !== 'pickup' && (
                    <div className="field">
                      <label>Адрес или ПВЗ СДЭК</label>
                      <input
                        className="input"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="ул. Тверская, 12 или ПВЗ №48"
                        required
                      />
                    </div>
                  )}

                  <div className="hp-trap" aria-hidden="true">
                    <label htmlFor="hp-web">Ваш сайт</label>
                    <input
                      id="hp-web"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </div>

                  <label className="consent-check">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <span>
                      Согласен с{' '}
                      <button type="button" className="link-inline" onClick={() => setPrivacyOpen(true)}>
                        обработкой персональных данных (152-ФЗ)
                      </button>
                    </span>
                  </label>

                  {orderError && <div className="status-msg status-msg--err">{orderError}</div>}

                  <button type="submit" className="btn btn--primary" disabled={orderBusy}>
                    {orderBusy ? 'Оформление...' : `Оформить заказ • ${formatRub(totals.total)}`}
                  </button>
                </form>
              </div>
            )}
          </aside>
        </div>
      )}

      {activeProduct && (
        <ProductModal
          product={activeProduct}
          onClose={() => setActiveProduct(null)}
          onAddToCart={(p, size) => addToCart(p, size)}
        />
      )}

      {privacyOpen && <PrivacyModal onClose={() => setPrivacyOpen(false)} />}

      <footer className="footer">
        <div className="container footer__inner">
          <span>&copy; 2026 СЕВЕР — Технологичная городская одежда и снаряжение</span>
          <span>Санкт-Петербург &bull; order@sever-wear.ru</span>
        </div>
      </footer>
    </div>
  );
}
