'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { hashPassword } = require('./auth');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'sever.db');

function initDatabase() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      badge TEXT DEFAULT '',
      price INTEGER NOT NULL,
      old_price INTEGER DEFAULT 0,
      image TEXT NOT NULL,
      sizes_json TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 10,
      description TEXT NOT NULL,
      specs TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      items_json TEXT NOT NULL,
      subtotal INTEGER NOT NULL,
      discount INTEGER NOT NULL DEFAULT 0,
      delivery_fee INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL,
      promo_code TEXT DEFAULT '',
      delivery_method TEXT NOT NULL,
      city TEXT NOT NULL,
      address TEXT DEFAULT '',
      client_name TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL
    );
  `);

  seed(db);
  return db;
}

function seed(db) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@sever-wear.ru';
  const adminPass = process.env.ADMIN_PASSWORD || 'Svr!16b0bfe0967';
  const now = new Date().toISOString();

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  if (!existingUser) {
    db.prepare(
      'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)'
    ).run('Администратор СЕВЕР', adminEmail, hashPassword(adminPass), 'admin', now);
  }

  const productCount = db.prepare('SELECT COUNT(*) AS cnt FROM products').get().cnt;
  if (productCount === 0) {
    const stmt = db.prepare(
      `INSERT INTO products (slug, category, title, badge, price, old_price, image, sizes_json, stock, description, specs, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const items = [
      [
        'storm-shell-jacket',
        'outerwear',
        'Ветровка Storm Shell',
        'ХИТ',
        12900,
        14900,
        '/uploads/windbreaker.webp',
        ['S', 'M', 'L', 'XL'],
        14,
        'Техническая городская ветровка с защитой от проливного дождя и штормового ветра. Матовая фактура, анатомический крой рукава.',
        'Трёхслойная мембрана 20 000 мм, проклеенные швы, влагозащитные молнии YKK AquaGuard.',
        1
      ],
      [
        'heavyweight-hoodie',
        'hoodies',
        'Худи Heavyweight Fleece',
        'DROP 04',
        7900,
        0,
        '/uploads/hoodie.webp',
        ['S', 'M', 'L', 'XL'],
        22,
        'Базовое плотное худи графитового оттенка из премиального хлопка. Держит форму после многократных стирок и не скатывается.',
        'Плотность 460 г/м², 100% органический хлопок, двойной объёмный капюшон, свободный крой.',
        2
      ],
      [
        'cordura-rolltop-24',
        'accessories',
        'Рюкзак Cordura 24L',
        'ТОП',
        8400,
        0,
        '/uploads/backpack.webp',
        ['One Size'],
        9,
        'Функциональный городской рюкзак с изменяемым объёмом роллтоп и усиленной защитой ноутбука.',
        'Нейлон Cordura 1000D с PU-пропиткой, отсек 16 дюймов, алюминиевая пряжка G-Hook.',
        3
      ],
      [
        'vacuum-tumbler-450',
        'accessories',
        'Термокружка Vacuum 450 ml',
        '',
        2900,
        0,
        '/uploads/tumbler.webp',
        ['One Size'],
        31,
        'Компактный термостакан для ежедневных маршрутов и автопутешествий. Помещается в стандартный подстаканник.',
        'Нержавеющая сталь 18/8, матовое порошковое покрытие, сохранение тепла до 8 часов.',
        4
      ],
      [
        'shell-lite-black',
        'outerwear',
        'Куртка Shell Lite',
        'НОВИНКА',
        10500,
        0,
        '/uploads/windbreaker.webp',
        ['S', 'M', 'L', 'XL'],
        8,
        'Лёгкая межсезонная куртка-анорак, которая компактно складывается во внутренний карман и не занимает место в рюкзаке.',
        'Рипстоп нейлон 85 г/м² с DWR-пропиткой, вес 310 г, двухсторонняя вентиляция.',
        5
      ],
      [
        'oversize-hoodie-480',
        'hoodies',
        'Худи Oversize 480 gsm',
        'ЛИМИТ',
        8500,
        9600,
        '/uploads/hoodie.webp',
        ['M', 'L', 'XL'],
        6,
        'Лимитированная серия утеплённого худи со спущенной линией плеча и потайным боковым карманом на молнии.',
        'Трикотаж 480 г/м² (хлопок 85% / полиэстер 15%), мягкий начёс, графитовый меланж.',
        6
      ]
    ];

    for (const p of items) {
      stmt.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], JSON.stringify(p[7]), p[8], p[9], p[10], p[11]);
    }
  }

  const orderCount = db.prepare('SELECT COUNT(*) AS cnt FROM orders').get().cnt;
  if (orderCount === 0) {
    const stmt = db.prepare(
      `INSERT INTO orders (code, items_json, subtotal, discount, delivery_fee, total, promo_code, delivery_method, city, address, client_name, client_phone, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    stmt.run(
      'SVR-2041',
      JSON.stringify([
        { productId: 1, title: 'Ветровка Storm Shell', size: 'L', qty: 1, price: 12900 },
        { productId: 4, title: 'Термокружка Vacuum 450 ml', size: 'One Size', qty: 1, price: 2900 }
      ]),
      15800,
      1580,
      0,
      14220,
      'SEVER10',
      'cdek',
      'Москва',
      'ПВЗ СДЭК на ул. Бауманская, 43',
      'Алексей Морозов',
      '+7 (916) 442-19-80',
      'shipped',
      now
    );

    stmt.run(
      'SVR-2042',
      JSON.stringify([
        { productId: 3, title: 'Рюкзак Cordura 24L', size: 'One Size', qty: 1, price: 8400 }
      ]),
      8400,
      0,
      0,
      8400,
      '',
      'pickup',
      'Санкт-Петербург',
      'Шоурум СЕВЕР, Каменноостровский пр., 14',
      'Илья Соколов',
      '+7 (921) 703-51-22',
      'confirmed',
      now
    );
  }
}

module.exports = { initDatabase };
