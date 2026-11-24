import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, LogOut, PackageCheck, RefreshCw, Sparkles, Tag, UserCheck } from 'lucide-react';
import { ORDER_STATUS, formatRub, getSavedOrderCodes, storeApi } from '../api';
import { formatClientPhone } from '../clientAuth';

export default function ClientCabinet({
  client,
  clientAuth,
  products,
  onClientChange,
  onBackToStore,
  onApplyPromo,
  onRepeatOrder,
  onOpenPrivacy
}) {
  const [authTab, setAuthTab] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authMsg, setAuthMsg] = useState({ type: '', text: '' });
  const [authBusy, setAuthBusy] = useState(false);

  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCity, setRegCity] = useState('Москва');
  const [regSize, setRegSize] = useState('L');
  const [regPassword, setRegPassword] = useState('');
  const [regWebsite, setRegWebsite] = useState('');
  const [regConsent, setRegConsent] = useState(false);
  const regOpenedAt = useRef(Date.now());

  const [profName, setProfName] = useState('');
  const [profPhone, setProfPhone] = useState('');
  const [profCity, setProfCity] = useState('Москва');
  const [profAddress, setProfAddress] = useState('');
  const [profSize, setProfSize] = useState('L');
  const [profMsg, setProfMsg] = useState({ type: '', text: '' });
  const [profBusy, setProfBusy] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (authTab === 'register') regOpenedAt.current = Date.now();
  }, [authTab]);

  useEffect(() => {
    if (!client) {
      setOrders([]);
      return;
    }
    setProfName(client.name || '');
    setProfPhone(client.phone || '');
    setProfCity(client.meta?.city || 'Москва');
    setProfAddress(client.meta?.address || '');
    setProfSize(client.meta?.size || 'L');

    const codes = Array.from(new Set([...(client.meta?.orderCodes || []), ...getSavedOrderCodes()]));
    setOrdersLoading(true);
    storeApi
      .getOrdersByCodes(codes)
      .then((res) => setOrders(res.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [client]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const res = await clientAuth.login(loginEmail, loginPassword);
      onClientChange(res.client);
      setLoginPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setAuthMsg({ type: '', text: '' });
    setAuthBusy(true);
    try {
      const res = await clientAuth.register({
        name: regName,
        email: regEmail,
        phone: regPhone,
        password: regPassword,
        meta: {
          city: regCity.trim() || 'Москва',
          address: '',
          size: regSize,
          orderCodes: getSavedOrderCodes()
        },
        consent: regConsent,
        website: regWebsite,
        elapsedMs: Date.now() - regOpenedAt.current
      });
      if (res.client) onClientChange(res.client);
      setRegPassword('');
    } catch (err) {
      setAuthMsg({ type: 'err', text: err.message });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfMsg({ type: '', text: '' });
    setProfBusy(true);
    try {
      const res = await clientAuth.updateProfile({
        name: profName,
        phone: profPhone,
        meta: { city: profCity.trim(), address: profAddress.trim(), size: profSize }
      });
      onClientChange(res.client);
      setProfMsg({ type: 'ok', text: 'Данные покупателя сохранены и подставлены в оформление заказа.' });
    } catch (err) {
      setProfMsg({ type: 'err', text: err.message });
    } finally {
      setProfBusy(false);
    }
  }

  async function handleLogout() {
    await clientAuth.logout().catch(() => {});
    onClientChange(null);
  }

  function fillDemoClient() {
    setAuthTab('login');
    setLoginEmail('client@sever-wear.ru');
    setLoginPassword('client12345');
    setAuthMsg({ type: 'ok', text: 'Подставлены данные демо-покупателя' });
  }

  return (
    <section className="container section">
      <div className="cab-head">
        <div>
          <span className="eyebrow">Аккаунт покупателя СЕВЕР</span>
          <h1 className="section-title">
            {client ? `Личный кабинет · ${client.name}` : 'Личный кабинет покупателя'}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn--outline btn--sm" onClick={onBackToStore}>
            <ArrowLeft size={14} /> В каталог
          </button>
          {client && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={handleLogout}>
              <LogOut size={14} /> Выйти
            </button>
          )}
        </div>
      </div>

      {!client ? (
        <div className="auth-layout">
          <div className="panel">
            <div className="tabs" style={{ marginBottom: 16 }}>
              <button
                type="button"
                className={`tab ${authTab === 'login' ? 'is-active' : ''}`}
                onClick={() => {
                  setAuthTab('login');
                  setAuthMsg({ type: '', text: '' });
                }}
              >
                Вход
              </button>
              <button
                type="button"
                className={`tab ${authTab === 'register' ? 'is-active' : ''}`}
                onClick={() => {
                  setAuthTab('register');
                  setAuthMsg({ type: '', text: '' });
                }}
              >
                Регистрация
              </button>
            </div>

            {authTab === 'login' ? (
              <form className="form" onSubmit={handleLogin}>
                <div className="field">
                  <label htmlFor="sevLoginEmail">Email</label>
                  <input
                    id="sevLoginEmail"
                    type="email"
                    className="input mono"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="client@sever-wear.ru"
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="field">
                  <label htmlFor="sevLoginPass">Пароль</label>
                  <input
                    id="sevLoginPass"
                    type="password"
                    className="input"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Введите пароль"
                    required
                    autoComplete="current-password"
                  />
                </div>
                {authMsg.text && (
                  <div className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                    {authMsg.text}
                  </div>
                )}
                <button type="submit" className="btn btn--primary" disabled={authBusy}>
                  {authBusy ? 'Проверяем...' : 'Войти'}
                </button>
              </form>
            ) : (
              <form className="form" onSubmit={handleRegister}>
                <div className="field">
                  <label htmlFor="sevRegName">Имя *</label>
                  <input
                    id="sevRegName"
                    className="input"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="Максим Воронов"
                    required
                  />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="sevRegEmail">Email *</label>
                    <input
                      id="sevRegEmail"
                      type="email"
                      className="input mono"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="you@example.ru"
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sevRegPhone">Телефон</label>
                    <input
                      id="sevRegPhone"
                      type="tel"
                      className="input mono"
                      value={regPhone}
                      onChange={(e) => setRegPhone(formatClientPhone(e.target.value))}
                      placeholder="+7 (999) 000-00-00"
                    />
                  </div>
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="sevRegCity">Город доставки</label>
                    <input
                      id="sevRegCity"
                      className="input"
                      value={regCity}
                      onChange={(e) => setRegCity(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sevRegSize">Размер</label>
                    <select
                      id="sevRegSize"
                      className="input"
                      value={regSize}
                      onChange={(e) => setRegSize(e.target.value)}
                    >
                      {['S', 'M', 'L', 'XL'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="sevRegPass">Пароль (от 6 символов) *</label>
                  <input
                    id="sevRegPass"
                    type="password"
                    className="input"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    minLength={6}
                    required
                  />
                </div>
                <div className="hp-trap" aria-hidden="true">
                  <label htmlFor="sevRegTrap">Ваш сайт</label>
                  <input
                    id="sevRegTrap"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={regWebsite}
                    onChange={(e) => setRegWebsite(e.target.value)}
                  />
                </div>
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={regConsent}
                    onChange={(e) => setRegConsent(e.target.checked)}
                    required
                  />
                  <span>
                    Согласен(на) на обработку персональных данных (
                    <button type="button" className="link-inline" onClick={onOpenPrivacy}>152-ФЗ</button>)
                  </span>
                </label>
                {authMsg.text && (
                  <div className={`status-msg ${authMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                    {authMsg.text}
                  </div>
                )}
                <button type="submit" className="btn btn--primary" disabled={authBusy}>
                  {authBusy ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
                </button>
              </form>
            )}
          </div>

          <aside className="panel demo-creds">
            <div>
              <span className="eyebrow">Демо-доступ</span>
              <h2 style={{ fontSize: '1.15rem', marginBottom: 6 }}>Посмотреть кабинет покупателя</h2>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                Отслеживайте заказы, сохраняйте адрес ПВЗ СДЭК и размер, повторяйте покупки в один клик.
              </p>
            </div>
            <div className="demo-creds__box">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <strong>Тестовый клиент</strong>
                <span className="badge-pill">КЛИЕНТ</span>
              </div>
              <div className="mono" style={{ fontSize: '0.8rem' }}>Email: client@sever-wear.ru</div>
              <div className="mono" style={{ fontSize: '0.8rem', marginBottom: 10 }}>Пароль: client12345</div>
              <button type="button" className="btn btn--outline btn--sm" onClick={fillDemoClient}>
                Подставить данные клиента
              </button>
            </div>
          </aside>
        </div>
      ) : (
        <div className="cab-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCheck size={17} /> Профиль и доставка
                </h2>
                <span className="badge-pill">КЛИЕНТ</span>
              </div>
              <form className="form" onSubmit={handleProfileSave}>
                <div className="field">
                  <label>Email</label>
                  <input className="input mono" value={client.email} disabled />
                </div>
                <div className="field">
                  <label htmlFor="sevProfName">Имя</label>
                  <input
                    id="sevProfName"
                    className="input"
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="sevProfPhone">Телефон</label>
                    <input
                      id="sevProfPhone"
                      type="tel"
                      className="input mono"
                      value={profPhone}
                      onChange={(e) => setProfPhone(formatClientPhone(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="sevProfSize">Основной размер</label>
                    <select
                      id="sevProfSize"
                      className="input"
                      value={profSize}
                      onChange={(e) => setProfSize(e.target.value)}
                    >
                      {['S', 'M', 'L', 'XL'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="sevProfCity">Город</label>
                  <input
                    id="sevProfCity"
                    className="input"
                    value={profCity}
                    onChange={(e) => setProfCity(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="sevProfAddr">Адрес ПВЗ или доставки</label>
                  <input
                    id="sevProfAddr"
                    className="input"
                    value={profAddress}
                    onChange={(e) => setProfAddress(e.target.value)}
                    placeholder="ПВЗ СДЭК на ул. Бауманская, 43"
                  />
                </div>
                {profMsg.text && (
                  <div className={`status-msg ${profMsg.type === 'ok' ? 'status-msg--ok' : 'status-msg--err'}`}>
                    {profMsg.text}
                  </div>
                )}
                <button type="submit" className="btn btn--primary" disabled={profBusy}>
                  {profBusy ? 'Сохраняем...' : 'Сохранить профиль'}
                </button>
              </form>
            </div>

            <div className="panel cab-promo">
              <div>
                <span className="eyebrow">Клубная привилегия</span>
                <strong style={{ display: 'block', fontSize: '1.05rem' }}>
                  <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                  Промокод <span className="mono">SEVER10</span> (−10%)
                </strong>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Действует на все позиции дропа 04 и суммируется с бесплатной доставкой от 7 000 ₽.
                </p>
              </div>
              <button type="button" className="btn btn--outline btn--sm" onClick={onApplyPromo}>
                <Tag size={14} /> Применить в корзине
              </button>
            </div>
          </div>

          <div className="panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PackageCheck size={17} /> История моих заказов
              </h2>
              <span className="mono" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Всего: {orders.length}
              </span>
            </div>

            {ordersLoading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Загружаем заказы...</p>
            ) : orders.length === 0 ? (
              <div className="cab-item">
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  У вас пока нет оформленных заказов.
                </p>
                <button type="button" className="btn btn--primary btn--sm" onClick={onBackToStore}>
                  Выбрать экипировку
                </button>
              </div>
            ) : (
              <div className="cab-list">
                {orders.map((ord) => {
                  const st = ORDER_STATUS[ord.status] || ORDER_STATUS.new;
                  const canRepeat = (ord.items || []).some((it) =>
                    products.some((p) => p.id === it.productId && p.stock > 0)
                  );
                  return (
                    <article key={ord.code} className="cab-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <strong className="mono">{ord.code}</strong>
                        <span className={`status-pill ${st.cls}`}>{st.label}</span>
                      </div>
                      <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                        {ord.city}{ord.address ? ` • ${ord.address}` : ''} &bull;{' '}
                        <strong className="mono">{formatRub(ord.total)}</strong>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {(ord.items || []).map((i) => `${i.title} (${i.size}) ×${i.qty}`).join(', ')}
                      </div>
                      {canRepeat && (
                        <div>
                          <button
                            type="button"
                            className="btn btn--outline btn--sm"
                            onClick={() => onRepeatOrder(ord.items || [])}
                          >
                            <RefreshCw size={13} /> Повторить заказ
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
