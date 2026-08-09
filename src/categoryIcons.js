// ─── Category icons ───
// 24x24 stroke icon paths per category icon name, taken from the cartoon
// design handoff (Places App.dc.html). Used by the map legend (Vue), the
// MapLibre marker images (canvas), and the place-preview popup (HTML).
//
// Icons always accompany the category color so that color is never the
// only channel encoding a category (color-blind accessibility).

export const CATEGORY_ICON_PATHS = {
  star: 'M12 3.6l2.6 5.3 5.8.9-4.2 4.1 1 5.8L12 16.9l-5.2 2.8 1-5.8-4.2-4.1 5.8-.9Z',
  utensils: 'M7 3v6M10 3v6M8.5 9v12M8.5 9a3 3 0 0 0 3-3V3M16.5 3c2 3.5 2 7 0 10.5V21',
  glass: 'M4 5h16l-8 8-8-8ZM12 13v7M8 20h8',
  coffee: 'M4 6h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V6ZM16 8h2.2a2.6 2.6 0 0 1 0 5.2H16M3 21h14',
  brunch: 'M5 13c0-4 3-7 7-7s7 3 7 7-3 5-7 5-7-1-7-5ZM12 9.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2M3 21h18',
  burger: 'M4 9.5a8 4.5 0 0 1 16 0ZM3.5 12.5h17M4 15.5h16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z',
  bread: 'M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4l-1.6 9H6.6ZM10 10v9M14 10v9',
  music: 'M7.5 14.9a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2M10.1 17.5V6.5l8-2v3l-8 2',
  bag: 'M6 8h12l1 12H5ZM9 8V6a3 3 0 0 1 6 0v2',
  tree: 'M12 3.5 7 11h10ZM12 10.5 7.5 17.5h9ZM12 17.5V21',
  museum: 'M3.5 9 12 4.2 20.5 9ZM6.5 9v8.5M12 9v8.5M17.5 9v8.5M4 20.5h16',
  bed: 'M3 19v-9M3 13.5h11.5a4.5 4.5 0 0 1 4.5 4.5v1M7.5 7.5a2 2 0 1 0 0 4 2 2 0 0 0 0-4M2 19h20',
  pin: 'M12 21s6-5.6 6-10a6 6 0 1 0-12 0c0 4.4 6 10 6 10ZM12 8.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4',
  cross: 'M9.5 3.5h5v6h6v5h-6v6h-5v-6h-6v-5h6Z',
}

export function iconPathFor(iconName) {
  return CATEGORY_ICON_PATHS[iconName] || CATEGORY_ICON_PATHS.pin
}

/* Small inline SVG string (for HTML popups rendered inside MapLibre) */
export function categoryIconSvg(iconName, { size = 15, strokeWidth = 2.6 } = {}) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"><path d="${iconPathFor(iconName)}"></path></svg>`
}

/* Stable MapLibre image id for a category (icon + color are both encoded,
   so custom categories that share an icon but differ in color still get
   their own image). */
export function markerImageId(cat) {
  return `cat-marker|${cat?.icon || 'pin'}|${cat?.color || '#8E8E93'}`
}

/* Draw a cartoon map marker: white disc, ink outline, colored icon.
   Returns ImageData + pixelRatio, ready for map.addImage(). */
export function drawMarkerImage(iconName, color, { size = 34, pixelRatio = 2 } = {}) {
  const px = size * pixelRatio
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext('2d')
  const center = px / 2

  // White disc: soft drop shadow + gentle ring (borderless cartoon look)
  ctx.beginPath()
  ctx.arc(center, center, center - 3 * pixelRatio, 0, Math.PI * 2)
  ctx.shadowColor = 'rgba(46, 33, 64, 0.28)'
  ctx.shadowBlur = 3 * pixelRatio
  ctx.shadowOffsetY = 1.5 * pixelRatio
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.lineWidth = 1.6 * pixelRatio
  ctx.strokeStyle = 'rgba(46, 33, 64, 0.30)'
  ctx.stroke()

  // Icon, centered (24-unit viewBox)
  const span = size * 0.56 * pixelRatio
  const scale = span / 24
  ctx.save()
  ctx.translate(center - span / 2, center - span / 2)
  ctx.scale(scale, scale)
  ctx.lineWidth = 2.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.stroke(new Path2D(iconPathFor(iconName)))
  ctx.restore()

  return { imageData: ctx.getImageData(0, 0, px, px), pixelRatio }
}
