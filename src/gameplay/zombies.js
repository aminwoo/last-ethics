import * as THREE from 'three'
import { attachZombieVisual, updateZombieVisual, disposeZombieVisual, ZOMBIE_DEATH_DURATION } from './zombieVisual.js'
import {
  recordZombieKill,
  gameState,
  applyDamageToPlayer,
  isPlayerInvulnerable,
  getWaveDifficultyScaling,
  getWaveComposition,
} from '../core/gameState.js'
import SoundManager from '../services/sound.js'
import { showDamageFlash, createDeathEffect } from './effects.js'
import { spawnBloodDecal } from './props.js'

// Zombie types with different characteristics
const ZOMBIE_TYPES = {
  REGULAR: {
    speed: 0.035,
    health: 100,
    damage: 20,
    color: 0x2d7c3f, // Sickly green
    attackRange: 1.5,
    attackSpeed: 1.0, // Attacks per secondw
    size: { width: 0.8, height: 1.8, depth: 0.5 },
  },
  RUNNER: {
    speed: 0.075,
    health: 80,
    damage: 15,
    color: 0x8fbc8f, // Light green
    attackRange: 1.2,
    attackSpeed: 1.5, // Faster attacks
    size: { width: 0.7, height: 1.6, depth: 0.4 },
  },
  BRUTE: {
    speed: 0.03,
    health: 300,
    damage: 35,
    color: 0x006400, // Dark green
    attackRange: 1.8,
    attackSpeed: 0.7, // Slower attacks
    size: { width: 1.2, height: 2.2, depth: 0.8 },
  },
  DOG: {
    speed: 0.09, // Fastest enemy: closes the distance before you can reposition
    health: 45, // ...but folds to a single solid hit
    damage: 12,
    color: 0x8a5a2b, // Shepherd brown
    attackRange: 1.3,
    attackSpeed: 1.8, // Rapid bites
    size: { width: 0.6, height: 1.0, depth: 1.4 },
  },
}

// Blood splash sizes, relative to the authored decal
const BLOOD_SIZE = { BRUTE: 1.5, DOG: 0.7, RUNNER: 0.9 }

// Store all zombies
const zombies = []

// Reusable Vector3 objects to avoid allocations in update loops
const _tempDirection = new THREE.Vector3()
const _tempPlayerPos = new THREE.Vector3()
const _tempSeparation = new THREE.Vector3()
const _tempAway = new THREE.Vector3()
const _tempCohesion = new THREE.Vector3()
const _tempForward = new THREE.Vector3()
const _tempSeek = new THREE.Vector3()
const _tempInertia = new THREE.Vector3()
const _tempRandom = new THREE.Vector3()

// Export zombies array for bullet collision detection
export function getZombies() {
  return zombies
}

// Create a zombie and add it to the scene with difficulty scaling based on current wave
export function createZombie(scene, position, type = 'REGULAR', playerRef) {
  const zombieType = ZOMBIE_TYPES[type]

  // Apply wave difficulty scaling
  const difficultyScaling = getWaveDifficultyScaling()

  // Create zombie group
  const zombie = new THREE.Group()
  zombie.position.copy(position)
  zombie.userData = {
    type: 'enemy', // For bullet collision detection
    zombieType: type, // Store the zombie type
    health: Math.round(zombieType.health * difficultyScaling.health),
    maxHealth: Math.round(zombieType.health * difficultyScaling.health),
    speed: zombieType.speed * difficultyScaling.speed,
    damage: Math.round(zombieType.damage * difficultyScaling.damage),
    attackRange: zombieType.attackRange,
    attackSpeed: zombieType.attackSpeed,
    lastAttackTime: 0,
    isAttacking: false,
    attackSequence: 0,
    isDying: false,
    isDead: false,
    isMoving: true,
    animationState: 'idle',
    animationTime: 0,
    targetPlayer: playerRef,
    hitTime: 0,
    // Add knockback properties
    knockback: {
      velocity: new THREE.Vector3(0, 0, 0),
      active: false,
      decayRate: type === 'BRUTE' ? 0.85 : type === 'RUNNER' ? 0.9 : type === 'DOG' ? 0.92 : 0.88, // Different decay rates for different zombie types
    },
    // Increase collision radius for more effective separation
    radius: Math.max(zombieType.size.width, zombieType.size.depth) * 0.8, // Larger radius for collision
    onHit: function (damage) {
      // Handle being hit by bullet
      this.health -= damage
      this.hitTime = Date.now()

      // Play hit sound or effect
      if (this.health <= 0 && !this.isDying) {
        this.isDying = true
        this.animationState = 'dying'
        this.animationTime = 0
        // Play death sound
        recordZombieKill(this.zombieType)
      } else {
        // Play hit sound
      }
    },
  }

  zombie.userData.visualReady = attachZombieVisual(zombie)

  // Add to scene and zombies array
  scene.add(zombie)
  zombies.push(zombie)

  return zombie
}

