import * as THREE from 'three'
import SoundManager from '../services/sound.js'

// Store all active turrets
const turrets = []

// Reusable Vector3 objects to avoid allocations in update loops
const _turretPos = new THREE.Vector3()
const _turretDir = new THREE.Vector3()
const _bulletPos = new THREE.Vector3()
const _bulletVelocity = new THREE.Vector3()
const _targetOffset = new THREE.Vector3(0, 1, 0)

// Constants for turret properties
const TURRET_FIRE_RATE = 0.15 // seconds between shots
const TURRET_RANGE = 30 // How far the turret can detect and shoot zombies
const TURRET_DAMAGE = 35 // Damage per bullet
const TURRET_ROTATION_SPEED = 5.0 // How fast the turret can rotate
const TURRET_BULLET_SPEED = 1.0 // Speed of turret bullets
const TURRET_BULLET_LIFETIME = 1000 // milliseconds

/**
 * Create a machine gun turret
 * @param {THREE.Scene} scene - The game scene
 * @param {THREE.Vector3} position - The position to place the turret
 * @returns {Object} The turret object
 */
export function createTurret(scene, position) {
  // Create the turret group
  const turret = new THREE.Group()
  turret.position.copy(position)
  turret.name = 'turret'

  // Enhanced metallic materials with better lighting response
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    metalness: 0.95,
    roughness: 0.15,
    envMapIntensity: 1.0,
  })

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a6b8a,
    metalness: 0.9,
    roughness: 0.2,
  })

  const glowMaterial = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 0.8,
    metalness: 0.1,
    roughness: 0.5,
  })

  // Create reinforced base with details
  const baseGeometry = new THREE.CylinderGeometry(1.0, 1.3, 0.6, 12)
  const base = new THREE.Mesh(baseGeometry, baseMaterial)
  turret.add(base)

  // Add base ring detail
  const baseRingGeometry = new THREE.TorusGeometry(1.15, 0.08, 8, 24)
  baseRingGeometry.rotateX(Math.PI / 2)
  const baseRing = new THREE.Mesh(baseRingGeometry, accentMaterial)
  baseRing.position.y = 0.1
  turret.add(baseRing)

  // Add base status lights (4 around the base)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const statusLight = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      glowMaterial,
    )
    statusLight.position.set(Math.cos(angle) * 1.0, 0.3, Math.sin(angle) * 1.0)
    turret.add(statusLight)
  }

  // Create middle rotating part with armor plating look
  const middleGeometry = new THREE.CylinderGeometry(0.75, 0.85, 0.7, 12)
  const middleMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a3a3a,
    metalness: 0.9,
    roughness: 0.25,
  })
  const middle = new THREE.Mesh(middleGeometry, middleMaterial)
  middle.position.y = 0.6
  turret.add(middle)

  // Add rotating sensor dome on top
  const sensorDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.3,
      roughness: 0.1,
      transparent: true,
      opacity: 0.9,
    }),
  )
  sensorDome.position.y = 0.35
  middle.add(sensorDome)

  // Sensor glow ring
  const sensorRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.03, 8, 16),
    glowMaterial,
  )
  sensorRing.rotation.x = Math.PI / 2
  sensorRing.position.y = 0.36
  middle.add(sensorRing)

  // Create gun mount with armored housing
  const mountGeometry = new THREE.BoxGeometry(1.6, 0.5, 0.9)
  const mountMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d2d2d,
    metalness: 0.92,
    roughness: 0.12,
  })
  const mount = new THREE.Mesh(mountGeometry, mountMaterial)
  mount.position.y = 0.9
  middle.add(mount)

  // Add mount side panels
  const sidePanelGeo = new THREE.BoxGeometry(0.1, 0.4, 0.7)
  const leftPanel = new THREE.Mesh(sidePanelGeo, accentMaterial)
  leftPanel.position.set(-0.85, 0, 0)
  mount.add(leftPanel)
  const rightPanel = new THREE.Mesh(sidePanelGeo, accentMaterial)
  rightPanel.position.set(0.85, 0, 0)
  mount.add(rightPanel)

  // Create dual gun barrels for gatling look
  const barrelMaterial = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    metalness: 0.95,
    roughness: 0.08,
  })

  // Main barrel housing
  const barrelHousingGeo = new THREE.CylinderGeometry(0.22, 0.25, 1.3, 12)
  barrelHousingGeo.rotateZ(Math.PI / 2)
  const barrelHousing = new THREE.Mesh(barrelHousingGeo, barrelMaterial)
  barrelHousing.position.set(1.1, 0, 0)
  barrelHousing.name = 'turretBarrel'
  mount.add(barrelHousing)

  // Inner barrel
  const innerBarrelGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.6, 8)
  innerBarrelGeo.rotateZ(Math.PI / 2)
  const innerBarrel = new THREE.Mesh(
    innerBarrelGeo,
    new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.98,
      roughness: 0.05,
    }),
  )
  innerBarrel.position.set(1.2, 0, 0)
  mount.add(innerBarrel)

  // Add a muzzle brake with slits
  const muzzleGeometry = new THREE.CylinderGeometry(0.28, 0.22, 0.35, 8)
  muzzleGeometry.rotateZ(Math.PI / 2)
  const muzzleMaterial = new THREE.MeshStandardMaterial({
    color: 0x181818,
    metalness: 0.95,
    roughness: 0.1,
  })
  const muzzle = new THREE.Mesh(muzzleGeometry, muzzleMaterial)
  muzzle.position.set(1.85, 0, 0)
  mount.add(muzzle)

  // Muzzle heat glow ring
  const muzzleGlow = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.02, 8, 12),
    new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff4400,
      emissiveIntensity: 0.3,
    }),
  )
  muzzleGlow.rotation.z = Math.PI / 2
  muzzleGlow.position.set(1.7, 0, 0)
  mount.add(muzzleGlow)

  // Create bullet starting position
  const bulletSpawnPoint = new THREE.Object3D()
  bulletSpawnPoint.position.set(2.0, 0, 0)
  bulletSpawnPoint.name = 'bulletSpawnPoint'
  mount.add(bulletSpawnPoint)

  // Add a targeting laser
  const laserBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 15, 4),
    new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.6,
    }),
  )
  laserBeam.rotation.z = Math.PI / 2
  laserBeam.position.set(9.5, 0, 0)
  laserBeam.visible = false // Only show when targeting
  mount.add(laserBeam)

  // Add spotlight with better settings
  const spotlight = new THREE.SpotLight(0x88ccff, 8, 15, Math.PI / 10, 0.6, 1.5)
  spotlight.position.set(1.8, 0.15, 0)
  spotlight.target.position.set(8, -1, 0)
  mount.add(spotlight)
  mount.add(spotlight.target)

  // Add shadow casting
  base.castShadow = true
  middle.castShadow = true
  mount.castShadow = true
  barrelHousing.castShadow = true
  innerBarrel.castShadow = true
  muzzle.castShadow = true
  base.receiveShadow = true
  middle.receiveShadow = true
  mount.receiveShadow = true
  barrelHousing.receiveShadow = true
  innerBarrel.receiveShadow = true
  muzzle.receiveShadow = true

  // Initial orientation - make sure mount points forward
  mount.rotation.z = 0

  // Add turret to scene
  scene.add(turret)

  // Store turret data
  const turretData = {
    object: turret,
    mount: middle, // The middle part that rotates
    barrel: mount, // The mount that holds the gun barrel
    bulletSpawn: bulletSpawnPoint,
    spotlight: spotlight,
    laserBeam: laserBeam,
    muzzleGlow: muzzleGlow,
    lastFired: 0,
    targetZombie: null,
    range: TURRET_RANGE,
    fireRate: TURRET_FIRE_RATE,
    damage: TURRET_DAMAGE,
    rotationSpeed: TURRET_ROTATION_SPEED,
    ammo: Infinity, // Unlimited ammo for turrets
    active: true,
    bullets: [],
    // Add initial direction the turret is facing
    initialDirection: new THREE.Vector3(0, 0, -1),
  }

  // Add to global turrets array
  turrets.push(turretData)

  return turretData
}

