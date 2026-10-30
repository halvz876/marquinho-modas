(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StoreCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_QUANTITY = 10;
  const VALID_DDDS = new Set(('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99').split(' '));
  const text = value => typeof value === 'string' ? value.trim() : '';
  const digits = value => text(value).replace(/\D/g, '');
  const comparison = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  function money(cents) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number.isSafeInteger(cents) ? cents : 0) / 100);
  }

  function normalizeEmail(value) { return text(value).toLowerCase(); }

  function normalizePhone(value) {
    const phone = digits(value);
    return (phone.length === 12 || phone.length === 13) && phone.startsWith('55') ? phone.slice(2) : phone;
  }

  function validateProfile(profile, requirePassword = true) {
    const source = profile && typeof profile === 'object' ? profile : {};
    const errors = {};
    const name = text(source.name);
    const email = normalizeEmail(source.email);
    const phone = normalizePhone(source.phone);
    if (name.length < 3 || name.length > 100) errors.name = 'Informe seu nome, entre 3 e 100 caracteres.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Informe um e-mail válido.';
    if (!/^\d{2}9\d{8}$/.test(phone) || !VALID_DDDS.has(phone.slice(0, 2))) errors.phone = 'Informe um celular com DDD válido e 11 dígitos.';
    if (requirePassword && (typeof source.password !== 'string' || source.password.length < 8 || source.password.length > 128)) errors.password = 'Use uma senha de 8 a 128 caracteres.';
    return errors;
  }

  function productMap(products) {
    return new Map((Array.isArray(products) ? products : []).filter(p => p && typeof p.id === 'string' && Number.isSafeInteger(p.price) && p.price >= 0 && Array.isArray(p.sizes)).map(p => [p.id, p]));
  }

  // Only identity, size and quantity are trusted after catalog validation. Prices
  // always come from the catalog, never from a persisted cart snapshot.
  function sanitizeCart(raw, products) {
    if (!Array.isArray(raw)) return [];
    const catalog = productMap(products);
    const result = [];
    for (const line of raw) {
      if (!line || typeof line !== 'object') continue;
      const product = catalog.get(line.id);
      if (!product || !product.sizes.includes(line.size) || !Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QUANTITY) continue;
      const existing = result.find(item => item.id === line.id && item.size === line.size);
      if (existing) existing.qty = Math.min(MAX_QUANTITY, existing.qty + line.qty);
      else result.push({ id: product.id, size: line.size, qty: line.qty });
    }
    return result;
  }

  function cartTotals(cart, products, delivery = 'pickup') {
    const catalog = productMap(products);
    const valid = sanitizeCart(cart, products);
    const quantity = valid.reduce((sum, line) => sum + line.qty, 0);
    const subtotal = valid.reduce((sum, line) => sum + catalog.get(line.id).price * line.qty, 0);
    const shipping = quantity && delivery === 'delivery' ? 1500 : 0;
    return { quantity, subtotal, shipping, total: subtotal + shipping };
  }

  function addItem(cart, products, id, size) {
    const product = productMap(products).get(id);
    if (!product) throw new Error('Produto indisponível.');
    if (!product.sizes.includes(size)) throw new Error('Escolha um tamanho disponível.');
    const result = sanitizeCart(cart, products);
    const existing = result.find(line => line.id === id && line.size === size);
    if (existing) {
      if (existing.qty >= MAX_QUANTITY) throw new Error('O limite é de 10 unidades por tamanho nesta demonstração.');
      existing.qty += 1;
    } else result.push({ id, size, qty: 1 });
    return result;
  }

  function changeQuantity(cart, products, id, size, delta) {
    const result = sanitizeCart(cart, products);
    if (!Number.isSafeInteger(delta)) throw new Error('Quantidade inválida.');
    const index = result.findIndex(line => line.id === id && line.size === size);
    if (index < 0) return result;
    const quantity = result[index].qty + delta;
    if (quantity > MAX_QUANTITY) throw new Error('O limite é de 10 unidades por tamanho nesta demonstração.');
    if (quantity <= 0) result.splice(index, 1);
    else result[index].qty = quantity;
    return result;
  }

  function safeRead(storage, key, fallback) {
    try {
      const saved = storage.getItem(key);
      return saved === null ? fallback : JSON.parse(saved);
    } catch (_) { return fallback; }
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  }

  function checkoutErrors({ cart, products, user, delivery, address } = {}) {
    const errors = {};
    if (!sanitizeCart(cart, products).length) errors.cart = 'Sua sacola está vazia.';
    if (!user || typeof user !== 'object' || !text(user.id) || !text(user.name)) errors.user = 'Entre ou crie um perfil para continuar.';
    if (!['pickup', 'delivery'].includes(delivery)) errors.delivery = 'Escolha uma forma de recebimento.';
    if (delivery === 'delivery') {
      const a = address && typeof address === 'object' ? address : {};
      const cep = digits(a.cep);
      if (cep.length !== 8) errors.cep = 'Informe um CEP com 8 dígitos.';
      else if (a.validatedCep !== cep) errors.cep = 'Consulte e confirme o CEP antes de continuar.';
      if (comparison(a.city) !== 'franca' || text(a.state).toUpperCase() !== 'SP') errors.city = 'A entrega demonstrativa atende somente Franca, SP.';
      if (text(a.street).length < 3 || text(a.street).length > 150) errors.street = 'Informe a rua do endereço.';
      if (!text(a.number) || text(a.number).length > 20) errors.number = 'Informe o número ou S/N.';
      if (text(a.neighborhood).length < 2 || text(a.neighborhood).length > 100) errors.neighborhood = 'Informe o bairro.';
    }
    return errors;
  }

  return Object.freeze({ money, normalizeEmail, normalizePhone, validateProfile, sanitizeCart, cartTotals, addItem, changeQuantity, safeRead, escapeHTML, checkoutErrors });
});
