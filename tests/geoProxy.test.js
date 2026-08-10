import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import geoRoutes, { _setMissingCellsDeadlineForTests } from '../server/routes/geo.js'
import { CELL_SIZE } from '../server/lib/overpassGrid.js'

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

  it('rejects an oversized nearby bbox', async () => {
    const r = await request(app).post('/api/geo/nearby').send({ south: 0, west: 0, north: 5, east: 5 })
    expect(r.status).toBe(400)
  })

  it('nearby: trims results to the requested viewport, not just the covering cell', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      elements: [
        { id: 1, lat: 50.011, lon: 4.011, tags: { amenity: 'cafe', name: 'In view' } },
        { id: 2, lat: 50.5, lon: 4.5, tags: { amenity: 'cafe', name: 'Cell padding, off screen' } },
      ],
    }), { status: 200 }))

    const bbox = { south: 50.01, west: 4.01, north: 50.012, east: 4.012 }
    const r = await request(app).post('/api/geo/nearby').send(bbox)
    expect(r.status).toBe(200)
    expect(r.body.elements.map(e => e.id)).toEqual([1])
  })

  it('nearby: coalesces concurrent requests for the same missing cell into one upstream fetch', async () => {
    let callCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++
      await new Promise((resolve) => setTimeout(resolve, 25))
      return new Response(JSON.stringify({
        elements: [{ id: 1, lat: CELL_SIZE * 0.2, lon: CELL_SIZE * 0.2, tags: { amenity: 'cafe', name: 'Test Cafe' } }],
      }), { status: 200 })
    })

    // Small bbox strictly inside a single grid cell -> exactly one cell, one key
    const bbox = { south: CELL_SIZE * 0.1, west: CELL_SIZE * 0.1, north: CELL_SIZE * 0.3, east: CELL_SIZE * 0.3 }
    const [r1, r2] = await Promise.all([
      request(app).post('/api/geo/nearby').send(bbox),
      request(app).post('/api/geo/nearby').send(bbox),
    ])
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    expect(r1.body.elements.map(e => e.id)).toEqual([1])
    expect(r2.body.elements.map(e => e.id)).toEqual([1])
    expect(callCount).toBe(1) // shared in-flight fetch, not one per concurrent request
  })

  it('nearby: answers within the deadline even if upstream never responds (returns what it has, not a hang)', async () => {
    _setMissingCellsDeadlineForTests(150) // tiny deadline so the test doesn't really sleep 12s
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {})) // never resolves
    const bbox = { south: CELL_SIZE * 5.1, west: CELL_SIZE * 5.1, north: CELL_SIZE * 5.3, east: CELL_SIZE * 5.3 }

    const start = Date.now()
    const r = await request(app).post('/api/geo/nearby').send(bbox)
    const elapsed = Date.now() - start

    expect(r.status).toBe(200)
    expect(r.body.elements).toEqual([]) // nothing settled in time -> empty, not an error
    expect(elapsed).toBeLessThan(1000) // bounded by the (test-shrunk) deadline, not the hung fetch
    _setMissingCellsDeadlineForTests(14000) // restore for any later test / real usage
  })
})
