import { accountBalance, accountAvailableCredit, accountDebt, accountTypes } from './accounts.js';

const money = (value, currency = 'USD') => new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const dateText = value => {
  if (!value) return '';
  const d = new Date(`${value}T12:00:00`);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
};
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));

export function renderMetrics(data, currency) {
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const totals = (data.transactions || [])
    .filter(item => item.date && item.date.startsWith(currentMonthKey))
    .reduce((result, item) => {
      if (result[item.type] !== undefined) {
        result[item.type] += Number(item.amount || 0);
      }
      return result;
    }, { income: 0, expense: 0 });

  const assets = (data.accounts || [])
    .filter(item => item.type !== 'credit')
    .reduce((sum, account) => sum + accountBalance(account, data.transactions, data.transfers), 0);

  const debt = (data.accounts || [])
    .reduce((sum, account) => sum + accountDebt(account, accountBalance(account, data.transactions, data.transfers)), 0);

  const net = assets - debt;
  const savings = totals.income > 0 ? Math.max(0, (totals.income - totals.expense) / totals.income * 100) : 0;

  const balanceVal = document.querySelector('#balanceValue');
  if (balanceVal) balanceVal.textContent = money(net, currency);

  const assetsVal = document.querySelector('#assetsValue');
  if (assetsVal) assetsVal.textContent = money(assets, currency);

  const debtVal = document.querySelector('#debtValue');
  if (debtVal) debtVal.textContent = money(debt, currency);

  const savingsVal = document.querySelector('#savingsValue');
  if (savingsVal) savingsVal.textContent = `${Math.round(savings)}%`;

  const savingsProg = document.querySelector('#savingsProgress');
  if (savingsProg) savingsProg.style.width = `${Math.min(savings / 30 * 100, 100)}%`;

  const donutTotal = document.querySelector('#donutTotal');
  if (donutTotal) donutTotal.textContent = money(totals.expense, currency);
}

export function fillSelects(data, categories) {
  const accountOptions = (data.accounts || []).map(account => `<option value="${account.id}">${esc(account.name)} (${account.currency})</option>`).join('');

  ['accountFilter', 'transactionAccount', 'fromAccount', 'toAccount'].forEach(id => {
    const element = document.querySelector(`#${id}`);
    if (!element) return;
    const all = id === 'accountFilter' ? '<option value="all">Todas las cuentas</option>' : '';
    element.innerHTML = all + accountOptions;
  });

  const categorySelect = document.querySelector('#category');
  if (categorySelect) {
    categorySelect.innerHTML = categories.map(category => `<option>${esc(category)}</option>`).join('');
  }

  const categoryFilter = document.querySelector('#categoryFilter');
  if (categoryFilter) {
    categoryFilter.innerHTML = '<option value="all">Todas las categorías</option>' + categories.map(category => `<option>${esc(category)}</option>`).join('');
  }
}

export function renderAccounts(data, currency) {
  const list = document.querySelector('#accountsList');
  if (!list) return;

  list.innerHTML = (data.accounts || []).map(account => {
    const balance = accountBalance(account, data.transactions, data.transfers);
    const debt = accountDebt(account, balance);
    const available = accountAvailableCredit(account, balance);
    return `<article class="account-card" style="--account-color:${account.color || '#579f91'}"><div class="account-icon"><i class="fa-solid ${account.type === 'credit' ? 'fa-credit-card' : account.type === 'cash' ? 'fa-money-bill-wave' : account.type === 'savings' ? 'fa-piggy-bank' : 'fa-building-columns'}"></i></div><div class="account-card-top"><div><strong>${esc(account.name)}</strong><span>${accountTypes[account.type] || account.type} · ${account.currency}</span></div><button class="icon-button delete-account" data-id="${account.id}" title="Eliminar cuenta"><i class="fa-solid fa-trash-can"></i></button></div><b class="account-balance ${account.type === 'credit' ? 'debt' : ''}">${money(account.type === 'credit' ? -debt : balance, currency)}</b>${account.type === 'credit' ? `<small>Cupo disponible: ${money(available, currency)} · Corte día ${account.cutoffDay}</small>` : '<small>Saldo disponible</small>'}</article>`;
  }).join('');

  const emptyAccounts = document.querySelector('#emptyAccounts');
  if (emptyAccounts) emptyAccounts.hidden = (data.accounts || []).length > 0;
}

