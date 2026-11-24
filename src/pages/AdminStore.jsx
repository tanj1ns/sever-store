import React, { useEffect, useState } from 'react';
import { ArrowLeft, LogOut, PackageCheck, Plus, Shield, Trash2 } from 'lucide-react';
import { ORDER_STATUS, STORE_CATEGORIES, formatRub, storeApi } from '../api';

export default function AdminStore({ user, products, onUserChange, onRefreshCatalog, onExit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');

  const [newProd, setNewProd] = useState({
    title: '',
    category: 'outerwear',
    price: 9900,
    stock: 10,
    badge: 'НОВИНКА',
    image: './uploads/windbreaker.webp',
    sizesText: 'S, M, L, XL',
    specs: ''
  });

  useEffect(() => {
    if (user) {
      storeApi
        .getAdminOrders()
        .then((res) => setOrders(res.orders || []))
        .catch(() => {});
    }
  }, [user]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await storeApi.login(email, password);
      onUserChange(res.user);
      setPassword('');
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await storeApi.logout();
    onUserChange(null);
  }

  async function handleStatusChange(orderId, nextStatus) {
    try {
      const res = await storeApi.updateOrderStatus(orderId, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? res.order : o)));
      setStatusMsg(`Статус заказа ${res.order.code} обновлён`);
    } catch (err) {
      setStatusMsg(err.message);
    }
  }

  async function handleCreateProduct(e) {
    e.preventDefault();
    setStatusMsg('');
    try {
      const sizes = newProd.sizesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await storeApi.createProduct({
        title: newProd.title,
        category: newProd.category,
        price: Number(newProd.price),
        stock: Number(newProd.stock),
        badge: newProd.badge,
        image: newProd.image,
        sizes: sizes.length ? sizes : ['One Size'],
        specs: newProd.specs
      });
      setNewProd({
        title: '',
        category: 'outerwear',
        price: 9900,
        stock: 10,
        badge: 'НОВИНКА',
        image: './uploads/windbreaker.webp',
        sizesText: 'S, M, L, XL',
        specs: ''
      });
      setStatusMsg('Позиция добавлена в каталог');
      await onRefreshCatalog();
    } catch (err) {
      setStatusMsg(err.message);
    }
  }

  async function handleQuickStock(prod, delta) {
    try {
      await storeApi.updateProduct(prod.id, { stock: Math.max(0, prod.stock + delta) });
      await onRefreshCatalog();
    } catch (err) {
      setStatusMsg(err.message);
    }
  }

  async function handleDeleteProduct(id) {
    try {
      await storeApi.deleteProduct(id);
      setStatusMsg('Товар удалён из каталога');
      await onRefreshCatalog();
    } catch (err) {
      setStatusMsg(err.message);
    }
  }

  if (!user) {
    return (
      <section className="container admin-wrap">
        <div className="admin-login">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="eyebrow" style={{ marginBottom: 0 }}>
              <Shield size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
              Закрытая панель
            </span>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onExit}>
              <ArrowLeft size={14} /> В магазин
            </button>
          </div>
          <h2 style={{ fontSize: '1.3rem' }}>Вход в кабинет СЕВЕР</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Доступ к управлению остатками склада, ценами и отгрузками заказов.
          </p>
          <form onSubmit={handleLogin} className="form">
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
              />
            </div>
            <div className="field">
              <label>Пароль</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {authError && <div className="status-msg status-msg--err">{authError}</div>}
            <button type="submit" className="btn btn--primary" disabled={authLoading}>
              {authLoading ? 'Проверка...' : 'Войти'}
            </button>
          </form>
        </div>
      </section>
    );
  }

  const revenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  const lowStockCount = products.filter((p) => p.stock <= 8).length;

  return (
    <section className="container admin-wrap">
      <div className="admin-header">
        <div>
          <span className="eyebrow">CMS & Заказы</span>
          <h2 style={{ fontSize: '1.5rem' }}>Панель управления магазином</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={onExit}>
            <ArrowLeft size={14} /> Вернуться в каталог
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
            <LogOut size={14} /> Выйти
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <span>Выручка (без отмен)</span>
          <strong className="mono">{formatRub(revenue)}</strong>
        </div>
        <div className="kpi-card">
          <span>Всего заказов</span>
          <strong className="mono">{orders.length}</strong>
        </div>
        <div className="kpi-card">
          <span>Позиций в каталоге</span>
          <strong className="mono">{products.length}</strong>
        </div>
        <div className="kpi-card">
          <span>Мало на складе (&le; 8)</span>
          <strong className="mono">{lowStockCount}</strong>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          type="button"
          className={`tab ${tab === 'orders' ? 'is-active' : ''}`}
          onClick={() => setTab('orders')}
        >
          Заказы ({orders.length})
        </button>
        <button
          type="button"
          className={`tab ${tab === 'catalog' ? 'is-active' : ''}`}
          onClick={() => setTab('catalog')}
        >
          Каталог и остатки ({products.length})
        </button>
      </div>

      {statusMsg && <div className="status-msg status-msg--ok" style={{ marginBottom: 14 }}>{statusMsg}</div>}

      {tab === 'orders' ? (
        <div className="admin-list">
          {orders.map((order) => {
            const st = ORDER_STATUS[order.status] || ORDER_STATUS.new;
            return (
              <div key={order.id} className="admin-row">
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong className="mono">{order.code}</strong>
                    <span className={`status-pill ${st.cls}`}>{st.label}</span>
                    {order.promoCode && <span className="badge-pill">{order.promoCode}</span>}
                  </div>
                  <div style={{ fontSize: '0.88rem', marginTop: 4 }}>
                    {order.clientName} &bull; {order.clientPhone} &bull; {order.city} ({order.address})
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    {order.items.map((i) => `${i.title} (${i.size}) x${i.qty}`).join(', ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <strong className="mono">{formatRub(order.total)}</strong>
                  <select
                    className="input"
                    style={{ width: 'auto' }}
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value)}
                    aria-label={`Статус заказа ${order.code}`}
                  >
                    <option value="new">Новый заказ</option>
                    <option value="confirmed">Подтверждён</option>
                    <option value="shipped">Передан в доставку</option>
                    <option value="delivered">Доставлен</option>
                    <option value="cancelled">Отменён</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <form onSubmit={handleCreateProduct} className="panel form">
            <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Plus size={16} /> Добавить товар
            </h3>
            <div className="form-grid">
              <div className="field">
                <label>Название</label>
                <input
                  className="input"
                  value={newProd.title}
                  onChange={(e) => setNewProd({ ...newProd, title: e.target.value })}
                  placeholder="Анорак Polar Shield"
                  required
                />
              </div>
              <div className="field">
                <label>Категория</label>
                <select
                  className="input"
                  value={newProd.category}
                  onChange={(e) => setNewProd({ ...newProd, category: e.target.value })}
                >
                  {STORE_CATEGORIES.filter((c) => c.id !== 'all').map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Цена (₽)</label>
                <input
                  type="number"
                  className="input"
                  value={newProd.price}
                  onChange={(e) => setNewProd({ ...newProd, price: e.target.value })}
                  min="100"
                  required
                />
              </div>
              <div className="field">
                <label>Остаток (шт.)</label>
                <input
                  type="number"
                  className="input"
                  value={newProd.stock}
                  onChange={(e) => setNewProd({ ...newProd, stock: e.target.value })}
                  min="0"
                  required
                />
              </div>
              <div className="field">
                <label>Изображение</label>
                <select
                  className="input"
                  value={newProd.image}
                  onChange={(e) => setNewProd({ ...newProd, image: e.target.value })}
                >
                  <option value="./uploads/windbreaker.webp">Ветровка (windbreaker.webp)</option>
                  <option value="./uploads/hoodie.webp">Худи (hoodie.webp)</option>
                  <option value="./uploads/backpack.webp">Рюкзак (backpack.webp)</option>
                  <option value="./uploads/tumbler.webp">Термокружка (tumbler.webp)</option>
                </select>
              </div>
              <div className="field">
                <label>Размеры (через запятую)</label>
                <input
                  className="input"
                  value={newProd.sizesText}
                  onChange={(e) => setNewProd({ ...newProd, sizesText: e.target.value })}
                />
              </div>
              <div className="field full">
                <label>Спецификация</label>
                <input
                  className="input"
                  value={newProd.specs}
                  onChange={(e) => setNewProd({ ...newProd, specs: e.target.value })}
                  placeholder="Мембрана 15 000 мм, фурнитура YKK..."
                />
              </div>
            </div>
            <div>
              <button type="submit" className="btn btn--primary btn--sm">
                <PackageCheck size={15} /> Сохранить товар
              </button>
            </div>
          </form>

          <div className="admin-list">
            {products.map((p) => (
              <div key={p.id} className="admin-row">
                <div>
                  <strong>{p.title}</strong>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {formatRub(p.price)} &bull; Остаток: <span className="mono">{p.stock} шт.</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => handleQuickStock(p, -1)}>
                    -1
                  </button>
                  <button type="button" className="btn btn--outline btn--sm" onClick={() => handleQuickStock(p, 5)}>
                    +5
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => handleDeleteProduct(p.id)}
                    aria-label={`Удалить ${p.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
