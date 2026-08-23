import { createId } from './storage.js';

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function monthTotals(transactions = [], date = new Date()) {
  const key = monthKey(date);
  return transactions
    .filter(item => item.date && item.date.startsWith(key))
    .reduce((result, item) => {
      if (result[item.type] !== undefined) {
        result[item.type] += Number(item.amount || 0);
      }
      return result;
    }, { income: 0, expense: 0 });
}

function currentAccountBalanceForValidation(data, accountId, editingId) {
  const account = data.accounts.find(item => item.id === accountId);
  if (!account) return 0;

  const movement = data.transactions
    .filter(item => item.accountId === accountId && item.id !== editingId)
    .reduce((sum, item) => sum + (item.type === 'income' ? Number(item.amount || 0) : -Number(item.amount || 0)), 0);

  const transferIn = (data.transfers || [])
    .filter(item => item.toAccountId === accountId)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const transferOut = (data.transfers || [])
    .filter(item => item.fromAccountId === accountId)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return Number(account.initialBalance || 0) + movement + transferIn - transferOut;
}

export function validateTransaction(data, input, editingId = null) {
  if (!input.description || !input.description.trim()) return 'La descripción es obligatoria.';
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 'El monto debe ser mayor que cero.';
  if (!input.accountId || !data.accounts.some(account => account.id === input.accountId)) return 'Selecciona una cuenta válida.';
  if (!input.category || !input.category.trim()) return 'Selecciona una categoría.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(new Date(`${input.date}T12:00:00`).getTime())) return 'La fecha no es válida.';

  const account = data.accounts.find(item => item.id === input.accountId);
  if (input.type === 'expense') {
    const balance = currentAccountBalanceForValidation(data, account.id, editingId);
    if (account.type === 'credit') {
      const debt = Math.max(0, -balance);
      if (debt + input.amount > account.creditLimit) {
        return 'El egreso supera el cupo disponible de la tarjeta de crédito.';
      }
    } else {
      if (balance < input.amount) {
        return 'Fondos insuficientes en la cuenta seleccionada.';
      }
    }
  }

  return '';
}

export function addTransaction(data, input, editingId = null) {
  const transaction = {
    id: editingId || createId('transaction'),
    type: input.type,
    description: input.description.trim(),
    amount: Number(input.amount),
    accountId: input.accountId,
    category: input.category.trim(),
    date: input.date
  };

  if (editingId) {
    data.transactions = data.transactions.map(item => item.id === editingId ? transaction : item);
  } else {
    data.transactions.push(transaction);
  }

  return transaction;
}

export function filterTransactions(data, filters) {
  const transferRows = (data.transfers || []).map(transfer => ({
    ...transfer,
    type: 'transfer',
    accountId: transfer.fromAccountId,
    category: 'Transferencia'
  }));

  const records = [...(data.transactions || []), ...transferRows];
  const text = (filters.search || '').trim().toLowerCase();

  const result = records.filter(item => {
    const fromAcc = data.accounts.find(a => a.id === item.accountId)?.name || '';
    const toAcc = item.toAccountId ? (data.accounts.find(a => a.id === item.toAccountId)?.name || '') : '';
    const matchesText = !text || `${item.description} ${item.category} ${fromAcc} ${toAcc}`.toLowerCase().includes(text);

    const matchesType = filters.type === 'all' || item.type === filters.type;
    const matchesAccount = filters.account === 'all' || item.accountId === filters.account || (item.type === 'transfer' && item.toAccountId === filters.account);
    const matchesCategory = filters.category === 'all' || item.category === filters.category;
    const matchesFrom = !filters.from || item.date >= filters.from;
    const matchesTo = !filters.to || item.date <= filters.to;

    return matchesText && matchesType && matchesAccount && matchesCategory && matchesFrom && matchesTo;
  });

  return result.sort((a, b) => {
    if (filters.sort === 'date-asc') return a.date.localeCompare(b.date);
    if (filters.sort === 'amount-desc') return b.amount - a.amount;
    if (filters.sort === 'amount-asc') return a.amount - b.amount;
    return b.date.localeCompare(a.date);
  });
}