export function renderTransactions(items, data, onEdit, onDelete, currency) {
  const body = document.querySelector('#transactionsBody');
  if (!body) return;

  body.innerHTML = items.map(item => {
    const account = data.accounts.find(account => account.id === item.accountId);
    const destination = item.type === 'transfer' ? data.accounts.find(account => account.id === item.toAccountId) : null;
    const label = item.type === 'income' ? 'Ingreso' : item.type === 'transfer' ? 'Transferencia' : 'Egreso';
    const amountClass = item.type === 'income' ? 'amount-income' : item.type === 'transfer' ? 'amount-transfer' : 'amount-expense';
    const sign = item.type === 'income' ? '+' : item.type === 'transfer' ? '↔ ' : '-';
    const actions = item.type === 'transfer'
      ? `<button data-delete="${item.id}" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>`
      : `<button data-edit="${item.id}" title="Editar"><i class="fa-solid fa-pen"></i></button><button data-delete="${item.id}" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>`;

    return `<tr><td><strong>${esc(item.description)}</strong><small>${esc(item.category)}</small></td><td><span class="badge ${item.type}">${label}</span></td><td>${esc(account?.name || 'Cuenta eliminada')}${destination ? `<small> → ${esc(destination.name)}</small>` : ''}</td><td>${dateText(item.date)}</td><td class="align-right ${amountClass}">${sign}${money(item.amount, currency)}</td><td class="row-actions">${actions}</td></tr>`;
  }).join('');

  const emptyTrans = document.querySelector('#emptyTransactions');
  if (emptyTrans) emptyTrans.hidden = items.length > 0;

  const countEl = document.querySelector('#transactionCount');
  if (countEl) countEl.textContent = `${items.length} registro${items.length === 1 ? '' : 's'}`;

  body.querySelectorAll('[data-edit]').forEach(button => button.onclick = () => onEdit(button.dataset.edit));
  body.querySelectorAll('[data-delete]').forEach(button => button.onclick = () => onDelete(button.dataset.delete));
}

export function renderBudgets(data, currency, onDelete) {
  const month = new Date().toISOString().slice(0, 7);
  const list = document.querySelector('#budgetList');
  if (!list) return;

  list.innerHTML = (data.budgets || []).map((budget, index) => {
    const spent = (data.transactions || [])
      .filter(item => item.type === 'expense' && item.category?.toLowerCase() === budget.category?.toLowerCase() && item.date && item.date.startsWith(month))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const limit = Number(budget.limit || 0);
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;

    return `<div class="budget-item"><div class="budget-top"><strong>${esc(budget.category)}</strong><button class="icon-button" data-budget-delete="${index}" title="Eliminar"><i class="fa-solid fa-xmark"></i></button></div><div class="budget-bar"><span class="${percent >= 90 ? 'danger' : percent >= 70 ? 'warning' : ''}" style="width:${Math.min(percent, 100)}%"></span></div><div class="budget-meta"><span>${money(spent, currency)} gastado</span><span>${money(limit, currency)} límite</span></div></div>`;
  }).join('');

  const emptyBudgets = document.querySelector('#emptyBudgets');
  if (emptyBudgets) emptyBudgets.hidden = (data.budgets || []).length > 0;

  list.querySelectorAll('[data-budget-delete]').forEach(button => button.onclick = () => onDelete(Number(button.dataset.budgetDelete)));
}

export function renderLegend(entries, currency) {
  const legendEl = document.querySelector('#categoryLegend');
  if (!legendEl) return;

  const total = entries.reduce((sum, item) => sum + item[1], 0);
  legendEl.innerHTML = entries.slice(0, 5).map(([name, value], index) => `<div class="legend-item"><span class="legend-dot" style="background:${['#ef8f64','#579f91','#f2c14e','#7e9ce5','#c28bda'][index]}"></span>${esc(name)}<strong>${total ? Math.round(value / total * 100) : 0}%</strong></div>`).join('');
}

export function notify(message, icon = 'success') {
  if (window.Swal) {
    window.Swal.fire({ toast: true, position: 'bottom-end', timer: 2500, showConfirmButton: false, icon, title: message });
  } else {
    const toast = document.querySelector('#toast');
    if (toast) {
      toast.querySelector('span').textContent = message;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 2500);
    } else {
      alert(message);
    }
  }
}

export function renderMonthlyKpis(data, currency) {
  const key = new Date().toISOString().slice(0, 7);
  const totals = (data.transactions || [])
    .filter(item => item.date && item.date.startsWith(key))
    .reduce((result, item) => {
      if (result[item.type] !== undefined) {
        result[item.type] += Number(item.amount || 0);
      }
      return result;
    }, { income: 0, expense: 0 });

  const format = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  const income = document.querySelector('#incomeValue');
  const expense = document.querySelector('#expenseValue');
  if (income) income.textContent = format(totals.income);
  if (expense) expense.textContent = format(totals.expense);
}
