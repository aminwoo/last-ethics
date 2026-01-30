import * as THREE from 'three'
import SoundManager from './sound'

// Screen shake constants
const SCREEN_SHAKE_DECAY = 0.9

// Screen shake settings
const screenShake = {
  trauma: 0,
  decay: SCREEN_SHAKE_DECAY,
  maxOffset: 1.0,
}

// Rain constants - reduced for better performance
const RAIN_COUNT = 3000 // Rain particle count
const RAIN_AREA_SIZE = 120 // Tighter rain around player
const RAIN_HEIGHT = 50
const RAIN_SPEED = 0.25 // Rain fall speed

// Thunder variables and constants
let thunderLight
let isThundering = false
const minThunderInterval = 5000 // Minimum time between thunders (ms)
const maxThunderInterval = 15000 // Maximum time between thunders (ms)

// Apply screen shake effect
function applyScreenShake(intensity) {
  // Add trauma based on weapon intensity
  screenShake.trauma = Math.min(1.0, screenShake.trauma + intensity)
}

// Update the screen shake for each frame
function updateScreenShake(camera) {
  if (screenShake.trauma > 0) {
    const shake = screenShake.trauma * screenShake.trauma
    const angle = Math.random() * Math.PI * 2
    const offsetX = Math.cos(angle) * shake * screenShake.maxOffset
    const offsetZ = Math.sin(angle) * shake * screenShake.maxOffset

    camera.position.x += offsetX
    camera.position.z += offsetZ

    screenShake.trauma *= screenShake.decay
    if (screenShake.trauma < 0.01) screenShake.trauma = 0
  }
}

// Screen flash effect when player takes damage
function showDamageFlash() {
  const damageFlash = document.getElementById('damage-flash')
  if (!damageFlash) return

  // Setup flash styles
  damageFlash.style.backgroundColor = 'rgba(255, 0, 0, 0.3)'
  damageFlash.style.opacity = '1'
  damageFlash.style.pointerEvents = 'none'
  damageFlash.style.position = 'absolute'
  damageFlash.style.top = '0'
  damageFlash.style.left = '0'
  damageFlash.style.width = '100%'
  damageFlash.style.height = '100%'
  damageFlash.style.zIndex = '1000'
  damageFlash.style.transition = 'opacity 0.5s ease-out'

  // Show flash
  setTimeout(() => {
    damageFlash.style.opacity = '0'
  }, 100)
}

// Create flashlight
function createFlashlight(scene, camera) {
  // Create a group to hold the flashlight and its target
  const flashlightGroup = new THREE.Group()

  // Create the flashlight target
  const flashlightTarget = new THREE.Object3D()
  flashlightTarget.position.set(0, 0, -5)
  flashlightGroup.add(flashlightTarget)
  scene.add(flashlightTarget) // Target needs to be in the scene for the spotlight to work

  // Create the flashlight
  const flashlight = new THREE.SpotLight(0xffffff, 75, 35, Math.PI / 7, 0.5, 1)
  flashlight.position.set(0, 1.5, 0)
  flashlight.target = flashlightTarget
  flashlight.castShadow = true

  // Configure shadows (reduced for performance)
  flashlight.shadow.mapSize.width = 512
  flashlight.shadow.mapSize.height = 512
  flashlight.shadow.camera.near = 0.5
  flashlight.shadow.camera.far = 30

  // Add the flashlight to the group
  flashlightGroup.add(flashlight)

  // Add a small point light at the flashlight position to create a glow effect
  const flashlightGlow = new THREE.PointLight(0xffffcc, 1.5, 2)
  flashlightGlow.position.copy(flashlight.position)
  flashlightGroup.add(flashlightGlow)

  // Add the group to the scene
  scene.add(flashlightGroup)

  return {
    group: flashlightGroup,
    light: flashlight,
    target: flashlightTarget,
    glow: flashlightGlow,
    camera: camera, // Add camera reference for raycasting
  }
}

function updateFlashlight(flashlight, player, direction) {
  // Update flashlight position to match player
  flashlight.group.position.copy(player.position)

  // Position flashlight target in front of player based on direction
  const targetDistance = 10
  const targetDirection = direction.clone() // Clone to avoid modifying the original
  flashlight.target.position
    .copy(player.position)
    .add(targetDirection.multiplyScalar(targetDistance))

  // Update flashlight and glow position relative to player
  flashlight.light.position.set(0, 1.5, 0)
  flashlight.glow.position.copy(flashlight.light.position)

  // Get the flashlight state from gameState
  const flashlightOn = player.userData.flashlightOn

  // Set the intensity based on the flashlight state
  const targetIntensity = flashlightOn ? 75 : 0
  const targetGlowIntensity = flashlightOn ? 1.5 : 0

  // Apply intensities
  flashlight.light.intensity = targetIntensity
  flashlight.glow.intensity = targetGlowIntensity
}

