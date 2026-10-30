/* Local demonstration workflow. A status change never contacts a carrier or charges a customer. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StoreAdmin = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const labels = Object.freeze({
    new: 'Novo pedido',
    preparing: 'Em preparação',
    ready: 'Pronto',
    dispatched: 'Despachado',
    completed: 'Concluído',
    cancelled: 'Cancelado'
  });

  function status(order) {
    return order && typeof order.fulfillment === 'string' && Object.prototype.hasOwnProperty.call(labels, order.fulfillment) ? order.fulfillment : 'new';
  }

  function isDelivery(order) { return !!order && order.delivery === 'delivery'; }

  // Visibility rule for this local prototype, not server-side authorization.
  function isStoreOwner(user) {
    return !!user && !user.demo && typeof user.email === 'string' && user.email.trim().toLowerCase() === 'halvz876@gmail.com';
  }

  function transitions(order) {
    switch (status(order)) {
      case 'new': return ['preparing', 'cancelled'];
      case 'preparing': return ['ready', 'cancelled'];
      case 'ready': return [isDelivery(order) ? 'dispatched' : 'completed', 'cancelled'];
      case 'dispatched': return ['completed'];
      default: return [];
    }
  }

  function transition(order, next, now = new Date()) {
    if (!order || typeof order !== 'object' || Array.isArray(order)) throw new Error('Pedido inválido.');
    if (!transitions(order).includes(next)) throw new Error('Esta mudança de status não está disponível para o pedido.');
    const date = now instanceof Date ? now : new Date(now);
    if (!Number.isFinite(date.getTime())) throw new Error('Data de atualização inválida.');
    return { ...order, fulfillment: next, updatedAt: date.toISOString() };
  }

  function countNew(orders) {
    return Array.isArray(orders) ? orders.filter(order => order && typeof order === 'object' && !Array.isArray(order) && status(order) === 'new').length : 0;
  }

  function actionLabel(order, next) {
    if (next === 'cancelled') return 'Cancelar pedido de teste';
    if (next === 'preparing') return 'Iniciar preparação';
    if (next === 'ready') return 'Marcar pronto';
    if (next === 'dispatched') return 'Registrar despacho';
    if (next === 'completed') return isDelivery(order) ? 'Confirmar entrega' : 'Confirmar retirada';
    return 'Atualizar pedido';
  }

  return Object.freeze({ status, isDelivery, isStoreOwner, transitions, transition, countNew, labels, actionLabel });
});
