import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { buildFoldField } from './cloth-utils/fold-field.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import {
  CLOTH_WIDTH,
  createClothSim,
  applyFolds,
  driftLight,
  stepCloth,
  writeShading,
} from './cloth-utils/cloth-sim.js'

// The mesh covers the whole photo, so it sits on the page exactly where the old <img> did.
// The canvas is BLEED larger than the photo on every side so the cloth can drift toward the
// lens without being clipped; the camera is framed to match.
const FOV = 26
const BLEED = 0.08
const cameraZ = (aspect) =>
  ((CLOTH_WIDTH / aspect) * (1 + 2 * BLEED)) / (2 * Math.tan((FOV * Math.PI) / 360))

function buildGeometry(sim) {
  const { segments, rowSegs, cols, rows, n } = sim
  const geo = new THREE.BufferGeometry()

  const position = new THREE.BufferAttribute(sim.dpos, 3)
  position.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('position', position)

  const colors = new Float32Array(n * 3)
  writeShading(sim, colors)
  const color = new THREE.BufferAttribute(colors, 3)
  color.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('color', color)

  const normal = new THREE.BufferAttribute(sim.dnormals, 3)
  normal.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute('normal', normal)

  const uv = new Float32Array(n * 2)
  for (let v = 0; v < rows; v++) {
    for (let u = 0; u < cols; u++) {
      const i = v * cols + u
      uv[i * 2] = u / segments
      uv[i * 2 + 1] = 1 - v / rowSegs
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))

  const index = new Uint16Array(segments * rowSegs * 6)
  let o = 0
  for (let v = 0; v < rowSegs; v++) {
    for (let u = 0; u < segments; u++) {
      const a = v * cols + u
      const b = a + 1
      const c = a + cols
      const d = c + 1
      index[o++] = a; index[o++] = c; index[o++] = b
      index[o++] = b; index[o++] = c; index[o++] = d
    }
  }
  geo.setIndex(new THREE.BufferAttribute(index, 1))
  return geo
}