// Create rain particles
function createRain(scene) {
  const rainGeometry = new THREE.BufferGeometry()
  const rainVertices = []
  const rainVelocities = []

  for (let i = 0; i < RAIN_COUNT; i++) {
    // Random position within the rain area
    const x = Math.random() * RAIN_AREA_SIZE - RAIN_AREA_SIZE / 2
    const z = Math.random() * RAIN_AREA_SIZE - RAIN_AREA_SIZE / 2
    const y = Math.random() * RAIN_HEIGHT

    // Start and end points of the droplet (small vertical line)
    rainVertices.push(x, y, z)
    rainVertices.push(x, y - 0.5, z)

    // Velocity for the raindrops (mostly downward)
    rainVelocities.push(
      (Math.random() - 0.5) * 0.02,
      -RAIN_SPEED - Math.random() * 0.1,
      (Math.random() - 0.5) * 0.02,
    )
  }

  rainGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(rainVertices, 3),
  )

  // Create an enhanced rain material with better visibility
  const rainMaterial = new THREE.LineBasicMaterial({
    color: 0x99bbdd,
    transparent: true,
    opacity: 0.6,
    linewidth: 1,
    fog: false, // Disable fog so rain is always visible
  })

  // Create rain mesh
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial)
  scene.add(rain)

  // Store rain data for animation
  return {
    mesh: rain,
    velocities: rainVelocities,
    positions: rain.geometry.attributes.position.array,
  }
}

// Update rain particles - optimized with batch processing
function updateRain(rainParticles, playerPosition) {
  const positions = rainParticles.positions
  const velocities = rainParticles.velocities
  const playerX = playerPosition.x
  const playerZ = playerPosition.z
  const halfArea = RAIN_AREA_SIZE * 0.5

  // Process rain in batches for better cache performance
  for (let i = 0; i < RAIN_COUNT; i++) {
    const idx = i * 6 // 2 points per raindrop, 3 values (x,y,z) per point
    const vidx = i * 3 // 3 velocity values per raindrop

    // Cache velocity values
    const vx = velocities[vidx]
    const vy = velocities[vidx + 1]
    const vz = velocities[vidx + 2]

    // Update positions with velocity
    positions[idx] += vx
    positions[idx + 1] += vy
    positions[idx + 2] += vz

    positions[idx + 3] += vx
    positions[idx + 4] += vy
    positions[idx + 5] += vz

    // Reset raindrop if it hits the ground
    if (positions[idx + 1] < 0) {
      // Random position within the rain area, centered on player
      const newX = playerX + Math.random() * RAIN_AREA_SIZE - halfArea
      const newZ = playerZ + Math.random() * RAIN_AREA_SIZE - halfArea

      positions[idx] = newX
      positions[idx + 1] = RAIN_HEIGHT
      positions[idx + 2] = newZ

      // End point of the line
      positions[idx + 3] = newX
      positions[idx + 4] = RAIN_HEIGHT - 0.5
      positions[idx + 5] = newZ
    }
  }

  // Update the geometry
  rainParticles.mesh.geometry.attributes.position.needsUpdate = true
}

// Create thunder effects
function createThunderEffect(scene) {
  // Create a bright directional light for thunder
  thunderLight = new THREE.DirectionalLight(0x9999ff, 0) // Start with intensity 0
  thunderLight.position.set(0, 50, 0)
  scene.add(thunderLight)

  // Start the thunder cycle
  scheduleNextThunder()

  return thunderLight
}

// Schedule the next thunder
function scheduleNextThunder() {
  // Random time until next thunder
  const nextThunder =
    minThunderInterval +
    Math.random() * (maxThunderInterval - minThunderInterval)

  setTimeout(() => {
    createThunderStrike()
  }, nextThunder)
}

