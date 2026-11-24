# СЕВЕР — Интернет-магазин технологичной городской одежды

Минималистичный магазин одежды и аксессуаров с каталогом, фильтрами, корзиной с расчётом доставки и промокодами (`SEVER10`), трекером статуса заказа и закрытым кабинетом управления каталогом и заказами.

- **Стек:** React 19, Vite 6, Lucide Icons, Node.js (встроенный `http` + `node:sqlite`).
- **Деплой:**
  - Статика: `npm run publish` -> ветка `gh-pages` на GitHub Pages (`localStorage`-режим без раскрытия серверных паролей).
  - Node.js + SQLite (VPS / Amvera / Timeweb Cloud): `Dockerfile` + `amvera.yml`, порт `4002`, персистентный том `/data`, healthcheck `/api/health`.
- **Безопасность:** `HttpOnly` сессии, `scrypt` + `timingSafeEqual`, rate limiting, CSRF проверка `Origin/Host`, CSP (`script-src 'self'`), honeypot `.hp-trap` + антибот-задержка, согласие 152-ФЗ, `robots.txt` против скраперов.