function Drape({ src, segments, speed, wind, aspect, sheen, metal, foldDepth }) {
  const texture = useLoader(THREE.TextureLoader, src)
  const maxAniso = useThree((st) => st.gl.capabilities.getMaxAnisotropy())
  const sim = useMemo(() => createClothSim(segments, aspect), [segments, aspect])
  const geometry = useMemo(() => buildGeometry(sim), [sim])

  useEffect(() => {
    // Use the photo exactly as supplied: no resampling, full-quality filtering.
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = maxAniso
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.needsUpdate = true
  }, [texture, maxAniso])

  useEffect(() => () => geometry.dispose(), [geometry])

  // Real folds: read the creases painted in the photo and build them into the cloth's shape.
  useEffect(() => {
    const field = buildFoldField(texture.image, sim.segments, sim.rowSegs)
    for (let i = 0; i < sim.n; i++) sim.fold[i] = field[i] * foldDepth
  }, [texture, sim, foldDepth])

  // Reflections: a small built-in studio room (no download), used only by the satin layer.
  const gl = useThree((st) => st.gl)
  const envMap = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = new RoomEnvironment()
    const rt = pmrem.fromScene(env, 0.04)
    pmrem.dispose()
    env.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
    return rt
  }, [gl])
  useEffect(() => () => envMap.dispose(), [envMap])

  // The satin layer: black base colour, so it adds ONLY highlights (specular, sheen, room
  // reflections) on top of the photo. Additive, so the logo's own colours are untouched.
  const satin = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0x000000,
        map: texture, // only its alpha matters here: keeps highlights strictly inside the cloth's outline
        roughness: 0.34,
        metalness: 0,
        envMap: envMap.texture,
        envMapIntensity: 0.4 * sheen,
        sheen: 0.5,
        sheenRoughness: 0.45,
        sheenColor: new THREE.Color('#ffffff'),
        // highlights follow the photo's own colours: no sheen on the dark backdrop, red-tinted on the red
        sheenColorMap: texture,
        specularColor: new THREE.Color('#ffffff'),
        specularColorMap: texture,
        anisotropy: 0.55,
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [envMap, sheen, texture],
  )
  useEffect(() => () => satin.dispose(), [satin])

  // Metallic glints: a metal layer (reflections tinted by the cloth's own colour) that is only
  // visible on fold crests, i.e. where the fold shading says the surface is turned to the light.
  const glintMat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        map: texture, // tints the metal by the cloth colour, and keeps it inside the cutout
        metalness: 1,
        roughness: 0.36,
        envMap: envMap.texture,
        envMapIntensity: 0.5 * metal,
        vertexColors: true, // the crest mask lives in the vertex colours of glintGeo
        opacity: Math.min(Math.max(metal, 0), 1), // scales the WHOLE layer (reflections and direct light), so `metal` is a true strength dial
        side: THREE.DoubleSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [envMap, metal, texture],
  )
  useEffect(() => () => glintMat.dispose(), [glintMat])
  // shares positions, normals and uvs with the cloth, but has its own colour (mask) attribute
  const glintGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', geometry.getAttribute('position'))
    g.setAttribute('normal', geometry.getAttribute('normal'))
    g.setAttribute('uv', geometry.getAttribute('uv'))
    g.setIndex(geometry.getIndex())
    const mask = new THREE.BufferAttribute(new Float32Array(sim.n * 3), 3)
    mask.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('color', mask)
    return g
  }, [geometry, sim])
  useEffect(() => () => glintGeo.dispose(), [glintGeo])

  const keyLight = useRef(null)
  const light = useMemo(() => [0, 0, 1], [])

  useFrame((_, delta) => {
    stepCloth(sim, delta, speed, wind)
    applyFolds(sim)
    driftLight(light, sim.time) // same light drives the fold shading and the satin highlights
    const pos = geometry.getAttribute('position')
    const col = geometry.getAttribute('color')
    const nor = geometry.getAttribute('normal')
    writeShading(sim, col.array, 1.35, light)
    if (keyLight.current) keyLight.current.position.set(light[0] * 6, light[1] * 6, light[2] * 6)
    // crest mask: 0 on flat cloth and in shadow, rising on surfaces turned toward the light
    const gm = glintGeo.getAttribute('color')
    for (let i = 0; i < col.array.length; i += 3) {
      const t = Math.min(Math.max((col.array[i] - 1.07) / 0.15, 0), 1)
      const m = t * t
      gm.array[i] = m
      gm.array[i + 1] = m
      gm.array[i + 2] = m
    }
    gm.needsUpdate = true
    pos.needsUpdate = true
    col.needsUpdate = true
    nor.needsUpdate = true
  })

  // frustumCulled off: the bounding sphere is computed once at rest, the cloth moves.
  return (
    <>
      <mesh geometry={geometry} frustumCulled={false}>
        <meshBasicMaterial
          map={texture}
          vertexColors
          transparent // the photo is cut out: everything outside the cloth is transparent
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <directionalLight ref={keyLight} intensity={1.5 * sheen} color="#fff1e8" />
      <mesh geometry={geometry} material={satin} frustumCulled={false} renderOrder={1} />
      <mesh geometry={glintGeo} material={glintMat} frustumCulled={false} renderOrder={2} />
    </>
  )
}

// If WebGL is unavailable or the texture fails, quietly fall back to the still image.
class Boundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

// Cursor tilt (the pointer movement from the glare-card snippet, without any glare layers):
// while the mouse is over the visible cloth it leans toward the cursor in 3D, and eases back to
// flat when the cursor leaves. Same maths as the snippet: rotateY = -(dx / 3.5), rotateX = dy / 2,
// where dx / dy are the cursor's offset from the centre in percent, times `strength`.
// The tilt is a CSS transform on a wrapper, so the cloth simulation keeps running underneath it.
function useCursorTilt(hostRef, tiltRef, src, enabled, strength) {
  useEffect(() => {
    const host = hostRef.current
    const tilt = tiltRef.current
    if (!enabled || !host || !tilt || strength <= 0) return
    if (!window.matchMedia?.('(hover: hover)').matches) return // touch screens have no hovering cursor

    // silhouette of the cloth (alpha of the cut-out photo), so only the visible fabric reacts
    let mask = null
    let mw = 0
    let mh = 0
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      try {
        mw = 128
        mh = Math.max(8, Math.round((mw * img.naturalHeight) / img.naturalWidth))
        const cv = document.createElement('canvas')
        cv.width = mw
        cv.height = mh
        const ctx = cv.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0, mw, mh)
        const d = ctx.getImageData(0, 0, mw, mh).data
        mask = new Uint8Array(mw * mh)
        for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 128 ? 1 : 0
      } catch { mask = null }
    }
    img.src = src

    const target = { x: 0, y: 0 } // rotateY, rotateX in degrees
    const cur = { x: 0, y: 0 }
    let raf = 0
    let last = 0

    const frame = (now) => {
      // time-based easing (~120 ms time constant), so it feels the same at 30, 60 or 144 fps
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 1 / 60
      last = now
      const k = 1 - Math.exp(-dt / 0.12)
      cur.x += (target.x - cur.x) * k
      cur.y += (target.y - cur.y) * k
      tilt.style.transform = `perspective(600px) rotateY(${cur.x.toFixed(3)}deg) rotateX(${cur.y.toFixed(3)}deg)`
      if (Math.abs(target.x - cur.x) < 0.005 && Math.abs(target.y - cur.y) < 0.005 && !target.x && !target.y) {
        tilt.style.transform = ''
        raf = 0
        last = 0
        return
      }
      raf = requestAnimationFrame(frame)
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame) }

    const onMove = (e) => {
      if (e.pointerType === 'touch') return
      const r = host.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      let inside = px >= 0 && px <= 1 && py >= 0 && py <= 1
      if (inside && mask) inside = mask[Math.min(mh - 1, Math.floor(py * mh)) * mw + Math.min(mw - 1, Math.floor(px * mw))] === 1
      if (!inside) { target.x = 0; target.y = 0; kick(); return }
      target.x = -((px * 100 - 50) / 3.5) * strength
      target.y = ((py * 100 - 50) / 2) * strength
      kick()
    }
    const onLeave = () => { target.x = 0; target.y = 0; kick() }

    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerleave', onLeave)
    return () => {
      cancelled = true
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
      tilt.style.transform = ''
    }
  }, [hostRef, tiltRef, src, enabled, strength])
}