export function updateZombies(deltaTime) {
  const currentTime = Date.now()

  for (let i = zombies.length - 1; i >= 0; i--) {
    const zombie = zombies[i]
    const userData = zombie.userData

    // Skip updates if zombie is dead and has completed death animation
    if (userData.isDead) {
      continue
    }

    // Update death animation
    if (userData.isDying) {
      if (!userData.bled) {
        userData.bled = true
        // A kill marks the ground. The decal pool recycles, so the arena
        // accumulates evidence of the fight without growing without bound.
        spawnBloodDecal(zombie.position, BLOOD_SIZE[userData.zombieType] || 1)
      }
      userData.animationTime += deltaTime

      // Play death animation for 1.5 seconds
      if (userData.animationTime <= ZOMBIE_DEATH_DURATION) {
        updateZombieVisual(zombie, deltaTime)
      } else {
        // Mark as fully dead after animation completes
        userData.isDead = true
        userData.isDying = false
        updateZombieVisual(zombie, deltaTime)

        // Create death particle effect
        if (zombie.parent) {
          createDeathEffect(
            zombie.parent,
            zombie.position,
            ZOMBIE_TYPES[userData.zombieType].color,
          )
        }
      }
      continue
    }

    // Handle knockback effect
    if (userData.knockback && userData.knockback.active) {
      // Apply knockback velocity to zombie position
      zombie.position.x += userData.knockback.velocity.x * deltaTime * 60
      zombie.position.z += userData.knockback.velocity.z * deltaTime * 60

      // Decay knockback over time
      userData.knockback.velocity.multiplyScalar(userData.knockback.decayRate)

      // Deactivate knockback when it becomes negligible
      if (userData.knockback.velocity.length() < 0.001) {
        userData.knockback.active = false
        userData.knockback.velocity.set(0, 0, 0)
      }
    }

    // Move towards player if one is assigned
    if (userData.targetPlayer && userData.isMoving) {
      _tempPlayerPos.copy(userData.targetPlayer.position)

      // Calculate direction to player - reuse temp vector
      _tempDirection.subVectors(_tempPlayerPos, zombie.position).normalize()

      // Check distance to player
      const distanceToPlayer = zombie.position.distanceTo(_tempPlayerPos)

      // Rotate zombie to face player
      if (_tempDirection.x !== 0 || _tempDirection.z !== 0) {
        const angle = Math.atan2(_tempDirection.x, _tempDirection.z)
        zombie.rotation.y = angle
      }

      // Move zombie towards player if not in attack range
      if (distanceToPlayer > userData.attackRange) {
        // Calculate base movement direction toward player
        let moveX = _tempDirection.x * userData.speed * deltaTime * 60
        let moveZ = _tempDirection.z * userData.speed * deltaTime * 60

        // Calculate separation force to avoid other zombies
        const separationForce = calculateZombieSeparation(zombie, i)

        // Apply separation force to movement (with strength based on zombie type)
        const separationStrength =
          userData.zombieType === 'BRUTE'
            ? 0.4
            : userData.zombieType === 'RUNNER'
              ? 0.6
              : 0.5

        // Apply steering behaviors for more natural movement
        const steeringForce = calculateSteeringForce(
          zombie,
          _tempDirection,
          separationForce,
          separationStrength,
        )

        moveX += steeringForce.x
        moveZ += steeringForce.z

        // If not under knockback effect, apply regular movement
        if (!userData.knockback || !userData.knockback.active) {
          // Apply the combined movement
          zombie.position.x += moveX
          zombie.position.z += moveZ
        }

        // Update rotation to face movement direction (with some smoothing)
        if (moveX !== 0 || moveZ !== 0) {
          // Get movement direction (either from normal movement or from knockback)
          let targetAngle

          if (
            userData.knockback &&
            userData.knockback.active &&
            userData.knockback.velocity.length() > 0.01
          ) {
            // During knockback, face the direction we're being pushed
            targetAngle = Math.atan2(
              userData.knockback.velocity.x,
              userData.knockback.velocity.z,
            )
          } else {
            // Normal movement direction
            targetAngle = Math.atan2(moveX, moveZ)
          }

          const currentAngle = zombie.rotation.y

          // Smoothly interpolate rotation (faster for runners, slower for brutes)
          const rotationSpeed =
            userData.zombieType === 'BRUTE'
              ? 0.05
              : userData.zombieType === 'RUNNER'
                ? 0.15
                : 0.1

          zombie.rotation.y =
            currentAngle +
            (((targetAngle - currentAngle + Math.PI) % (Math.PI * 2)) -
              Math.PI) *
              rotationSpeed
        }

        // Set animation state to walking
        if (userData.animationState !== 'walking') {
          userData.isAttacking = false
          userData.animationState = 'walking'
          userData.animationTime = 0
        }
      } else {
        // In attack range, try to attack
        const timeSinceLastAttack =
          (currentTime - userData.lastAttackTime) / 1000

        if (timeSinceLastAttack >= 1 / userData.attackSpeed) {
          // Perform attack
          userData.lastAttackTime = currentTime
          userData.isAttacking = true
          userData.attackSequence++
          userData.animationState = 'attacking'
          userData.animationTime = 0

          // Apply damage to player
          damagePlayer(userData.targetPlayer, userData.damage)
        } else if (!userData.isAttacking) {
          userData.animationState = 'idle'
        }
      }
    } else if (userData.animationState === 'walking') {
      userData.animationState = 'idle'
    }

    // Update animations based on state
    userData.animationTime += deltaTime

    if (userData.animationState === 'attacking' && userData.animationTime >= Math.min(0.8, 1 / userData.attackSpeed)) {
      userData.isAttacking = false
      userData.animationState = 'idle'
      userData.animationTime = 0
    }
    updateZombieVisual(zombie, deltaTime)
  }
}

