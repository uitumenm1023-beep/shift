const KEY = "timeshift_auth";

export function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

export function setAuth(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
}

export function getToken() {
  const a = getAuth();
  return a?.token || null;
}

export function getUser() {
  const a = getAuth();
  return a?.user || null;
}