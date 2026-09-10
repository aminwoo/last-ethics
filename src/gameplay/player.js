import * as THREE from 'three'
import {
  attachPlayerVisual,
  createAnimationState,
  updatePlayerVisual,
  survivorForClass,
} from './playerVisual.js'

// Player movement speed (base values, modified by class)
const PLAYER_SPEED = 0.07
const PLAYER_SPRINT_MULTIPLIER = 1.5

// `survivor` names the authored outfit this actor wears; the character class
// picks it for the local player and the peer id picks it for a remote one.
function createPlayer(survivor) {
  const player = new THREE.Group()
  player.name = 'player' // Set a name to easily find the player object

  player.userData = {
    survivor,
    animationTime: 0,
    isWalking: false,
    walkSpeed: 1,
    flashlightOn: true,
    weapons: {},
    animationState: createAnimationState(),
  }

  // Weapon attachment points preserve firing, switching and muzzle effects.
  // The skinned model supplies the visible weapon and updates these muzzle tips.
  for (const [key, barrelName] of Object.entries({
    pistol: 'pistolBarrel', shotgun: 'shotgunBarrel',
    assaultRifle: 'rifleBarrel', sniperRifle: 'sniperBarrel', bat: 'bat',
  })) {
    const anchor = new THREE.Group()
    anchor.name = key
    anchor.visible = key === 'pistol'
    const barrel = new THREE.Object3D()
    barrel.name = barrelName
    barrel.userData.isMuzzleTip = true
    barrel.position.set(0.25, 1.2, 0.7)
    anchor.add(barrel)
    player.add(anchor)
    player.userData.weapons[key] = anchor
  }

  player.userData.visualReady = attachPlayerVisual(player)
  return player
}

// Initialize player with the current weapon
function initializePlayer(scene, gameState) {
  // The player's own pick wins; the class only supplies the default.
  const playerObj = createPlayer(gameState.playerSurvivor || survivorForClass(gameState.playerClass))
  scene.add(playerObj)
  return playerObj
}

// Retain the multiplayer animation API while advancing independent skeletal layers.
function animatePlayerLegs(player, isMoving, deltaTime, isShiftPressed) {
  const data = player.userData
  data.isWalking = isMoving
  data.animationTime += deltaTime * (isShiftPressed ? 1.8 : 1)
  data.animationState.moving = isMoving
  data.animationState.sprinting = isMoving && isShiftPressed
  updatePlayerVisual(player, deltaTime)
}

// Update player movement and animation
function updatePlayerMovement(
  player,
  input,
  gameState,
  deltaTime,
  raycaster,
  groundPlane,
  groundIntersectPoint,
  flashlight,
  isTyping = false,
) {
  // Calculate movement direction based on keys
  let moveX = 0
  let moveZ = 0

  // Don't move if typing in chat
  if (!isTyping) {
    if (input.keys.w) moveZ -= 1
    if (input.keys.s) moveZ += 1
    if (input.keys.a) moveX -= 1
    if (input.keys.d) moveX += 1
  }

  // Normalize movement vector if moving diagonally
  if (moveX !== 0 && moveZ !== 0) {
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ)
    moveX /= length
    moveZ /= length
  }

  // Apply movement speed with class modifier
  let speed = PLAYER_SPEED * (gameState.moveSpeed || 1.0)
  // Only allow sprinting if there's stamina available and not typing
  if (input.keys.shift && gameState.stamina > 0 && !isTyping) {
    speed *= gameState.sprintMultiplier || PLAYER_SPRINT_MULTIPLIER
  }

  // Update player position
  player.position.x += moveX * speed * deltaTime * 60
  player.position.z += moveZ * speed * deltaTime * 60

  // Calculate direction from player to mouse position on ground
  raycaster.setFromCamera(input.mousePosition, flashlight.camera)
  raycaster.ray.intersectPlane(groundPlane, groundIntersectPoint)

  // Calculate direction vector
  const direction = new THREE.Vector3()
    .subVectors(groundIntersectPoint, player.position)
    .normalize()

  // Rotate player to face mouse direction (only on Y axis)
  if (direction.x !== 0 || direction.z !== 0) {
    player.rotation.y = Math.atan2(direction.x, direction.z)
  }

  return direction
}

export {
  PLAYER_SPEED,
  PLAYER_SPRINT_MULTIPLIER,
  createPlayer,
  initializePlayer,
  animatePlayerLegs,
  updatePlayerMovement,
}
