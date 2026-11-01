import { useEffect, useRef, useState } from 'react'
import type { Group, Material } from 'three'

type Three = typeof import('three')

/** The truck's colours: a graphite cab, a pale trailer, dark glass, and the blue the cab's screen glows. */
const PAINT = {
  cab: 0x2b3342,
  cabDark: 0x12161d,
  trailer: 0xd7dde8,
  trailerTrim: 0xb4bdcc,
  glass: 0x0a0f16,
  rubber: 0x11151b,
  rim: 0x9aa4b4,
  chrome: 0xb9c2ce,
  lamp: 0xdff3ff,
  tail: 0xff3b30,
  accent: 0x3d8bff,
} as const

/**
 * The Diagnostics app's truck: a low-poly European tractor and trailer, turning slowly on a dark disc under a
 * key light that casts its shadow, a cool rim light and the sky. three.js is asked for as the app opens (its
 * import is a chunk of its own), so the cab's other screens don't carry it, and the canvas is transparent: the
 * panel's own gradient shows through. It holds still for a player who asks for less motion, and a window that
 * can't draw it leaves the panel's glow in its place.
 */
export function TruckModel() {
  const host = useRef<HTMLDivElement>(null)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    const element = host.current
    if (!element) return
    let stop: (() => void) | undefined
    let gone = false
    import('three')
      .then((three) => {
        if (gone) return
        try {
          stop = start(three, element)
        } catch {
          setUnavailable(true)
        }
      })
      .catch(() => setUnavailable(true))
    return () => {
      gone = true
      stop?.()
    }
  }, [])
  return <div ref={host} className={`truck-view${unavailable ? ' unavailable' : ''}`} aria-hidden />
}

/** Sets the scene up in `element` and starts drawing it: returns what stops it and lets everything go. */
function start(three: Three, element: HTMLElement): () => void {
  const renderer = new three.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = three.PCFSoftShadowMap
  renderer.outputColorSpace = three.SRGBColorSpace
  const canvas = renderer.domElement
  canvas.className = 'truck-canvas'
  element.appendChild(canvas)

  const scene = new three.Scene()
  const camera = new three.PerspectiveCamera(30, 1, 0.1, 200)

  const truck = buildTruck(three)
  // Turned about its own middle: the turn table is a group of its own, the truck set in it.
  const table = new three.Group()
  table.add(truck)
  scene.add(table)
  const bounds = new three.Box3().setFromObject(truck)
  const size = bounds.getSize(new three.Vector3())
  const middle = bounds.getCenter(new three.Vector3())
  const ground = -bounds.min.y
  truck.position.set(-middle.x, ground, -middle.z)

  // Far enough out that the truck fits whichever way it's turned, from above and to one side.
  const radius = Math.max(size.x, size.y, size.z) * 0.66
  const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 0.98
  camera.position.set(distance * 0.6, distance * 0.31, distance * 0.58)
  camera.lookAt(0, size.y * 0.44, 0)

  scene.add(new three.HemisphereLight(0xa9c4ff, 0x0a0d12, 0.75))
  const key = new three.DirectionalLight(0xffffff, 2.6)
  key.position.set(9, 14, 8)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -0.0008
  const shadow = key.shadow.camera
  shadow.near = 1
  shadow.far = 60
  shadow.left = -11
  shadow.right = 11
  shadow.top = 11
  shadow.bottom = -11
  scene.add(key)
  const rim = new three.DirectionalLight(0x74c8ff, 1.7)
  rim.position.set(-8, 6, -9)
  scene.add(rim)
  const fill = new three.DirectionalLight(0xffe0b8, 0.45)
  fill.position.set(-4, 3, 10)
  scene.add(fill)

  // The disc it stands on, dark enough to read as a stage under either appearance.
  const stage = new three.Mesh(
    new three.CircleGeometry(1, 64),
    new three.MeshStandardMaterial({ color: 0x0b0f15, roughness: 1, transparent: true, opacity: 0.9 }),
  )
  stage.rotation.x = -Math.PI / 2
  stage.position.y = 0.002
  stage.scale.setScalar(Math.max(size.x, size.z) * 1.2)
  stage.receiveShadow = true
  scene.add(stage)

  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let angle = -0.55
  let frame = 0
  let last = performance.now()
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw)
    const elapsed = Math.min(0.05, (now - last) / 1000)
    last = now
    if (!still) angle += elapsed * 0.26
    table.rotation.y = angle
    truck.position.y = ground + (still ? 0 : Math.sin(now / 1700) * 0.02)
    if (!document.hidden) renderer.render(scene, camera)
  }
  frame = requestAnimationFrame(draw)

  const resize = () => {
    const width = element.clientWidth
    const height = element.clientHeight
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(element)

  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    scene.traverse((object) => {
      const part = object as unknown as {
        geometry?: { dispose(): void }
        material?: { dispose(): void } | { dispose(): void }[]
      }
      part.geometry?.dispose()
      const materials = part.material
      if (Array.isArray(materials)) {
        for (const material of materials) material.dispose()
      } else {
        materials?.dispose()
      }
    })
    renderer.dispose()
    canvas.remove()
  }
}