/**
 * Find the closest zombie to a turret
 * @param {Object} turret - The turret data
 * @param {Array} zombies - Array of zombies
 * @returns {Object} The closest zombie, or null if none in range
 */
function findClosestZombie(turret, zombies) {
  let closestDistance = turret.range
  let closestZombie = null

  zombies.forEach((zombie) => {
    if (zombie.userData.health <= 0) return

    const distance = turret.object.position.distanceTo(zombie.position)
    if (distance < closestDistance) {
      closestDistance = distance
      closestZombie = zombie
    }
  })

  return closestZombie
}

/**
 * Rotate turret to face a target
 * @param {Object} turret - The turret data
 * @param {THREE.Vector3} targetPosition - Position to rotate towards
 * @param {number} deltaTime - Time since last frame
 * @returns {boolean} True if rotation is complete/close enough
 */
function rotateTurretToTarget(turret, targetPosition, deltaTime) {
  // Calculate direction to target - reuse temp vectors
  turret.object.getWorldPosition(_turretPos)

  // Vector from turret to target
  _turretDir.subVectors(targetPosition, _turretPos)
  _turretDir.y = 0 // Keep rotation on xz plane only
  _turretDir.normalize()

  // In THREE.js, the default front direction is negative Z (0,0,-1)
  // Calculate the angle between current facing direction and target direction
  const targetAngle = Math.atan2(_turretDir.x, _turretDir.z) - Math.PI / 2

  // Get current rotation of middle part
  let currentRotationY = turret.mount.rotation.y

  // Calculate the shortest path to rotate
  let angleDifference = targetAngle - currentRotationY

  // Normalize the angle to be between -PI and PI
  while (angleDifference > Math.PI) angleDifference -= Math.PI * 2
  while (angleDifference < -Math.PI) angleDifference += Math.PI * 2

  // Calculate how much to rotate this frame based on rotation speed
  const rotationAmount =
    Math.min(Math.abs(angleDifference), turret.rotationSpeed * deltaTime) *
    Math.sign(angleDifference)

  // Apply the rotation to the middle part
  turret.mount.rotation.y += rotationAmount

  // Return true if we're close enough to the target angle
  return Math.abs(angleDifference) < 0.1
}