// Calculate separation force to avoid other zombies - optimized to reuse vectors
function calculateZombieSeparation(zombie, currentIndex) {
  _tempSeparation.set(0, 0, 0)

  // Maximum number of zombies to check for separation (performance optimization)
  const maxZombiesToCheck = 8
  let zombiesChecked = 0

  // Check collision with other zombies - higher priority than obstacles
  for (
    let i = 0;
    i < zombies.length && zombiesChecked < maxZombiesToCheck;
    i++
  ) {
    // Skip self and dead zombies
    if (
      i === currentIndex ||
      zombies[i].userData.isDead ||
      zombies[i].userData.isDying
    ) {
      continue
    }

    const otherZombie = zombies[i]
    const distance = zombie.position.distanceTo(otherZombie.position)

    // Only check zombies within a reasonable distance (performance optimization)
    const maxCheckDistance = 5
    if (distance > maxCheckDistance) {
      continue
    }

    zombiesChecked++

    // Calculate combined radius for both zombies for collision detection
    // Use slightly smaller radius to allow tighter grouping
    const combinedRadius =
      (zombie.userData.radius || 0.5) + (otherZombie.userData.radius || 0.5)
    const desiredDistance = combinedRadius * 1.2 // Reduced from 1.5 to 1.2

    // Use exponential force as zombies get closer to each other
    if (distance < desiredDistance) {
      // Direction away from the other zombie - reuse temp vector
      _tempAway.subVectors(zombie.position, otherZombie.position).normalize()

      // Force is stronger the closer they are (exponential increase as they get closer)
      // Less aggressive scaling to avoid sudden stops
      const forceMagnitude =
        Math.pow((desiredDistance - distance) / desiredDistance, 1.5) * 1.5

      // Scale by zombie speed with priority factor - but don't make it too strong
      const forceStrength = zombie.userData.speed * 0.7 * forceMagnitude

      // Add to total separation force
      _tempSeparation.x += _tempAway.x * forceStrength
      _tempSeparation.y += _tempAway.y * forceStrength
      _tempSeparation.z += _tempAway.z * forceStrength

      // Only apply emergency separation when extremely close (reduced threshold and strength)
      if (distance < combinedRadius * 0.6) {
        // Apply a stronger force in the direction away from the other zombie, but not too strong
        const emergencyMult = zombie.userData.speed * 2.5 // Reduced from 5.0 to 2.5
        _tempSeparation.x += _tempAway.x * emergencyMult
        _tempSeparation.y += _tempAway.y * emergencyMult
        _tempSeparation.z += _tempAway.z * emergencyMult
      }
    }
  }

  // Every obstacle is tested, cheaply. The town scatters wrecks, containers and
  // barricades all over the arena, so scanning a fixed slice of the array by
  // index would steer the horde around whichever props happened to load first.
  if (window.environmentObstacles) {
    const zombieRadius = zombie.userData.radius || 0.5

    for (const obstacle of window.environmentObstacles) {
      if (!obstacle.userData || obstacle.userData.type !== 'obstacle') continue

      // Minimum distance to maintain
      const minDistance = (obstacle.userData.radius || 1.5) + zombieRadius + 0.5
      const distanceSquared = zombie.position.distanceToSquared(obstacle.position)

      // Squared compare first: most of the town is nowhere near this zombie
      if (distanceSquared >= minDistance * minDistance) continue
      const distance = Math.sqrt(distanceSquared)

      // Direction away from the obstacle - reuse temp vector
      _tempAway.subVectors(zombie.position, obstacle.position).normalize()

      // Force is stronger the closer they are (exponential)
      const forceMagnitude =
        Math.pow((minDistance - distance) / minDistance, 1.5) * 1.2

      // Scale by zombie speed
      const forceStrength = zombie.userData.speed * 1.0 * forceMagnitude

      // Add to total separation force
      _tempSeparation.x += _tempAway.x * forceStrength
      _tempSeparation.y += _tempAway.y * forceStrength
      _tempSeparation.z += _tempAway.z * forceStrength
    }
  }

  // Cap the maximum separation force to prevent zombies from stopping completely
  const maxForce = zombie.userData.speed * 1.5
  const separationLen = _tempSeparation.length()
  if (separationLen > maxForce) {
    _tempSeparation.multiplyScalar(maxForce / separationLen)
  }

  // Return a new vector (we need the return value to persist)
  return new THREE.Vector3().copy(_tempSeparation)
}

