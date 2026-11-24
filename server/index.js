'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const { initDatabase } = require('./db');
const {
  verifyPassword,
  createSession,
  deleteSession,
  getSessionUser,
  buildCookie
} = require('./auth');
const {
  apiLimiter,
  loginLimiter,
  orderLimiter,
  applySecurityHeaders,
  verifySameOrigin,
  hardenHttpServer
} = require('./security');

const {
  initClientAccount,
  handleClientApi
} = require('./clientAccount');

const PORT = Number(process.env.PORT) || 4002;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const CLIENT_ACCOUNT_CONFIG = {
  prefix: 'sever',
  ordersTable: 'orders',
  seed: {
    name: 'Алексей Морозов',
    email: 'client@sever-wear.ru',
    phone: '+7 (916) 442-19-80',
    password: process.env.DEMO_CLIENT_PASSWORD || 'client12345',
    meta: {
      city: 'Москва',
      address: 'ПВЗ СДЭК на ул. Бауманская, 43',
      size: 'L',
      orderCodes: ['SVR-2041']
    }
  }
};

const db = initDatabase();
initClientAccount(db, CLIENT_ACCOUNT_CONFIG);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function readJson(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('Размер запроса превышает допустимый лимит'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Некорректный JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function safeJsonParse(str, fallback = []) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function mapProduct(r) {
  return {
    id: r.id,
    slug: r.slug,
    category: r.category,
    title: r.title,
    badge: r.badge || '',
    price: r.price,
    oldPrice: r.old_price || 0,
    image: r.image,
    sizes: safeJsonParse(r.sizes_json, ['One Size']),
    stock: r.stock,
    description: r.description,
    specs: r.specs,
    sortOrder: r.sort_order
  };
}

function mapOrder(r) {
  return {
    id: r.id,
    code: r.code,
    items: safeJsonParse(r.items_json, []),
    subtotal: r.subtotal,
    discount: r.discount,
    deliveryFee: r.delivery_fee,
    total: r.total,
    promoCode: r.promo_code || '',
    deliveryMethod: r.delivery_method,
    city: r.city,
    address: r.address || '',
    clientName: r.client_name,
    clientPhone: r.client_phone,
    status: r.status,
    createdAt: r.created_at
  };
}

function calcDeliveryFee(method, afterDiscount) {
  if (method === 'pickup') return 0;
  if (afterDiscount >= 7000) return 0;
  return method === 'courier' ? 490 : 350;
}

async function handleApi(req, res, parsed) {
  const method = req.method;
  const pathname = parsed.pathname;

  if (method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, service: 'sever-store' });
  }

  const rate = apiLimiter(req);
  if (!rate.allowed) {
    return sendJson(
      res,
      429,
      { ok: false, error: 'Слишком много запросов. Подождите минуту.' },
      { 'Retry-After': String(rate.retryAfterSec) }
    );
  }

  if (!verifySameOrigin(req)) {
    return sendJson(res, 403, { ok: false, error: 'Запрос отклонён политикой безопасности источника (CSRF)' });
  }

  const isSecure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const user = getSessionUser(db, req);

  if (pathname.startsWith('/api/client/')) {
    return handleClientApi(req, res, parsed, db, CLIENT_ACCOUNT_CONFIG, {
      sendJson,
      readJson,
      loginLimiter,
      isSecure
    });
  }

  if (method === 'GET' && pathname === '/api/bootstrap') {
    const products = db
      .prepare('SELECT * FROM products ORDER BY sort_order ASC, id ASC')
      .all()
      .map(mapProduct);
    return sendJson(res, 200, {
      ok: true,
      products,
      user: user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null
    });
  }

  if (method === 'GET' && pathname === '/api/orders/track') {
    const code = String(parsed.searchParams.get('code') || '').trim().toUpperCase();
    if (!/^SVR-\d{4}$/.test(code)) {
      return sendJson(res, 400, { ok: false, error: 'Укажите код заказа в формате SVR-2041' });
    }
    const row = db.prepare('SELECT * FROM orders WHERE code = ?').get(code);
    if (!row) return sendJson(res, 404, { ok: false, error: 'Заказ с таким номером не найден' });
    const mapped = mapOrder(row);
    // Do not leak full phone or full client street address publicly
    return sendJson(res, 200, {
      ok: true,
      order: {
        code: mapped.code,
        status: mapped.status,
        deliveryMethod: mapped.deliveryMethod,
        city: mapped.city,
        total: mapped.total,
        items: mapped.items,
        createdAt: mapped.createdAt
      }
    });
  }

  if (method === 'POST' && pathname === '/api/orders') {
    const oRate = orderLimiter(req);
    if (!oRate.allowed) {
      return sendJson(
        res,
        429,
        { ok: false, error: 'Превышен лимит оформления заказов. Попробуйте позже.' },
        { 'Retry-After': String(oRate.retryAfterSec) }
      );
    }

    const body = await readJson(req);
    if (String(body.website || '').trim() !== '') {
      return sendJson(res, 201, {
        ok: true,
        order: { code: `SVR-${Math.floor(1000 + Math.random() * 8999)}`, status: 'new', total: 0 }
      });
    }

    if (!body.consent) {
      return sendJson(res, 400, { ok: false, error: 'Подтвердите согласие на обработку персональных данных (152-ФЗ).' });
    }

    const clientName = String(body.clientName || '').trim().slice(0, 100);
    const clientPhone = String(body.clientPhone || '').trim().slice(0, 32);
    const city = String(body.city || '').trim().slice(0, 80);
    const address = String(body.address || '').trim().slice(0, 200);
    const deliveryMethod = ['cdek', 'courier', 'pickup'].includes(body.deliveryMethod)
      ? body.deliveryMethod
      : 'cdek';

    if (clientName.length < 2 || clientPhone.replace(/\D/g, '').length < 11) {
      return sendJson(res, 400, { ok: false, error: 'Укажите имя и корректный номер телефона (+7)' });
    }
    if (city.length < 2) {
      return sendJson(res, 400, { ok: false, error: 'Укажите город доставки' });
    }
    if (deliveryMethod !== 'pickup' && address.length < 4) {
      return sendJson(res, 400, { ok: false, error: 'Укажите адрес доставки или пункт выдачи' });
    }

    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
    if (!rawItems.length) {
      return sendJson(res, 400, { ok: false, error: 'Корзина пуста' });
    }

    const orderItems = [];
    let subtotal = 0;

    for (const item of rawItems) {
      const pid = Number(item.productId);
      const qty = Math.max(1, Math.min(20, Math.round(Number(item.qty) || 1)));
      const size = String(item.size || 'One Size').trim().slice(0, 20);
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(pid);
      if (!product) {
        return sendJson(res, 400, { ok: false, error: 'Один из товаров в корзине не найден' });
      }
      if (product.stock < qty) {
        return sendJson(res, 409, { ok: false, error: `Недостаточно товара «${product.title}» на складе` });
      }
      orderItems.push({
        productId: product.id,
        title: product.title,
        size,
        qty,
        price: product.price
      });
      subtotal += product.price * qty;
    }

    const promoCode = String(body.promoCode || '').trim().toUpperCase();
    const validPromo = promoCode === 'SEVER10' ? 'SEVER10' : '';
    const discount = validPromo ? Math.round(subtotal * 0.1) : 0;
    const afterDiscount = Math.max(0, subtotal - discount);
    const deliveryFee = calcDeliveryFee(deliveryMethod, afterDiscount);
    const total = afterDiscount + deliveryFee;

    let code = '';
    for (let i = 0; i < 6; i += 1) {
      const candidate = `SVR-${crypto.randomInt(2100, 9999)}`;
      if (!db.prepare('SELECT id FROM orders WHERE code = ?').get(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) code = `SVR-${Date.now().toString().slice(-4)}`;

    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO orders (code, items_json, subtotal, discount, delivery_fee, total, promo_code, delivery_method, city, address, client_name, client_phone, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`
      )
      .run(
        code,
        JSON.stringify(orderItems),
        subtotal,
        discount,
        deliveryFee,
        total,
        validPromo,
        deliveryMethod,
        city,
        deliveryMethod === 'pickup' ? 'Шоурум СЕВЕР, Каменноостровский пр., 14' : address,
        clientName,
        clientPhone,
        now
      );

    for (const oi of orderItems) {
      db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(oi.qty, oi.productId);
    }

    const created = db.prepare('SELECT * FROM orders WHERE id = ?').get(info.lastInsertRowid);
    return sendJson(res, 201, { ok: true, order: mapOrder(created) });
  }

  if (method === 'POST' && pathname === '/api/auth/login') {
    const lRate = loginLimiter(req);
    if (!lRate.allowed) {
      return sendJson(
        res,
        429,
        { ok: false, error: 'Слишком много неудачных попыток входа. Попробуйте позже.' },
        { 'Retry-After': String(lRate.retryAfterSec) }
      );
    }

    const body = await readJson(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    const account = db.prepare('SELECT * FROM users WHERE LOWER(email) = ?').get(email);
    if (!account || !verifyPassword(password, account.password_hash)) {
      return sendJson(res, 401, { ok: false, error: 'Неверный email или пароль' });
    }

    const token = createSession(db, account.id);
    return sendJson(
      res,
      200,
      { ok: true, user: { id: account.id, name: account.name, email: account.email, role: account.role } },
      { 'Set-Cookie': buildCookie(token, false, isSecure) }
    );
  }

  if (method === 'POST' && pathname === '/api/auth/logout') {
    if (user?.token) deleteSession(db, user.token);
    return sendJson(res, 200, { ok: true }, { 'Set-Cookie': buildCookie('', true, isSecure) });
  }

  // Protected admin endpoints
  if (pathname.startsWith('/api/admin/')) {
    if (!user || user.role !== 'admin') {
      return sendJson(res, 401, { ok: false, error: 'Требуется авторизация администратора' });
    }

    if (method === 'GET' && pathname === '/api/admin/orders') {
      const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 100').all().map(mapOrder);
      return sendJson(res, 200, { ok: true, orders });
    }

    const orderMatch = pathname.match(/^\/api\/admin\/orders\/(\d+)$/);
    if (orderMatch && method === 'PATCH') {
      const id = Number(orderMatch[1]);
      const body = await readJson(req);
      const allowed = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
      if (!allowed.includes(body.status)) {
        return sendJson(res, 400, { ok: false, error: 'Недопустимый статус заказа' });
      }
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(body.status, id);
      const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
      return sendJson(res, 200, { ok: true, order: mapOrder(updated) });
    }

    if (method === 'POST' && pathname === '/api/admin/products') {
      const body = await readJson(req);
      const title = String(body.title || '').trim().slice(0, 120);
      const category = ['outerwear', 'hoodies', 'accessories'].includes(body.category) ? body.category : 'outerwear';
      const price = Math.max(100, Math.round(Number(body.price) || 0));
      const oldPrice = Math.max(0, Math.round(Number(body.oldPrice) || 0));
      const stock = Math.max(0, Math.round(Number(body.stock) || 0));
      const badge = String(body.badge || '').trim().slice(0, 24);
      const description = String(body.description || '').trim().slice(0, 600);
      const specs = String(body.specs || '').trim().slice(0, 300);
      const image = String(body.image || '/uploads/windbreaker.webp').trim().slice(0, 240);
      const sizes = Array.isArray(body.sizes) && body.sizes.length ? body.sizes.map((s) => String(s).trim().slice(0, 16)) : ['M', 'L'];

      if (title.length < 2) {
        return sendJson(res, 400, { ok: false, error: 'Укажите название товара' });
      }

      const slug = `item-${crypto.randomBytes(4).toString('hex')}`;
      const info = db
        .prepare(
          `INSERT INTO products (slug, category, title, badge, price, old_price, image, sizes_json, stock, description, specs, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 50)`
        )
        .run(slug, category, title, badge, price, oldPrice, image, JSON.stringify(sizes), stock, description || title, specs || 'Базовая комплектация');

      const created = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
      return sendJson(res, 201, { ok: true, product: mapProduct(created) });
    }

    const prodMatch = pathname.match(/^\/api\/admin\/products\/(\d+)$/);
    if (prodMatch && method === 'PUT') {
      const id = Number(prodMatch[1]);
      const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!existing) return sendJson(res, 404, { ok: false, error: 'Товар не найден' });

      const body = await readJson(req);
      const title = body.title !== undefined ? String(body.title).trim().slice(0, 120) : existing.title;
      const category = ['outerwear', 'hoodies', 'accessories'].includes(body.category) ? body.category : existing.category;
      const price = body.price !== undefined ? Math.max(100, Math.round(Number(body.price) || existing.price)) : existing.price;
      const stock = body.stock !== undefined ? Math.max(0, Math.round(Number(body.stock) || 0)) : existing.stock;
      const badge = body.badge !== undefined ? String(body.badge).trim().slice(0, 24) : existing.badge;

      db.prepare('UPDATE products SET title = ?, category = ?, price = ?, stock = ?, badge = ? WHERE id = ?').run(
        title,
        category,
        price,
        stock,
        badge,
        id
      );
      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      return sendJson(res, 200, { ok: true, product: mapProduct(updated) });
    }

    if (prodMatch && method === 'DELETE') {
      const id = Number(prodMatch[1]);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
      return sendJson(res, 200, { ok: true });
    }
  }

  return sendJson(res, 404, { ok: false, error: 'Маршрут не найден' });
}

const server = http.createServer(async (req, res) => {
  applySecurityHeaders(res);

  try {
    const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (parsed.pathname.startsWith('/api/')) {
      return await handleApi(req, res, parsed);
    }

    const reqPath = decodeURIComponent(parsed.pathname);
    if (reqPath === '/robots.txt') {
      return serveFile(res, path.join(ROOT_DIR, 'public', 'robots.txt'));
    }
    if (reqPath.startsWith('/uploads/')) {
      const uploadTarget = path.resolve(ROOT_DIR, 'public', `.${reqPath}`);
      if (!uploadTarget.startsWith(path.resolve(ROOT_DIR, 'public', 'uploads'))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      return serveFile(res, uploadTarget);
    }

    const cleanDistPath = path.resolve(DIST_DIR, reqPath === '/' ? 'index.html' : `.${reqPath}`);
    if (!cleanDistPath.startsWith(path.resolve(DIST_DIR))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(cleanDistPath) && fs.statSync(cleanDistPath).isFile()) {
      return serveFile(res, cleanDistPath);
    }

    return serveFile(res, path.join(DIST_DIR, 'index.html'));
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err?.message || 'Внутренняя ошибка сервера' });
  }
});

hardenHttpServer(server);
server.listen(PORT, HOST, () => {
  console.log(`sever-store server running at http://${HOST}:${PORT}`);
});