/**
 * The Growzho logo cloth photo, brought to life: it hangs from its
 * top edge and moves in a light indoor breeze. Calm on purpose, a soft ripple
 * travelling through the fabric rather than a flag snapping in a gale.
 *
 * Props
 *  - src        the photo used as the texture: hero-logo.jpg resized 2x and lightly sharpened
 *               (same picture, same tilt, so it stays crisp when drawn at 2-3x pixel density)
 *  - aspect     width / height of that photo (882 / 830 for hero-logo.jpg)
 *  - stillSrc   image shown if WebGL fails or the visitor prefers reduced motion
 *  - segments   cloth resolution per side (more = finer folds, heavier)
 *  - speed      pace of the breeze pattern (1 = default)
 *  - sheen      strength of the satin highlights and reflections (1 = default, 0 = off, ~1.5 = glossy)
 *  - metal      strength of the metallic glints on the fold crests (0.04 = default, barely there; 1 = medium; 0 = off)
 *  - foldDepth  how deep the photo's creases are built into the cloth's 3D shape (world units, 0.025 = default, 0.05 = deeper, 0 = flat sheet)
 *  - tilt       how far the cloth leans toward the cursor on hover (0.2 = default, gentle; 0.4 = the glare-card snippet; 0 = off)
 *  - wind       breeze strength (1 = default, 0 = hanging still, ~2 = windy)
 */
export function ClothLogo({
  src = '/hero-logo-cutout.webp',
  stillSrc = '/hero-logo-cutout.webp',
  aspect = 882 / 830,
  alt = 'Growzho logo printed on red cloth — Scale your story',
  segments = 30,
  speed = 1,
  wind = 1,
  sheen = 0.1,
  metal = 0.2,
  foldDepth = 0.025,
  tilt = 0,
  className = '',
  style,
}) {
  const reduced = useReducedMotion()
  const hostRef = useRef(null)
  const tiltRef = useRef(null)
  useCursorTilt(hostRef, tiltRef, src, !reduced, tilt)
  const [visible, setVisible] = useState(true)

  // Stop rendering while the hero is scrolled out of view.
  useEffect(() => {
    const el = hostRef.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [reduced])

  const still = <img className={className} style={style} src={stillSrc} alt={alt} />
  if (reduced) return still

  return (
    <Boundary fallback={still}>
      <div
        ref={hostRef}
        className={`cloth ${className}`}
        style={{ ...style, aspectRatio: String(aspect) }}
        role="img"
        aria-label={alt}
      >
        <div ref={tiltRef} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
        <Canvas
          aria-hidden="true"
          frameloop={visible ? 'always' : 'never'}
          dpr={[2, 3]} // always render at >= 2x, then the browser downsamples: sharper than 1x on standard screens
          flat
          className="cloth-gl"
          camera={{ position: [0, 0, cameraZ(aspect)], fov: FOV, near: 0.1, far: 50 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          style={{ position: 'absolute', inset: `-${BLEED * 100}%`, width: 'auto', height: 'auto' }}
        >
          <Suspense fallback={null}>
            <Drape src={src} segments={segments} speed={speed} wind={wind} aspect={aspect} sheen={sheen} metal={metal} foldDepth={foldDepth} />
          </Suspense>
        </Canvas>
        </div>
      </div>
    </Boundary>
  )
}

export default ClothLogo