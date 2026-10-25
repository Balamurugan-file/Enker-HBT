const API_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';
const TOKEN_KEY = 'habit-tracker-token';
const USER_KEY = 'habit-tracker-user';

export function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
function saveAuth(result) {
  if (!result?.ok || !result.token) throw new Error(result?.error || 'Authentication failed.');
  localStorage.setItem(TOKEN_KEY, result.token);
  localStorage.setItem(USER_KEY, JSON.stringify(result.user));
  window.dispatchEvent(new Event('auth-changed'));
  return result;
}
async function post(action, payload = {}) {
  if (!API_URL || API_URL.includes('YOUR_DEPLOYMENT_ID')) {
    throw new Error('Google Apps Script URL is missing. Configure your .env file and restart Vite.');
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {'Content-Type':'text/plain;charset=utf-8'},
    body: JSON.stringify({action, ...payload})
  });
  if (!response.ok) throw new Error(`Server request failed (${response.status}).`);
  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'Request failed.');
  return result;
}
export async function registerAccount({name,email,password}) {
  return saveAuth(await post('register',{name,email,password}));
}
export async function loginAccount({email,password}) {
  return saveAuth(await post('login',{email,password}));
}
export async function logoutAccount() {
  const token = getToken();
  // Sign out locally immediately; invalidate the server session in the background.
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event('auth-changed'));
  if (token) post('logout', { token }).catch(() => {});
}
async function request(action,payload={}) {
  const token = getToken();
  if (!token) throw new Error('Please sign in to continue.');
  if (!API_URL) throw new Error('Google Apps Script URL is not configured.');
  if (action === 'get') {
    const url = new URL(API_URL);
    url.searchParams.set('action','get');
    url.searchParams.set('token',token);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Google Sheets request failed (${response.status}).`);
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || 'Unable to load data.');
    return result;
  }
  return post(action,{...payload,token});
}
export async function loadState() {
  const result = await request('get');
  return {...result.data,connected:true};
}
export async function saveState(state) {
  const result = await request('save',{data:{habits:state.habits,entries:state.entries,months:state.months}});
  return Boolean(result.ok);
}
export async function deleteHabitRemote(id) {
  const result = await request('deleteHabit',{id});
  return Boolean(result.ok);
}

export async function saveStatus({habitId, habitName, date, status}) {
  const result = await request('setStatus', {habitId, habitName, date, status});
  return Boolean(result.ok);
}
