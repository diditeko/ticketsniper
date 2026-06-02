const BASE = '/api';

export async function fetchConfig() {
  const r = await fetch(`${BASE}/config`);
  return r.json();
}

export async function saveConfig(data) {
  const r = await fetch(`${BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function fetchProfile() {
  const r = await fetch(`${BASE}/profile`);
  return r.json();
}

export async function saveProfile(data) {
  const r = await fetch(`${BASE}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function startBot() {
  const r = await fetch(`${BASE}/bot/start`, { method: 'POST' });
  return r.json();
}

export async function stopBot() {
  const r = await fetch(`${BASE}/bot/stop`, { method: 'POST' });
  return r.json();
}

export async function checkSession() {
  const r = await fetch(`${BASE}/session/check`);
  return r.json();
}

export async function fetchStatus() {
  const r = await fetch(`${BASE}/status`);
  return r.json();
}
