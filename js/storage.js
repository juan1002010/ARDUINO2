const STORAGE_KEY = 'finora_finance_v3';
const LEGACY_KEYS = ['finora_data_v1', 'finora_data_v2'];
export const categories = ['Alimentación', 'Vivienda', 'Transporte', 'Ocio', 'Salud', 'Suscripciones', 'Salario', 'Freelance', 'Educación', 'Otros'];
export function emptyData() { return { accounts: [], transactions: [], transfers: [], budgets: [], settings: { baseCurrency: 'USD' } }; }
export function loadData() { try { LEGACY_KEYS.forEach(key => localStorage.removeItem(key)); const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); if (saved) return { ...emptyData(), ...saved }; } catch (error) { console.warn('No se pudo leer el almacenamiento local.', error); } const data = emptyData(); saveData(data); return data; }
export function saveData(data) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
export function createId(prefix = 'id') { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
export function downloadFile(content, fileName, type) { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url); }
