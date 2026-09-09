import * as THREE from 'three'
import SoundManager from '../services/sound.js'
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
    color: 0x202720,
    roughness: 0.92,
    metalness: 0.08,
    envMapIntensity: 0.3,
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  ground.receiveShadow = true
  scene.add(ground)

  // Spawn platform - glowing safe zone indicator
  const spawnPlatformGeo = new THREE.CircleGeometry(20, 64)
  const spawnPlatformMat = new THREE.MeshStandardMaterial({
    color: 0x202a23,
    roughness: 0.7,
    metalness: 0.3,
    emissive: 0x29341d,
    emissiveIntensity: 0.15,
  })
  const spawnPlatform = new THREE.Mesh(spawnPlatformGeo, spawnPlatformMat)
  spawnPlatform.rotation.x = -Math.PI / 2
  spawnPlatform.position.y = 0.02
  spawnPlatform.receiveShadow = true
  scene.add(spawnPlatform)

  // Spawn ring decoration
  const spawnRingGeo = new THREE.RingGeometry(19.5, 20.5, 64)
  const spawnRingMat = new THREE.MeshBasicMaterial({
    color: 0xc7dc91,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  })
  const spawnRing = new THREE.Mesh(spawnRingGeo, spawnRingMat)
  spawnRing.rotation.x = -Math.PI / 2
  spawnRing.position.y = 0.03
  scene.add(spawnRing)

  // === GRID SYSTEM ===
  // Subtle tech grid
  const gridHelper = new THREE.GridHelper(400, 100, 0x536346, 0x35432e)
  gridHelper.position.y = 0.01
  gridHelper.material.opacity = 0.25
  gridHelper.material.transparent = true
  scene.add(gridHelper)

  // === ATMOSPHERE ===
  scene.fog = new THREE.FogExp2(0x101911, 0.012)
  scene.background = new THREE.Color(0x0b120c)

  // Painted landing-zone markings and warm perimeter lamps anchor the arena.
  const paint = new THREE.MeshBasicMaterial({ color: 0xb8bc8b, transparent: true, opacity: .35 })
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

  // === ENVIRONMENTAL PROPS ===
  // Scattered tech debris
  const debrisTypes = [
    { geo: new THREE.BoxGeometry(0.4, 0.2, 0.6), color: 0x222228 },
    { geo: new THREE.CylinderGeometry(0.15, 0.2, 0.5, 6), color: 0x1a1a20 },
    { geo: new THREE.OctahedronGeometry(0.25), color: 0x282830 },
  ]

  for (let i = 0; i < 40; i++) {
    const type = debrisTypes[Math.floor(Math.random() * debrisTypes.length)]
    const debrisMat = new THREE.MeshStandardMaterial({
      color: type.color,
      roughness: 0.85,
      metalness: 0.2,
    })
    const debris = new THREE.Mesh(type.geo, debrisMat)
    const angle = Math.random() * Math.PI * 2
    const radius = 25 + Math.random() * 100
    debris.position.set(
      Math.cos(angle) * radius,
      0.1 + Math.random() * 0.1,
      Math.sin(angle) * radius,
    )
    debris.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI * 0.3,
    )
    debris.scale.setScalar(0.6 + Math.random() * 1.2)
    debris.receiveShadow = true
    scene.add(debris)
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
    gridHelper,
    rainParticles,
    flashlight,
    thunder,
    spawnRing,
  }
}

export { createEnvironment, updateRain }
