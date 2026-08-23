import { createId } from './storage.js';

export const accountTypes = {
  cash: 'Efectivo',
  bank: 'Banco / Débito',
  credit: 'Tarjeta de crédito',
  savings: 'Ahorro'
};

export function accountBalance(account, transactions = [], transfers = []) {
  if (!account) return 0;
  const movement = transactions
    .filter(item => item.accountId === account.id)
    .reduce((sum, item) => sum + (item.type === 'income' ? Number(item.amount || 0) : -Number(item.amount || 0)), 0);
  const transferIn = transfers
    .filter(item => item.toAccountId === account.id)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const transferOut = transfers
    .filter(item => item.fromAccountId === account.id)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return Number(account.initialBalance || 0) + movement + transferIn - transferOut;
}

export function accountDebt(account, balance) {
  return account.type === 'credit' ? Math.max(0, -balance) : 0;
}

export function accountAvailableCredit(account, balance) {
  return account.type === 'credit' ? Math.max(0, Number(account.creditLimit || 0) - accountDebt(account, balance)) : null;
}

export function accountAssets(accounts = [], transactions = [], transfers = []) {
  return accounts
    .filter(account => account.type !== 'credit')
    .reduce((sum, account) => sum + accountBalance(account, transactions, transfers), 0);
}

export function totalDebt(accounts = [], transactions = [], transfers = []) {
  return accounts
    .reduce((sum, account) => sum + accountDebt(account, accountBalance(account, transactions, transfers)), 0);
}

export function netWorth(accounts = [], transactions = [], transfers = []) {
  return accountAssets(accounts, transactions, transfers) - totalDebt(accounts, transactions, transfers);
}

export function validateAccount(input) {
  if (!input.name || !input.name.trim()) return 'El nombre de la cuenta es obligatorio.';
  if (!Number.isFinite(input.initialBalance) || input.initialBalance < 0) return 'El saldo inicial no puede ser negativo.';
  if (input.type === 'credit' && (!Number.isFinite(input.creditLimit) || input.creditLimit <= 0)) return 'Una tarjeta necesita un cupo mayor que cero.';
  return '';
}

export function addAccount(data, input) {
  const account = {
    ...input,
    id: createId('account'),
    name: input.name.trim(),
    initialBalance: Number(input.initialBalance || 0),
    creditLimit: Number(input.creditLimit || 0),
    cutoffDay: Number(input.cutoffDay || 1),
    paymentDay: Number(input.paymentDay || 1)
  };
  data.accounts.push(account);
  return account;
}

export function validateTransfer(data, fromId, toId, amount) {
  if (!fromId || !toId || fromId === toId) return 'Selecciona dos cuentas diferentes.';
  if (!Number.isFinite(amount) || amount <= 0) return 'El monto debe ser mayor que cero.';

  const from = data.accounts.find(account => account.id === fromId);
  const to = data.accounts.find(account => account.id === toId);
  if (!from) return 'La cuenta de origen no existe.';
  if (!to) return 'La cuenta de destino no existe.';

  const balance = accountBalance(from, data.transactions, data.transfers);
  if (from.type !== 'credit' && balance < amount) return 'Fondos insuficientes en la cuenta de origen.';
  if (from.type === 'credit' && accountDebt(from, balance) + amount > from.creditLimit) return 'La transferencia supera el cupo disponible.';
  return '';
}

export function addTransfer(data, input) {
  const transfer = {
    id: createId('transfer'),
    fromAccountId: input.fromAccountId,
    toAccountId: input.toAccountId,
    amount: Number(input.amount),
    description: input.description?.trim() || 'Transferencia interna',
    date: input.date || new Date().toISOString().slice(0, 10)
  };
  data.transfers.push(transfer);
  return transfer;
}
