const API_BASE = '/api'

function getToken() {
  return localStorage.getItem('pinna-token')
}

function getRefreshToken() {
  return localStorage.getItem('pinna-refresh-token')
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('pinna-token', token)
  } else {
    localStorage.removeItem('pinna-token')
  }
}

export function setRefreshToken(token) {
  if (token) {
    localStorage.setItem('pinna-refresh-token', token)
  } else {
    localStorage.removeItem('pinna-refresh-token')
  }
}

let refreshPromise = null

async function tryRefresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false

  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).then(async (res) => {
      refreshPromise = null
      if (!res.ok) return false
      const data = await res.json()
      setToken(data.token)
      return true
    }).catch(() => {
      refreshPromise = null
      return false
    })
  }

  return refreshPromise
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...options.headers }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401 && !path.includes('/auth/refresh')) {
    const refreshed = await tryRefresh()
    if (refreshed) {
      headers.Authorization = `Bearer ${getToken()}`
      res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    }
  }

  if (res.status === 401) {
    setToken(null)
    setRefreshToken(null)
    window.dispatchEvent(new Event('auth:logout'))
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Request failed: ${res.status}`)
  }

  return res.json()
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