/**
 * Fire a bullet from a turret
 * @param {Object} turret - The turret data
 * @param {THREE.Scene} scene - The game scene
 * @param {THREE.Vector3} targetPosition - Position to fire at
 */
function fireTurretBullet(turret, scene, targetPosition) {
  // Get bullet spawn position - reuse temp vector
  turret.bulletSpawn.getWorldPosition(_bulletPos)

  // Calculate direction to target - this ensures bullets go toward the target
  _bulletVelocity.subVectors(targetPosition, _bulletPos).normalize()

  // Create bullet
  const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8)
  const bulletMaterial = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 0.8,
  })
  const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial)
  bullet.position.copy(_bulletPos)
  scene.add(bullet)

  // Create muzzle flash
  createMuzzleFlash(turret, scene)

  // Play shooting sound
  SoundManager.playSound('TURRET_SHOT', 0.1)

  // Store bullet data - clone the velocity since we're reusing the temp vector
  turret.bullets.push({
    mesh: bullet,
    velocity: _bulletVelocity.clone().multiplyScalar(TURRET_BULLET_SPEED),
    createdAt: Date.now(),
    damage: turret.damage,
  })

  // Update last fired time
  turret.lastFired = performance.now() / 1000
}

/**
 * Create muzzle flash effect for a turret
 * @param {Object} turret - The turret data
 * @param {THREE.Scene} scene - The game scene
 */
function createMuzzleFlash(turret, scene) {
  // Get muzzle position
  const muzzlePosition = new THREE.Vector3()
  turret.bulletSpawn.getWorldPosition(muzzlePosition)

  // Create a small sphere for the flash visual (no PointLight for performance)
  const flashGeometry = new THREE.SphereGeometry(0.25, 6, 6)
  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffaa,
    transparent: true,
    opacity: 0.9,
  })
  const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial)
  flashMesh.position.copy(muzzlePosition)
  scene.add(flashMesh)

  // Illuminate the turret's spotlight briefly
  turret.spotlight.intensity = 12

  // Remove flash after a short time
  setTimeout(() => {
    scene.remove(flashMesh)
    turret.spotlight.intensity = 8
  }, 80)
}

/**
 * Update all turrets (targeting, rotation, firing)
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {THREE.Scene} scene - The game scene
 * @param {Array} zombies - Array of all zombies
 */