/** The truck itself: chassis, cab, trailer and five axles, in metres like the game's own. */
function buildTruck(three: Three): Group {
  const truck = new three.Group()
  const paint = (color: number, metalness: number, roughness: number) =>
    new three.MeshStandardMaterial({ color, metalness, roughness })
  const cabPaint = paint(PAINT.cab, 0.62, 0.34)
  const dark = paint(PAINT.cabDark, 0.35, 0.62)
  const trailerPaint = paint(PAINT.trailer, 0.22, 0.58)
  const trim = paint(PAINT.trailerTrim, 0.4, 0.5)
  const glass = paint(PAINT.glass, 0.9, 0.1)
  const rubber = paint(PAINT.rubber, 0.1, 0.92)
  const rim = paint(PAINT.rim, 0.95, 0.28)
  const chrome = paint(PAINT.chrome, 1, 0.16)
  const lamp = new three.MeshStandardMaterial({
    color: PAINT.lamp,
    emissive: PAINT.lamp,
    emissiveIntensity: 2.4,
    roughness: 0.25,
  })
  const tail = new three.MeshStandardMaterial({
    color: PAINT.tail,
    emissive: PAINT.tail,
    emissiveIntensity: 1.6,
    roughness: 0.35,
  })
  const accent = new three.MeshStandardMaterial({
    color: PAINT.accent,
    emissive: PAINT.accent,
    emissiveIntensity: 0.7,
    metalness: 0.5,
    roughness: 0.3,
  })

  const block = (width: number, height: number, depth: number, material: Material, x: number, y: number, z: number) => {
    const mesh = new three.Mesh(new three.BoxGeometry(width, height, depth), material)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    mesh.receiveShadow = true
    truck.add(mesh)
    return mesh
  }

  const wheel = (x: number, z: number, twin = false) => {
    for (const side of twin ? [-0.19, 0.19] : [0]) {
      const tyre = new three.Mesh(new three.CylinderGeometry(0.53, 0.53, 0.34, 24), rubber)
      tyre.rotation.z = Math.PI / 2
      tyre.position.set(x + side, 0.53, z)
      tyre.castShadow = true
      truck.add(tyre)
      const hub = new three.Mesh(new three.CylinderGeometry(0.28, 0.28, 0.36, 20), rim)
      hub.rotation.z = Math.PI / 2
      hub.position.copy(tyre.position)
      truck.add(hub)
    }
  }

  // The chassis the cab and the trailer ride on, its fifth wheel plate and the tractor's fuel tank.
  block(1.1, 0.24, 5.6, dark, 0, 0.66, -0.6)
  block(1.42, 0.12, 1.42, dark, 0, 1.02, 0.18)
  block(0.72, 0.56, 1.5, chrome, 0.86, 0.86, -1.15)

  // The cab: flat-fronted, its windscreen raked back and its roof fairing over it.
  block(2.44, 2.1, 2.6, cabPaint, 0, 1.85, -2.45)
  block(2.3, 0.52, 1.3, cabPaint, 0, 3.14, -2.2)
  const screen = block(2.18, 1.0, 0.08, glass, 0, 2.4, -3.77)
  screen.rotation.x = -0.12
  block(0.05, 0.62, 1.0, glass, 1.225, 2.42, -2.45)
  block(0.05, 0.62, 1.0, glass, -1.225, 2.42, -2.45)
  block(1.75, 0.55, 0.09, dark, 0, 1.45, -3.79)
  block(2.42, 0.38, 0.2, chrome, 0, 0.72, -3.72)
  block(0.5, 0.2, 0.06, lamp, 0.85, 1.02, -3.83)
  block(0.5, 0.2, 0.06, lamp, -0.85, 1.02, -3.83)
  block(0.09, 0.52, 0.26, dark, 1.36, 2.55, -3.5)
  block(0.09, 0.52, 0.26, dark, -1.36, 2.55, -3.5)

  // The trailer: a pale box, its skirt and the blue line along it, the legs it stands on and its rear lights.
  block(2.55, 2.95, 7.5, trailerPaint, 0, 2.45, 3.15)
  block(2.56, 0.18, 7.5, trim, 0, 1.06, 3.15)
  block(2.57, 0.07, 7.5, accent, 0, 1.24, 3.15)
  block(2.4, 2.6, 0.05, trim, 0, 2.45, 6.92)
  block(0.16, 0.95, 0.16, chrome, 0.75, 0.55, 0.3)
  block(0.16, 0.95, 0.16, chrome, -0.75, 0.55, 0.3)
  block(0.4, 0.18, 0.06, tail, 0.95, 1.35, 6.96)
  block(0.4, 0.18, 0.06, tail, -0.95, 1.35, 6.96)

  // Two axles under the trailer, the tractor's steering pair and its twin drive axles.
  for (const z of [-2.95]) {
    for (const x of [-1.05, 1.05]) wheel(x, z)
  }
  for (const z of [-0.35, 0.75, 5.5, 6.55]) {
    for (const x of [-1.02, 1.02]) wheel(x, z, true)
  }

  return truck
}
