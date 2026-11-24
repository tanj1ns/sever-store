const SECRET_ROUTE_SALT = 'sever-route-v1:';
const SECRET_ROUTE_HASH = 'a6de223dbd290a1f554527b6e71004286022048c43e91483d44ba8a925399054';

const ADMIN_EMAIL = 'admin@sever-wear.ru';
const ADMIN_PASS_SALT = 'sever-adm-v2:';
const ADMIN_PASS_HASH = 'a3fc27d8fef2609c6a6647d9342b65f1928deaaf21b6016aaa350c709c5f0adb';

const STATIC_DB_KEY = 'sever_static_db_v1';
const STATIC_SESSION_KEY = 'sever_static_admin_v1';
const LOGIN_GUARD_KEY = 'sever_login_guard_v1';
const CART_KEY = 'sever_cart_v1';
const MY_ORDERS_KEY = 'sever_my_orders_v1';

let staticModeFlag = null;

export const STORE_CATEGORIES = [
  { id: 'all', label: 'Все товары' },
  { id: 'outerwear', label: 'Верхняя одежда' },
  { id: 'hoodies', label: 'Худи и свитшоты' },
  { id: 'accessories', label: 'Снаряжение' }
];

export const SIZE_FILTERS = ['all', 'S', 'M', 'L', 'XL', 'One Size'];

export const DELIVERY_METHODS = [
  { id: 'cdek', label: 'ПВЗ СДЭК', price: 350, note: 'Бесплатно от 7 000 ₽ • 2–4 дня' },
  { id: 'courier', label: 'Курьер до двери', price: 490, note: 'Бесплатно от 7 000 ₽ • 1–2 дня' },
  { id: 'pickup', label: 'Самовывоз из шоурума', price: 0, note: 'Сегодня • Каменноостровский пр., 14' }
];

export const ORDER_STATUS = {
  new: { label: 'Новый заказ', cls: 'status--wip' },
  confirmed: { label: 'Подтверждён', cls: 'status--live' },
  shipped: { label: 'Передан в доставку', cls: 'status--accent' },
  delivered: { label: 'Доставлен', cls: 'status--oss' },
  cancelled: { label: 'Отменён', cls: 'status--err' }
};

export function isStaticHost() {
  if (staticModeFlag !== null) return staticModeFlag;
  return window.location.hostname.endsWith('github.io') || window.location.protocol === 'file:';
}

export async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str || '')));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isSecretAdminHash(hashStr) {
  const clean = String(hashStr || '')
    .replace(/^#\/?/, '')
    .replace(/\/+$/, '')
    .trim();
  if (!clean) return false;
  return (await sha256Hex(SECRET_ROUTE_SALT + clean)) === SECRET_ROUTE_HASH;
}

export function resolveAssetUrl(url) {
  if (!url) return '';
  if (/^(https?:|data:|blob:|\.\.?\/)/i.test(url)) return url;
  if (url.startsWith('/')) return `.${url}`;
  return url;
}

export function safeHref(url) {
  const s = String(url || '').trim();
  if (!s) return '#';
  return /^(https?:\/\/|mailto:|tel:|#|\.\.?\/|\/(?!\/))/i.test(s) ? s : '#';
}

export function formatRub(val) {
  return `${Math.round(Number(val) || 0).toLocaleString('ru-RU')} ₽`;
}

export function formatPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits[0] === '8' || digits[0] === '7') digits = '7' + digits.slice(1);
  else digits = '7' + digits;
  digits = digits.slice(0, 11);

  let out = '+7';
  if (digits.length > 1) out += ' (' + digits.slice(1, 4);
  if (digits.length > 4) out += ') ' + digits.slice(4, 7);
  if (digits.length > 7) out += '-' + digits.slice(7, 9);
  if (digits.length > 9) out += '-' + digits.slice(9, 11);
  return out;
}

