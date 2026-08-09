import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import geoRoutes from '../server/routes/geo.js'

vi.mock('../server/middleware/auth.js', () => ({
  authenticate: (req, _res, next) => { req.userId = 'test-user'; next() },
}))

describe('geo proxy', () => {
  let app

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/api/geo', geoRoutes())
  })

  afterEach(() => vi.restoreAllMocks())

  it('proxies nominatim search and caches the result', async () => {
    const payload = [{ display_name: 'Brussels' }]
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 })
    )
    const r1 = await request(app).get('/api/geo/search?q=brussels&format=json')
    expect(r1.status).toBe(200)
    expect(r1.body).toEqual(payload)
    expect(r1.headers['x-geo-cache']).toBe('miss')

    const r2 = await request(app).get('/api/geo/search?q=brussels&format=json')
    expect(r2.headers['x-geo-cache']).toBe('hit')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid overpass payloads', async () => {
    const r = await request(app).post('/api/geo/overpass').send({ data: 123 })
    expect(r.status).toBe(400)
  })

  it('rejects malformed route coordinates', async () => {
    const r = await request(app).get('/api/geo/route/evil$string')
    expect(r.status).toBe(400)
  })

  it('answers 502 when upstream is down', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'))
    const r = await request(app).get('/api/geo/search?q=x&format=json')
    expect(r.status).toBe(502)
  })
})