// Calculate steering force for more natural movement
function calculateSteeringForce(
  zombie,
  targetDirection,
  separationForce,
  separationStrength,
) {
  const userData = zombie.userData
  const steeringForce = new THREE.Vector3()

  // Check if separation force is significant - if so, prioritize it
  const separationMagnitude = separationForce.length()
  const isCollisionImminent = separationMagnitude > 0.02 // Increased threshold slightly

  // 1. Weighted Separation (avoid other zombies and obstacles)
  // Reduction in separation strength multiplier to prevent stopping
  const adjustedSeparationStrength = isCollisionImminent
    ? separationStrength * 2.0 // Reduced from 3.0 to 2.0
    : separationStrength * 0.8 // Reduced to 80% of original

  const separationVector = separationForce
    .clone()
    .multiplyScalar(adjustedSeparationStrength)
  steeringForce.add(separationVector)

  // If we're very close to a collision, make separation important but not dominant
  if (separationMagnitude > 0.03) {
    // Balance separation with forward movement
    const seekVector = targetDirection
      .clone()
      .multiplyScalar(userData.speed * 0.4)
    steeringForce.add(seekVector)
    return steeringForce.multiplyScalar(1.0) // Reduced multiplier from 1.5 to 1.0
  }

  // 2. Seeking behavior (move toward target/player)
  // Increase base seeking strength to emphasize forward movement
  const seekWeight =
    userData.zombieType === 'RUNNER'
      ? 0.9 // Increased from 0.8 to 0.9
      : userData.zombieType === 'BRUTE'
        ? 0.6
        : 0.7 // Increased weights

  // Make seeking more resilient to collision avoidance
  const adjustedSeekWeight = isCollisionImminent
    ? seekWeight * (1.0 - Math.min(separationMagnitude * 3, 0.7)) // Reduced from 0.9 to 0.7
    : seekWeight

  const seekVector = targetDirection.clone().multiplyScalar(adjustedSeekWeight)

  // 3. Path following (avoid sharp turns)
  // Get the zombie's current forward direction
  const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(
    zombie.quaternion,
  )

  // Calculate how much the zombie's current direction aligns with the target direction
  // This creates more realistic movement by making zombies turn gradually
  const alignmentFactor = forwardDirection.dot(targetDirection)

  // Increased inertia to maintain momentum even when avoiding obstacles
  const inertiaWeight = isCollisionImminent
    ? 0.1 * (alignmentFactor > 0 ? alignmentFactor : 0) // Increased from 0.05 to 0.1
    : 0.25 * (alignmentFactor > 0 ? alignmentFactor : 0) // Increased from 0.2 to 0.25

  const inertiaVector = forwardDirection.clone().multiplyScalar(inertiaWeight)

  // 4. Random movement (wander behavior) - adds unpredictability
  // Reduce randomness when avoiding obstacles
  const randomStrength = isCollisionImminent
    ? 0.01 // Reduced from 0.02 to 0.01
    : userData.zombieType === 'REGULAR'
      ? 0.08
      : 0.04 // Reduced slightly

  const randomVector = new THREE.Vector3(
    (Math.random() - 0.5) * 2 * randomStrength,
    0,
    (Math.random() - 0.5) * 2 * randomStrength,
  )

  // 5. Group cohesion - zombies tend to stay near each other, forming hordes
  // Reduced cohesion radius and weight for better performance
  let cohesionVector = new THREE.Vector3(0, 0, 0)

  if (!isCollisionImminent) {
    // Find center of nearby zombies (reduced radius)
    cohesionVector = calculateCohesionForce(zombie, 8) // Reduced from 10 to 8
    const cohesionWeight =
      userData.zombieType === 'REGULAR'
        ? 0.1 // Reduced from 0.15 to 0.1
        : userData.zombieType === 'RUNNER'
          ? 0.03
          : 0.15 // Reduced weights
    cohesionVector.multiplyScalar(cohesionWeight)
  }

  // Combine all steering behaviors with appropriate weights
  steeringForce.add(seekVector)
  steeringForce.add(inertiaVector)
  steeringForce.add(randomVector)
  steeringForce.add(cohesionVector)

  // Apply character-specific adjustments
  if (userData.zombieType === 'BRUTE') {
    // Brutes move more purposefully with less randomness
    steeringForce.multiplyScalar(0.85) // Increased from 0.8 to 0.85
  } else if (userData.zombieType === 'RUNNER') {
    // Runners can make sharper turns and move more erratically
    steeringForce.multiplyScalar(1.25) // Increased from 1.2 to 1.25
  }

  // Scale force by the zombie's speed
  steeringForce.multiplyScalar(userData.speed)

  // Ensure the zombie always has some minimal forward movement
  if (steeringForce.length() < userData.speed * 0.2) {
    steeringForce.add(
      targetDirection.clone().multiplyScalar(userData.speed * 0.2),
    )
  }

  return steeringForce
}

