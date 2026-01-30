import * as THREE from 'three'
import SoundManager from './sound'
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
} from './effects'

// Create the environment elements
function createEnvironment(scene, camera) {
  // === LIGHTING SYSTEM ===
  // Cinematic ambient lighting with cold blue undertones
  const ambientLight = new THREE.AmbientLight(0x1a2a3a, 0.35)
  scene.add(ambientLight)

  // Primary moon light - cold blue, creates main shadows
  const moonLight = new THREE.DirectionalLight(0x4477aa, 0.6)
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
    color: 0x0a0a0f,
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
    color: 0x0a1520,
    roughness: 0.7,
    metalness: 0.3,
    emissive: 0x003344,
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
    color: 0x00ffaa,
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
  const gridHelper = new THREE.GridHelper(400, 200, 0x00334466, 0x001122)
  gridHelper.position.y = 0.01
  gridHelper.material.opacity = 0.25
  gridHelper.material.transparent = true
  scene.add(gridHelper)

  // === ATMOSPHERE ===
  scene.fog = new THREE.FogExp2(0x050812, 0.007)
  scene.background = new THREE.Color(0x020408)

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