export function calculateTotals(cartItems, promoCode, deliveryMethod) {
  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const promoClean = String(promoCode || '').trim().toUpperCase();
  const validPromo = promoClean === 'SEVER10' ? 'SEVER10' : '';
  const discount = validPromo ? Math.round(subtotal * 0.1) : 0;
  const afterDiscount = Math.max(0, subtotal - discount);

  let deliveryFee = 0;
  if (subtotal > 0) {
    if (deliveryMethod === 'pickup' || afterDiscount >= 7000) {
      deliveryFee = 0;
    } else {
      deliveryFee = deliveryMethod === 'courier' ? 490 : 350;
    }
  }

  return {
    subtotal,
    validPromo,
    discount,
    deliveryFee,
    total: afterDiscount + deliveryFee
  };
}

export function loadSavedCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function getSavedOrderCodes() {
  try {
    const raw = localStorage.getItem(MY_ORDERS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : ['SVR-2041', 'SVR-2042'];
  } catch {
    return ['SVR-2041', 'SVR-2042'];
  }
}

function saveOrderCode(code) {
  const prev = getSavedOrderCodes();
  const next = [code, ...prev.filter((c) => c !== code)].slice(0, 12);
  localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(next));
}

function getInitialStaticDb() {
  const now = new Date().toISOString();
  return {
    nextProdId: 7,
    nextOrderId: 3,
    products: [
      {
        id: 1,
        slug: 'storm-shell-jacket',
        category: 'outerwear',
        title: 'Ветровка Storm Shell',
        badge: 'ХИТ',
        price: 12900,
        oldPrice: 14900,
        image: './uploads/windbreaker.webp',
        sizes: ['S', 'M', 'L', 'XL'],
        stock: 14,
        description: 'Техническая городская ветровка с защитой от проливного дождя и штормового ветра. Матовая фактура, анатомический крой рукава.',
        specs: 'Трёхслойная мембрана 20 000 мм, проклеенные швы, влагозащитные молнии YKK AquaGuard.'
      },
      {
        id: 2,
        slug: 'heavyweight-hoodie',
        category: 'hoodies',
        title: 'Худи Heavyweight Fleece',
        badge: 'DROP 04',
        price: 7900,
        oldPrice: 0,
        image: './uploads/hoodie.webp',
        sizes: ['S', 'M', 'L', 'XL'],
        stock: 22,
        description: 'Базовое плотное худи графитового оттенка из премиального хлопка. Держит форму после многократных стирок и не скатывается.',
        specs: 'Плотность 460 г/м², 100% органический хлопок, двойной объёмный капюшон, свободный крой.'
      },
      {
        id: 3,
        slug: 'cordura-rolltop-24',
        category: 'accessories',
        title: 'Рюкзак Cordura 24L',
        badge: 'ТОП',
        price: 8400,
        oldPrice: 0,
        image: './uploads/backpack.webp',
        sizes: ['One Size'],
        stock: 9,
        description: 'Функциональный городской рюкзак с изменяемым объёмом роллтоп и усиленной защитой ноутбука.',
        specs: 'Нейлон Cordura 1000D с PU-пропиткой, отсек 16 дюймов, алюминиевая пряжка G-Hook.'
      },
      {
        id: 4,
        slug: 'vacuum-tumbler-450',
        category: 'accessories',
        title: 'Термокружка Vacuum 450 ml',
        badge: '',
        price: 2900,
        oldPrice: 0,
        image: './uploads/tumbler.webp',
        sizes: ['One Size'],
        stock: 31,
        description: 'Компактный термостакан для ежедневных маршрутов и автопутешествий. Помещается в стандартный подстаканник.',
        specs: 'Нержавеющая сталь 18/8, матовое порошковое покрытие, сохранение тепла до 8 часов.'
      },
      {
        id: 5,
        slug: 'shell-lite-black',
        category: 'outerwear',
        title: 'Куртка Shell Lite',
        badge: 'НОВИНКА',
        price: 10500,
        oldPrice: 0,
        image: './uploads/windbreaker.webp',
        sizes: ['S', 'M', 'L', 'XL'],
        stock: 8,
        description: 'Лёгкая межсезонная куртка-анорак, которая компактно складывается во внутренний карман и не занимает место в рюкзаке.',
        specs: 'Рипстоп нейлон 85 г/м² с DWR-пропиткой, вес 310 г, двухсторонняя вентиляция.'
      },
      {
        id: 6,
        slug: 'oversize-hoodie-480',
        category: 'hoodies',
        title: 'Худи Oversize 480 gsm',
        badge: 'ЛИМИТ',
        price: 8500,
        oldPrice: 9600,
        image: './uploads/hoodie.webp',
        sizes: ['M', 'L', 'XL'],
        stock: 6,
        description: 'Лимитированная серия утеплённого худи со спущенной линией плеча и потайным боковым карманом на молнии.',
        specs: 'Трикотаж 480 г/м² (хлопок 85% / полиэстер 15%), мягкий начёс, графитовый меланж.'
      }
    ],
    orders: [
      {
        id: 1,
        code: 'SVR-2041',
        items: [
          { productId: 1, title: 'Ветровка Storm Shell', size: 'L', qty: 1, price: 12900 },
          { productId: 4, title: 'Термокружка Vacuum 450 ml', size: 'One Size', qty: 1, price: 2900 }
        ],
        subtotal: 15800,
        discount: 1580,
        deliveryFee: 0,
        total: 14220,
        promoCode: 'SEVER10',
        deliveryMethod: 'cdek',
        city: 'Москва',
        address: 'ПВЗ СДЭК на ул. Бауманская, 43',
        clientName: 'Алексей Морозов',
        clientPhone: '+7 (916) 442-19-80',
        status: 'shipped',
        createdAt: now
      },
      {
        id: 2,
        code: 'SVR-2042',
        items: [
          { productId: 3, title: 'Рюкзак Cordura 24L', size: 'One Size', qty: 1, price: 8400 }
        ],
        subtotal: 8400,
        discount: 0,
        deliveryFee: 0,
        total: 8400,
        promoCode: '',
        deliveryMethod: 'pickup',
        city: 'Санкт-Петербург',
        address: 'Шоурум СЕВЕР, Каменноостровский пр., 14',
        clientName: 'Илья Соколов',
        clientPhone: '+7 (921) 703-51-22',
        status: 'confirmed',
        createdAt: now
      }
    ]
  };
}