// Calculate cohesion force to keep zombies in loose groups - optimized
function calculateCohesionForce(zombie, radius) {
  _tempCohesion.set(0, 0, 0)
  let neighborCount = 0

  // Find all zombies within the specified radius
  for (let i = 0; i < zombies.length; i++) {
    const otherZombie = zombies[i]

    // Skip self, dead zombies, and different types (for more distinct hordes)
    if (
      zombie === otherZombie ||
      otherZombie.userData.isDead ||
      otherZombie.userData.isDying ||
      otherZombie.userData.zombieType !== zombie.userData.zombieType
    ) {
      continue
    }

    const distance = zombie.position.distanceTo(otherZombie.position)

    // If in cohesion radius but not too close
    if (distance < radius && distance > 3) {
      _tempCohesion.add(otherZombie.position)
      neighborCount++
    }
  }

  // If there are neighbors, move slightly toward their center
  if (neighborCount > 0) {
    _tempCohesion.divideScalar(neighborCount)
    _tempCohesion.sub(zombie.position)
    _tempCohesion.normalize()
  }

  // Return a copy since we need to persist the value
  return new THREE.Vector3().copy(_tempCohesion)
}

// Create multiple zombies in a group/horde with wave-appropriate composition
export function spawnZombieHorde(scene, centerPosition, count, player) {
  const zombies = []
  const spawnPositions = []
  const radius = Math.sqrt(count) * 3 // Increased radius to give more initial space

  // First pass: Generate potential spawn positions
  for (let i = 0; i < count * 2; i++) {
    // Generate more positions than needed to allow for filtering
    // Use more structured distribution (circle with random offset)
    const angle = (i / (count * 2)) * Math.PI * 2
    const distance = 1.5 + Math.random() * radius
    const x = centerPosition.x + Math.cos(angle) * distance
    const z = centerPosition.z + Math.sin(angle) * distance

    spawnPositions.push(new THREE.Vector3(x, 0, z))
  }

  // Filter positions to ensure minimum spacing
  const finalPositions = []
  const minSpacing = 2.5 // Minimum distance between spawn positions

  for (let pos of spawnPositions) {
    let tooClose = false

    // Check distance to existing selected positions
    for (let existingPos of finalPositions) {
      if (pos.distanceTo(existingPos) < minSpacing) {
        tooClose = true
        break
      }
    }

    // Also check for obstacles nearby
    if (!tooClose && window.environmentObstacles) {
      for (let obstacle of window.environmentObstacles) {
        const obstacleRadius = obstacle.userData?.radius || 1.5
        if (pos.distanceTo(obstacle.position) < obstacleRadius + 2.0) {
          tooClose = true
          break
        }
      }
    }

    // If position is valid, add it
    if (!tooClose) {
      finalPositions.push(pos)

      // Once we have enough positions, stop
      if (finalPositions.length >= count) {
        break
      }
    }
  }

  // If we couldn't find enough valid positions, fill remaining with random ones
  while (finalPositions.length < count) {
    const randAngle = Math.random() * Math.PI * 2
    const randDistance = 2.0 + Math.random() * radius * 1.5
    const x = centerPosition.x + Math.cos(randAngle) * randDistance
    const z = centerPosition.z + Math.sin(randAngle) * randDistance

    finalPositions.push(new THREE.Vector3(x, 0, z))
  }

  // Get wave composition for zombie types
  const waveComposition = getWaveComposition()

  // Now spawn zombies at the final positions
  for (let i = 0; i < count; i++) {
    // Determine zombie type based on wave composition
    const typeRoll = Math.random()
    let type = 'REGULAR'
    let cumulativeProbability = 0

    for (const [zombieType, probability] of Object.entries(waveComposition)) {
      cumulativeProbability += probability
      if (typeRoll <= cumulativeProbability) {
        type = zombieType
        break
      }
    }

    // Create zombie at position
    const zombie = createZombie(scene, finalPositions[i], type, player)
    zombies.push(zombie)
  }

  return zombies
}