export function updateTurrets(deltaTime, scene, zombies) {
  const currentTime = performance.now() / 1000

  // Update each turret
  turrets.forEach((turret) => {
    if (!turret.active) return

    // Find nearest zombie if we don't have a target or current target is dead
    if (!turret.targetZombie || turret.targetZombie.userData.health <= 0) {
      turret.targetZombie = findClosestZombie(turret, zombies)
    }

    // If we have a target, rotate to face it and fire when ready
    if (turret.targetZombie) {
      // Show targeting laser when we have a target
      if (turret.laserBeam) {
        turret.laserBeam.visible = true
      }

      // Check if target is still in range
      const distanceToTarget = turret.object.position.distanceTo(
        turret.targetZombie.position,
      )

      if (distanceToTarget <= turret.range) {
        // Rotate turret to face zombie
        const isAimed = rotateTurretToTarget(
          turret,
          turret.targetZombie.position,
          deltaTime,
        )

        // If aimed correctly and enough time has passed since last shot, fire
        if (isAimed && currentTime - turret.lastFired >= turret.fireRate) {
          // Flash muzzle glow on fire
          if (turret.muzzleGlow) {
            turret.muzzleGlow.material.emissiveIntensity = 1.5
          }

          // Reuse target offset vector
          _targetOffset.copy(turret.targetZombie.position)
          _targetOffset.y += 1
          fireTurretBullet(turret, scene, _targetOffset)
        } else {
          // Fade muzzle glow between shots
          if (
            turret.muzzleGlow &&
            turret.muzzleGlow.material.emissiveIntensity > 0.3
          ) {
            turret.muzzleGlow.material.emissiveIntensity -= deltaTime * 3
          }
        }
      } else {
        // Target out of range, clear it
        turret.targetZombie = null
      }
    } else {
      // Hide targeting laser when no target
      if (turret.laserBeam) {
        turret.laserBeam.visible = false
      }

      // Fade muzzle glow when idle
      if (
        turret.muzzleGlow &&
        turret.muzzleGlow.material.emissiveIntensity > 0.2
      ) {
        turret.muzzleGlow.material.emissiveIntensity -= deltaTime * 2
      }

      // No target, rotate slowly to scan for threats
      turret.mount.rotation.y += 0.2 * deltaTime
    }

    // Update bullets
    updateTurretBullets(turret, scene, zombies, deltaTime)
  })
}

/**
 * Update turret bullets (movement and collision detection)
 * @param {Object} turret - The turret data
 * @param {THREE.Scene} scene - The game scene
 * @param {Array} zombies - Array of all zombies
 * @param {number} deltaTime - Time since last frame
 */
function updateTurretBullets(turret, scene, zombies, deltaTime) {
  const currentTime = Date.now()
  const bulletsToRemove = []
  const velocityScale = deltaTime * 60

  // Update each bullet
  turret.bullets.forEach((bullet, index) => {
    // Move bullet - avoid clone by using addScaledVector
    bullet.mesh.position.addScaledVector(bullet.velocity, velocityScale)

    // Check for lifetime expiration
    if (currentTime - bullet.createdAt > TURRET_BULLET_LIFETIME) {
      bulletsToRemove.push(index)
      return
    }

    // Check for collision with zombies
    zombies.forEach((zombie) => {
      // Skip dead zombies
      if (
        zombie.userData &&
        (zombie.userData.isDead || zombie.userData.health <= 0)
      )
        return

      const distance = bullet.mesh.position.distanceTo(zombie.position)
      if (distance < 2.0) {
        // Collision radius
        // Damage zombie
        if (zombie.userData && zombie.userData.onHit) {
          zombie.userData.onHit(bullet.damage)

          // Add bullet to removal list
          if (!bulletsToRemove.includes(index)) {
            bulletsToRemove.push(index)
          }
        }
      }
    })
  })

  // Remove bullets in reverse order
  bulletsToRemove
    .sort((a, b) => b - a)
    .forEach((index) => {
      const bullet = turret.bullets[index]

      // Remove bullet from scene
      scene.remove(bullet.mesh)

      // Remove from bullets array
      turret.bullets.splice(index, 1)
    })
}

/**
 * Get all active turrets
 * @returns {Array} Array of all active turrets
 */
export function getTurrets() {
  return turrets
}

/**
 * Clean up turret resources
 * @param {THREE.Scene} scene - The game scene
 */
export function cleanupTurrets(scene) {
  turrets.forEach((turret) => {
    // Remove all bullets
    turret.bullets.forEach((bullet) => {
      scene.remove(bullet.mesh)
    })

    // Remove turret object
    scene.remove(turret.object)
  })

  // Clear turrets array
  turrets.length = 0
}

/**
 * Create two turrets near the player spawn position
 * @param {THREE.Scene} scene - The game scene
 * @param {THREE.Vector3} playerPosition - The player spawn position
 * @returns {Array} Array of created turrets
 */
export function createSpawnTurrets(scene, playerPosition) {
  // Create two turrets flanking the player spawn
  const turret1 = createTurret(
    scene,
    new THREE.Vector3(playerPosition.x - 5, 0, playerPosition.z - 5),
  )

  const turret2 = createTurret(
    scene,
    new THREE.Vector3(playerPosition.x + 5, 0, playerPosition.z - 5),
  )

  return [turret1, turret2]
}