function readStaticDb() {
  try {
    const raw = localStorage.getItem(STATIC_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.orders)) {
        return parsed;
      }
    }
  } catch {}
  const init = getInitialStaticDb();
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(init));
  return init;
}

function writeStaticDb(db) {
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
}

function getStaticUser() {
  try {
    const raw = sessionStorage.getItem(STATIC_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function reqJson(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Сервер вернул некорректный ответ');
  }
  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `Ошибка ${res.status}`);
  }
  return data;
}

export const storeApi = {
  async bootstrap() {
    if (isStaticHost()) {
      const db = readStaticDb();
      return { ok: true, products: db.products, user: getStaticUser() };
    }
    try {
      const res = await reqJson('./api/bootstrap');
      staticModeFlag = false;
      return res;
    } catch {
      staticModeFlag = true;
      const db = readStaticDb();
      return { ok: true, products: db.products, user: getStaticUser() };
    }
  },

  async createOrder(payload) {
    if (String(payload.website || '').trim() !== '') {
      return { ok: true, order: { code: 'SVR-9901', status: 'new', total: 0 } };
    }
    if (!payload.consent) {
      throw new Error('Подтвердите согласие на обработку персональных данных (152-ФЗ).');
    }

    if (isStaticHost()) {
      const db = readStaticDb();
      const clientName = String(payload.clientName || '').trim();
      const clientPhone = String(payload.clientPhone || '').trim();
      const city = String(payload.city || '').trim();
      const address = String(payload.address || '').trim();
      const method = ['cdek', 'courier', 'pickup'].includes(payload.deliveryMethod)
        ? payload.deliveryMethod
        : 'cdek';

      if (clientName.length < 2 || clientPhone.replace(/\D/g, '').length < 11) {
        throw new Error('Укажите имя и корректный номер телефона (+7)');
      }
      if (city.length < 2) {
        throw new Error('Укажите город доставки');
      }
      if (method !== 'pickup' && address.length < 4) {
        throw new Error('Укажите адрес доставки или пункт выдачи');
      }
      if (!Array.isArray(payload.items) || !payload.items.length) {
        throw new Error('Корзина пуста');
      }

      const items = [];
      for (const line of payload.items) {
        const prod = db.products.find((p) => p.id === Number(line.productId));
        if (!prod) throw new Error('Товар не найден в каталоге');
        const qty = Math.max(1, Math.min(20, Math.round(Number(line.qty) || 1)));
        if (prod.stock < qty) throw new Error(`Недостаточно товара «${prod.title}» на складе`);
        items.push({
          productId: prod.id,
          title: prod.title,
          size: String(line.size || prod.sizes?.[0] || 'One Size'),
          qty,
          price: prod.price
        });
      }

      const totals = calculateTotals(items, payload.promoCode, method);
      const code = `SVR-${2040 + db.nextOrderId}`;
      const order = {
        id: db.nextOrderId++,
        code,
        items,
        subtotal: totals.subtotal,
        discount: totals.discount,
        deliveryFee: totals.deliveryFee,
        total: totals.total,
        promoCode: totals.validPromo,
        deliveryMethod: method,
        city,
        address: method === 'pickup' ? 'Шоурум СЕВЕР, Каменноостровский пр., 14' : address,
        clientName,
        clientPhone,
        status: 'new',
        createdAt: new Date().toISOString()
      };

      for (const line of items) {
        const prod = db.products.find((p) => p.id === line.productId);
        if (prod) prod.stock = Math.max(0, prod.stock - line.qty);
      }

      db.orders.unshift(order);
      writeStaticDb(db);
      saveOrderCode(code);
      return { ok: true, order };
    }

    const res = await reqJson('./api/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res?.order?.code) saveOrderCode(res.order.code);
    return res;
  },

  async trackOrder(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!/^SVR-\d{4}$/.test(code)) {
      throw new Error('Укажите код заказа в формате SVR-2041');
    }
    if (isStaticHost()) {
      const db = readStaticDb();
      const found = db.orders.find((o) => o.code === code);
      if (!found) throw new Error('Заказ с таким номером не найден');
      return {
        ok: true,
        order: {
          code: found.code,
          status: found.status,
          deliveryMethod: found.deliveryMethod,
          city: found.city,
          total: found.total,
          items: found.items,
          createdAt: found.createdAt
        }
      };
    }
    return reqJson(`./api/orders/track?code=${encodeURIComponent(code)}`);
  },

  async getOrdersByCodes(codes) {
    const clean = Array.from(
      new Set((codes || []).map((c) => String(c || '').trim().toUpperCase()).filter(Boolean))
    );
    if (isStaticHost()) {
      const db = readStaticDb();
      return { ok: true, orders: db.orders.filter((o) => clean.includes(o.code)) };
    }
    try {
      return await reqJson(`./api/client/orders?codes=${encodeURIComponent(clean.join(','))}`);
    } catch (err) {
      if (err && err.name === 'TypeError') {
        const db = readStaticDb();
        return { ok: true, orders: db.orders.filter((o) => clean.includes(o.code)) };
      }
      throw err;
    }
  },

  async login(email, password) {
    if (isStaticHost()) {
      let guard = { count: 0, lockedUntil: 0 };
      try {
        guard = JSON.parse(localStorage.getItem(LOGIN_GUARD_KEY) || '{}');
      } catch {}
      if (guard.lockedUntil && guard.lockedUntil > Date.now()) {
        const sec = Math.ceil((guard.lockedUntil - Date.now()) / 1000);
        throw new Error(`Слишком много попыток входа. Повторите через ${sec} сек.`);
      }

      await new Promise((r) => setTimeout(r, 450));
      const cleanEmail = String(email || '').trim().toLowerCase();
      const passHash = await sha256Hex(ADMIN_PASS_SALT + String(password || ''));

      if (cleanEmail !== ADMIN_EMAIL || passHash !== ADMIN_PASS_HASH) {
        const count = Number(guard.count || 0) + 1;
        const nextGuard = count >= 5 ? { count: 0, lockedUntil: Date.now() + 5 * 60_000 } : { count, lockedUntil: 0 };
        localStorage.setItem(LOGIN_GUARD_KEY, JSON.stringify(nextGuard));
        throw new Error('Неверный email или пароль');
      }

      localStorage.removeItem(LOGIN_GUARD_KEY);
      const user = { id: 1, name: 'Администратор СЕВЕР', email: ADMIN_EMAIL, role: 'admin' };
      sessionStorage.setItem(STATIC_SESSION_KEY, JSON.stringify(user));
      return { ok: true, user };
    }

    return reqJson('./api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async logout() {
    if (isStaticHost()) {
      sessionStorage.removeItem(STATIC_SESSION_KEY);
      return { ok: true };
    }
    return reqJson('./api/auth/logout', { method: 'POST' });
  },

  async getAdminOrders() {
    if (isStaticHost()) {
      const db = readStaticDb();
      return { ok: true, orders: db.orders };
    }
    return reqJson('./api/admin/orders');
  },

  async updateOrderStatus(id, status) {
    if (isStaticHost()) {
      const db = readStaticDb();
      const target = db.orders.find((o) => o.id === Number(id));
      if (!target) throw new Error('Заказ не найден');
      target.status = status;
      writeStaticDb(db);
      return { ok: true, order: target };
    }
    return reqJson(`./api/admin/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async createProduct(payload) {
    if (isStaticHost()) {
      const db = readStaticDb();
      const title = String(payload.title || '').trim();
      if (title.length < 2) throw new Error('Укажите название товара');
      const prod = {
        id: db.nextProdId++,
        slug: `item-${Date.now()}`,
        category: payload.category || 'outerwear',
        title,
        badge: String(payload.badge || '').trim(),
        price: Math.max(100, Math.round(Number(payload.price) || 1000)),
        oldPrice: Math.max(0, Math.round(Number(payload.oldPrice) || 0)),
        image: resolveAssetUrl(payload.image || './uploads/windbreaker.webp'),
        sizes: Array.isArray(payload.sizes) && payload.sizes.length ? payload.sizes : ['M', 'L'],
        stock: Math.max(0, Math.round(Number(payload.stock) || 0)),
        description: String(payload.description || title),
        specs: String(payload.specs || 'Базовая техническая комплектация')
      };
      db.products.push(prod);
      writeStaticDb(db);
      return { ok: true, product: prod };
    }
    return reqJson('./api/admin/products', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateProduct(id, payload) {
    if (isStaticHost()) {
      const db = readStaticDb();
      const prod = db.products.find((p) => p.id === Number(id));
      if (!prod) throw new Error('Товар не найден');
      if (payload.title !== undefined) prod.title = String(payload.title).trim();
      if (payload.category !== undefined) prod.category = payload.category;
      if (payload.price !== undefined) prod.price = Math.max(100, Math.round(Number(payload.price) || prod.price));
      if (payload.stock !== undefined) prod.stock = Math.max(0, Math.round(Number(payload.stock) || 0));
      if (payload.badge !== undefined) prod.badge = String(payload.badge).trim();
      writeStaticDb(db);
      return { ok: true, product: prod };
    }
    return reqJson(`./api/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async deleteProduct(id) {
    if (isStaticHost()) {
      const db = readStaticDb();
      db.products = db.products.filter((p) => p.id !== Number(id));
      writeStaticDb(db);
      return { ok: true };
    }
    return reqJson(`./api/admin/products/${id}`, { method: 'DELETE' });
  }
};