// Generate random spawn points around the player at a safe distance
export function generateSpawnPointsAroundPlayer(
  player,
  minDistance,
  maxDistance,
  count,
) {
  const spawnPoints = []
  const playerPos = player.position.clone()

  for (let i = 0; i < count; i++) {
    // Generate random angle
    const angle = Math.random() * Math.PI * 2

    // Generate random distance between min and max
    const distance = minDistance + Math.random() * (maxDistance - minDistance)

    // Calculate position
    const x = playerPos.x + Math.cos(angle) * distance
    const z = playerPos.z + Math.sin(angle) * distance

    spawnPoints.push(new THREE.Vector3(x, 0, z))
  }

  return spawnPoints
}

// Remove dead zombies (optionally with delay after death animation)
export function cleanupDeadZombies(scene, delay = 10000) {
  const currentTime = Date.now()

  for (let i = zombies.length - 1; i >= 0; i--) {
    const zombie = zombies[i]

    if (zombie.userData.isDead) {
      // Check if we should remove it (after delay)
      if (!zombie.userData.deathTime) {
        zombie.userData.deathTime = currentTime
      }

      if (currentTime - zombie.userData.deathTime > delay) {
        // Remove from scene and array
        disposeZombieVisual(zombie)
        scene.remove(zombie)
        zombies.splice(i, 1)
      }
    }
  }
}

// Function to apply damage to the player
export function damagePlayer(player, damage) {
  // Check if player is currently invulnerable or if game is over
  if (isPlayerInvulnerable() || gameState.isGameOver) {
    return // Skip damage if player is invulnerable or game is over
  }

  const actualDamage = applyDamageToPlayer(damage)

  // Show damage flash effect
  showDamageFlash()

  if (gameState.health <= 0) {
    // Use the correct function name for playing death sound
    SoundManager.playPlayerDeath()
  } else {
    SoundManager.playPlayerHit()
  }

  return actualDamage
}
