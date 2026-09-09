import * as THREE from 'three'
import { createGroundTexture, createPropSprite } from './sprites.js'
import {
  RAIN_COUNT,
  RAIN_AREA_SIZE,
  RAIN_HEIGHT,
  RAIN_SPEED,
  createRain,
  updateRain,
  createThunderEffect,
  createFlashlight,
  updateFlashlight,
} from './effects.js'

// Create the environment elements
function createEnvironment(scene, camera) {
  // === LIGHTING SYSTEM ===
  // Cinematic ambient lighting with cold blue undertones
  const ambientLight = new THREE.HemisphereLight(0x9aaea1, 0x252017, 0.8)
  scene.add(ambientLight)

  // Primary moon light - cold blue, creates main shadows
  const moonLight = new THREE.DirectionalLight(0xa8c8bd, 1.1)
  moonLight.position.set(80, 120, 40)
  moonLight.castShadow = true
  moonLight.shadow.mapSize.width = 1024
  moonLight.shadow.mapSize.height = 1024
  moonLight.shadow.camera.near = 0.5
  moonLight.shadow.camera.far = 200
  moonLight.shadow.camera.left = -100
  moonLight.shadow.camera.right = 100
  moonLight.shadow.camera.top = 100
  moonLight.shadow.camera.bottom = -100
  moonLight.shadow.bias = -0.0005
  moonLight.shadow.normalBias = 0.02
  scene.add(moonLight)

  // Rim light - subtle warm accent from opposite side
  const rimLight = new THREE.DirectionalLight(0xff6644, 0.15)
  rimLight.position.set(-60, 40, -60)
  scene.add(rimLight)

  // === GROUND SYSTEM ===
  // Create procedural ground with hex pattern (reduced segments for performance)
  const groundGeometry = new THREE.PlaneGeometry(600, 600, 80, 80)

  // Vertex displacement for organic terrain feel
  const positions = groundGeometry.attributes.position.array
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const z = positions[i + 1]
    const distFromCenter = Math.sqrt(x * x + z * z)

    // Create gentle rolling hills outside spawn
    if (distFromCenter > 25) {
      const noise = Math.sin(x * 0.05) * Math.cos(z * 0.05) * 0.5
      positions[i + 2] = noise + (Math.random() - 0.5) * 0.15
    }
  }
  groundGeometry.computeVertexNormals()

  // Modern PBR ground material
  const groundMaterial = new THREE.MeshStandardMaterial({
    map: createGroundTexture(),
    color: 0xd8ded2,
    roughness: 0.92,
    metalness: 0.08,
    envMapIntensity: 0.3,
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  ground.receiveShadow = true
  scene.add(ground)

  // Spawn ring decoration
  const spawnRingGeo = new THREE.RingGeometry(19.5, 20.5, 64)
  const spawnRingMat = new THREE.MeshBasicMaterial({
    color: 0xc7dc91,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
  })
  const spawnRing = new THREE.Mesh(spawnRingGeo, spawnRingMat)
  spawnRing.rotation.x = -Math.PI / 2
  spawnRing.position.y = 0.03
  scene.add(spawnRing)

  // === ATMOSPHERE ===
  scene.fog = new THREE.FogExp2(0x101911, 0.012)
  scene.background = new THREE.Color(0x0b120c)

  // Painted landing-zone markings and warm perimeter lamps anchor the arena.
  const paint = new THREE.MeshBasicMaterial({ color: 0xb8bc8b, transparent: true, opacity: .22 })
  const stripeGeometry = new THREE.PlaneGeometry(.3, 3)
  for (let i = 0; i < 32; i++) {
    const angle = i / 32 * Math.PI * 2
    const stripe = new THREE.Mesh(stripeGeometry, paint)
    stripe.rotation.set(-Math.PI / 2, 0, -angle)
    stripe.position.set(Math.sin(angle) * 17, .04, Math.cos(angle) * 17)
    scene.add(stripe)
  }
  const stencil = document.createElement('canvas')
  stencil.width = 512
  stencil.height = 256
  const ctx = stencil.getContext('2d')
  ctx.fillStyle = '#b8bc8b'
  ctx.textAlign = 'center'
  ctx.font = 'bold 100px monospace'
  ctx.fillText('SECTOR 07', 256, 115)
  ctx.font = '24px monospace'
  ctx.fillText('H O L D  T H E  L I N E', 256, 170)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(stencil), transparent: true, opacity: .28, depthWrite: false }))
  sign.rotation.x = -Math.PI / 2
  sign.position.set(0, .05, -6)
  scene.add(sign)
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * Math.PI / 2
    const lamp = new THREE.PointLight(0xef9b54, 18, 20, 2)
    lamp.position.set(Math.cos(angle) * 18, 3, Math.sin(angle) * 18)
    scene.add(lamp)
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.15, .25, 1.4, 8), new THREE.MeshStandardMaterial({color: 0x525745, emissive: 0xef7745, emissiveIntensity: .6}))
    beacon.position.set(lamp.position.x, .7, lamp.position.z)
    scene.add(beacon)
  }

  // Painted props form small supply stations outside the central fighting lane.
  for (let i = 0; i < 28; i++) {
    const angle = i * 2.399963
    const radius = i < 12 ? 15 + (i % 3) * 3 : 30 + (i % 7) * 6
    const prop = createPropSprite(i % 4, i % 4 === 0 ? 5 : 3.8)
    prop.position.set(Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius)
    scene.add(prop)
  }

  // Arena boundary markers (glowing pylons)
  const pylonGeo = new THREE.CylinderGeometry(0.3, 0.5, 4, 8)
  const pylonGlowColors = [0x00ffaa, 0x0088ff, 0xff4400]

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const radius = 100
    const colorIdx = i % 3

    // Pylon base
    const pylonMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.3,
      metalness: 0.8,
    })
    const pylon = new THREE.Mesh(pylonGeo, pylonMat)
    pylon.position.set(Math.cos(angle) * radius, 2, Math.sin(angle) * radius)
    scene.add(pylon)

    // Glowing top cap
    const capGeo = new THREE.SphereGeometry(0.35, 8, 8)
    const capMat = new THREE.MeshBasicMaterial({
      color: pylonGlowColors[colorIdx],
      transparent: true,
      opacity: 0.9,
    })
    const cap = new THREE.Mesh(capGeo, capMat)
    cap.position.set(Math.cos(angle) * radius, 4.2, Math.sin(angle) * radius)
    scene.add(cap)
  }

  // Create rain
  const rainParticles = createRain(scene)

  // Create flashlight
  const flashlight = createFlashlight(scene, camera)

  // Create thunder effect
  const thunder = createThunderEffect(scene)

  return {
    ground,
    ambientLight,
    moonLight,
    rimLight,
    rainParticles,
    flashlight,
    thunder,
    spawnRing,
  }
}

export { createEnvironment, updateRain }