// Create a thunder strike with light flashes
function createThunderStrike() {
  if (isThundering) return
  isThundering = true

  // Play thunder sound
  SoundManager.playThunder()

  // Random intensity for variation (very bright!)
  const intensity = 3 + Math.random() * 2

  // Initial flash sequence
  const flashSequence = [
    { intensity: intensity, duration: 100 }, // Initial bright flash
    { intensity: intensity * 0.1, duration: 200 }, // Quick dim
    { intensity: intensity * 0.8, duration: 100 }, // Secondary flash
    { intensity: intensity * 0.2, duration: 300 }, // Slower fade
    { intensity: intensity * 0.6, duration: 150 }, // Another flash
    { intensity: intensity * 0.1, duration: 400 }, // Long fade
    { intensity: intensity * 0.3, duration: 150 }, // Final flicker
    { intensity: 0, duration: 100 }, // Complete darkness
  ]

  let currentStep = 0

  function executeFlashStep() {
    if (currentStep >= flashSequence.length) {
      isThundering = false
      scheduleNextThunder()
      return
    }

    const step = flashSequence[currentStep]
    thunderLight.intensity = step.intensity

    currentStep++
    setTimeout(executeFlashStep, step.duration)
  }

  executeFlashStep()
}

// Create zombie death explosion effect
function createDeathEffect(scene, position, color = 0x2d7c3f) {
  const particleCount = 20
  const particles = []

  // Create death particles (reduced count for performance)
  for (let i = 0; i < 10; i++) {
    const size = 0.1 + Math.random() * 0.2
    const geometry = new THREE.SphereGeometry(size, 4, 4)
    const material = new THREE.MeshBasicMaterial({
      color: Math.random() > 0.5 ? color : 0x880000,
      transparent: true,
      opacity: 0.9,
    })
    const particle = new THREE.Mesh(geometry, material)
    particle.position.copy(position)
    particle.position.y += Math.random() * 1.5

    // Random velocity
    particle.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 0.3,
      Math.random() * 0.2 + 0.1,
      (Math.random() - 0.5) * 0.3,
    )
    particle.userData.life = 1.0
    particle.userData.decay = 0.03 + Math.random() * 0.02

    scene.add(particle)
    particles.push(particle)
  }

  // Animate particles (no PointLight for performance)
  function animateDeathParticles() {
    let allDead = true

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]

      // Update position
      p.position.add(p.userData.velocity)
      p.userData.velocity.y -= 0.01 // Gravity

      // Update life
      p.userData.life -= p.userData.decay
      p.material.opacity = p.userData.life
      p.scale.multiplyScalar(0.98)

      if (p.userData.life > 0) {
        allDead = false
      } else {
        scene.remove(p)
        particles.splice(i, 1)
      }
    }

    if (!allDead) {
      requestAnimationFrame(animateDeathParticles)
    }
  }

  animateDeathParticles()
}

// Create muzzle flash enhancement
function createEnhancedMuzzleFlash(
  scene,
  position,
  direction,
  color = 0xffaa00,
) {
  // Create flash sphere (no PointLight for performance)
  const flashGeometry = new THREE.SphereGeometry(0.15, 8, 8)
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.9,
  })
  const flash = new THREE.Mesh(flashGeometry, flashMaterial)
  flash.position.copy(position)
  scene.add(flash)

  // Create smoke particles
  const smokeCount = 5
  const smokeParticles = []

  for (let i = 0; i < smokeCount; i++) {
    const smokeGeometry = new THREE.SphereGeometry(
      0.05 + Math.random() * 0.05,
      6,
      6,
    )
    const smokeMaterial = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.5,
    })
    const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial)
    smoke.position.copy(position)
    smoke.userData.velocity = direction
      .clone()
      .multiplyScalar(0.1)
      .add(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.05,
          Math.random() * 0.02,
          (Math.random() - 0.5) * 0.05,
        ),
      )
    scene.add(smoke)
    smokeParticles.push(smoke)
  }

  // Animate flash
  let flashLife = 1.0
  function animateFlash() {
    flashLife -= 0.15

    if (flashLife > 0) {
      flash.material.opacity = flashLife
      flash.scale.multiplyScalar(1.1)

      // Update smoke
      smokeParticles.forEach((smoke) => {
        smoke.position.add(smoke.userData.velocity)
        smoke.material.opacity *= 0.9
        smoke.scale.multiplyScalar(1.05)
      })

      requestAnimationFrame(animateFlash)
    } else {
      scene.remove(flash)
      smokeParticles.forEach((smoke) => scene.remove(smoke))
    }
  }

  animateFlash()
}

export {
  // Existing exports
  SCREEN_SHAKE_DECAY,
  applyScreenShake,
  updateScreenShake,
  showDamageFlash,
  createFlashlight,
  updateFlashlight,

  // New rain and thunder exports
  RAIN_COUNT,
  RAIN_AREA_SIZE,
  RAIN_HEIGHT,
  RAIN_SPEED,
  createRain,
  updateRain,
  createThunderEffect,
  createThunderStrike,

  // New visual effect exports
  createDeathEffect,
  createEnhancedMuzzleFlash,
}
