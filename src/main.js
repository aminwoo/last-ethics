import * as THREE from 'three'
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import SoundManager from './sound.js'
import {
  gameState,
  updateGameState,
  switchWeapon,
  reloadWeapon,
  initializeGameState,
  getWaveInfo,
  setPlayerClass,
  getPlayerClassColor,
} from './gameState.js'
import {
  initializeUI,
  updateUI,
  updateCrosshair,
  initializeMinimap,
  updateMinimap,
} from './ui.js'
import {
  initializeInput,
  setupKeyboardListeners,
  setupMouseListeners,
  setupResizeListener,
} from './input.js'
import {
  initializePlayer,
  updatePlayerMovement,
  animatePlayerLegs,
} from './player.js'
import { createEnvironment, updateRain } from './environment.js'
import { updateFlashlight } from './effects.js'
import {
  handleWeaponSwitch,
  handleReload,
  handleShooting,
  updateBullets,
  resetBullets,
  getBulletModel,
  addRemoteBullet,
} from './weapons.js'
import { updateScreenShake } from './effects.js'
import * as ZombieSystem from './zombies.js'
// Import turret functionality
import { createSpawnTurrets, updateTurrets, cleanupTurrets } from './turrets.js'
// Import networking functionality
import {
  initializeNetworking,
  sendPlayerUpdate,
  getRemotePlayers,
  cleanupNetworking,
  updateNetworking,
  setPlayerName,
} from './network.js'
// Import chat functionality
import { initializeChat } from './chat.js'
// Import inventory functionality
import { initializeInventory, toggleInventory } from './inventory.js'
// Import character classes
import { getAllClasses, getClass } from './classes.js'

// DOM elements
const welcomeScreen = document.getElementById('welcome-screen')
const classSelectionScreen = document.getElementById('class-selection-screen')
const usernameInput = document.getElementById('username')
const joinGameBtn = document.getElementById('join-game-btn')
const confirmClassBtn = document.getElementById('confirm-class-btn')
const uiContainer = document.getElementById('ui-container')
const gameOverScreen = document.getElementById('game-over-screen')
const restartGameBtn = document.getElementById('restart-game-btn')

// Flag to track if game is starting
let isGameStarting = false
let selectedClass = null

// Hide UI container and game over screen initially
uiContainer.style.display = 'none'
gameOverScreen.style.display = 'none'

// Welcome screen event handlers
joinGameBtn.addEventListener('click', startGame)
usernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    startGame()
  }
})

// Game over screen event handlers
restartGameBtn.addEventListener('click', restartGame)

// Wave event listener
document.addEventListener('waveStart', handleWaveStart)

// Variables to store initialized game objects
let ui,
  input,
  scene,
  camera,
  renderer,
  raycaster,
  groundPlane,
  groundIntersectPoint,
  environment,
  player,
  chat,
  inventory

// Add a multiplayer status element to the UI
let multiplayerStatusElement = null

// Add a variable for the turrets
let turrets = []

// Function to initialize the scene and renderer
async function initializeScene() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x020208)
  scene.fog = new THREE.FogExp2(0x050510, 0.006)

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000,
  )
  camera.position.set(0, 25, 0)
  camera.lookAt(0, 0, 0)

  scene.camera = camera

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.2
  renderer.outputColorSpace = THREE.SRGBColorSpace

  document.getElementById('gameContainer').appendChild(renderer.domElement)

  // Initialize CSS2DRenderer for player nametags
  const labelRenderer = new CSS2DRenderer()
  labelRenderer.setSize(window.innerWidth, window.innerHeight)
  labelRenderer.domElement.style.position = 'absolute'
  labelRenderer.domElement.style.top = '0'
  labelRenderer.domElement.style.pointerEvents = 'none'
  document.getElementById('gameContainer').appendChild(labelRenderer.domElement)

  // Store the labelRenderer for use in the animation loop
  window.labelRenderer = labelRenderer

  // Create a raycaster for mouse interaction
  raycaster = new THREE.Raycaster()
  groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  groundIntersectPoint = new THREE.Vector3()

  // Set up window resize handler
  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
    labelRenderer.setSize(window.innerWidth, window.innerHeight)
  }

  // Set up input handlers
  setupResizeListener(onWindowResize)

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x101010) // Very dim ambient light
  scene.add(ambientLight)

  // Create ground plane
  const groundGeometry = new THREE.PlaneGeometry(500, 500)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.2,
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0
  ground.receiveShadow = true
  scene.add(ground)

  const gridHelper = new THREE.GridHelper(300, 300, 0x000000, 0x222222)
  gridHelper.position.y = 0.0
  scene.add(gridHelper)

  return {
    scene,
    camera,
    renderer,
    raycaster,
    groundPlane,
    groundIntersectPoint,
  }
}

// Initialize the scene but don't start the game loop yet
initializeScene()

// Set up class selection handlers
function initializeClassSelection() {
  const classCards = document.querySelectorAll('.class-card')

  classCards.forEach((card) => {
    card.addEventListener('click', () => {
      // Remove selected from all cards
      classCards.forEach((c) => c.classList.remove('selected'))

      // Add selected to clicked card
      card.classList.add('selected')

      // Store selected class
      selectedClass = card.dataset.class

      // Enable the confirm button
      confirmClassBtn.disabled = false
      confirmClassBtn.textContent = `PLAY AS ${getClass(selectedClass).name.toUpperCase()}`
    })
  })

  // Confirm class button handler
  confirmClassBtn.addEventListener('click', confirmClassSelection)
}

// Function to confirm class selection and start the game
async function confirmClassSelection() {
  if (!selectedClass) return

  // Set the player class
  setPlayerClass(selectedClass)

  // Hide class selection screen
  classSelectionScreen.style.opacity = '0'
  classSelectionScreen.style.transition = 'opacity 0.5s ease-out'

  setTimeout(() => {
    classSelectionScreen.style.display = 'none'

    // Show loading screen then initialize game
    showLoadingScreen(() => {
      // Show UI
      uiContainer.style.display = 'block'

      // Initialize and start the game
      initializeGame()
    })
  }, 500)
}

// Function to show class selection after username is entered
async function startGame() {
  // Prevent multiple clicks
  if (isGameStarting) return

  // Get the username
  const username = usernameInput.value.trim()

  // Validate username (non-empty)
  if (!username) {
    // Add a simple shake animation for invalid input
    usernameInput.classList.add('shake')
    setTimeout(() => {
      usernameInput.classList.remove('shake')
    }, 500)
    return
  }

  // Set starting flag and disable button
  isGameStarting = true
  joinGameBtn.disabled = true
  joinGameBtn.style.opacity = '0.6'
  joinGameBtn.style.cursor = 'not-allowed'
  joinGameBtn.textContent = 'STARTING...'

  // Store username in game state
  gameState.playerName = username

  try {
    // Initialize audio and play ambient sounds now that we have user interaction
    await SoundManager.playRainAmbience()
  } catch (error) {
    console.log('Audio initialization failed, continuing anyway')
  }

  // Hide welcome screen with a fade-out effect
  welcomeScreen.style.opacity = '0'
  welcomeScreen.style.transition = 'opacity 0.5s ease-out'

  // Wait for the fade-out animation to complete, then show class selection
  setTimeout(() => {
    // Hide welcome screen
    welcomeScreen.style.display = 'none'

    // Update player name display on class selection screen
    document.getElementById('player-name-display').textContent = username

    // Show class selection screen
    classSelectionScreen.style.display = 'flex'
    classSelectionScreen.style.opacity = '0'

    // Fade in class selection
    setTimeout(() => {
      classSelectionScreen.style.opacity = '1'
      classSelectionScreen.style.transition = 'opacity 0.5s ease-in'
    }, 50)

    // Initialize class selection handlers
    initializeClassSelection()
  }, 500)
}

// Function to display loading screen with progress bar
function showLoadingScreen(onComplete) {
  const loadingScreen = document.getElementById('loading-screen')
  const loadingBar = document.getElementById('loading-bar')
  const loadingText = document.getElementById('loading-text')
  loadingScreen.style.display = 'flex'
  loadingScreen.style.opacity = '1'

  // Simulate loading progress
  let progress = 0
  const loadingMessages = [
    'PREPARING YOUR ARSENAL...',
    'CHARGING FLASHLIGHT BATTERIES...',
    'SPAWNING ZOMBIES...',
    'LOADING AMMUNITION...',
    'SECURING THE PERIMETER...',
    'CHECKING SURVIVAL PROTOCOLS...',
  ]

  const loadingInterval = setInterval(() => {
    progress += Math.random() * 10
    if (progress > 100) progress = 100

    loadingBar.style.width = `${progress}%`

    // Update loading message periodically
    if (progress < 90) {
      const messageIndex = Math.floor((progress / 90) * loadingMessages.length)
      loadingText.textContent = loadingMessages[messageIndex]
    } else {
      loadingText.textContent = 'HERE COME THE HORDE!'
    }

    // When loading is complete
    if (progress === 100) {
      clearInterval(loadingInterval)

      // Delay for a moment at 100% to show "READY TO DEPLOY!"
      setTimeout(() => {
        // Hide loading screen with a fade
        loadingScreen.style.opacity = '0'
        loadingScreen.style.transition = 'opacity 0.5s ease-out'

        // Wait for fade to complete
        setTimeout(() => {
          loadingScreen.style.display = 'none'
          // Call the completion callback
          if (typeof onComplete === 'function') {
            onComplete()
          }
        }, 500)
      }, 800)
    }
  }, 200)
}

// Full game initialization and start
async function initializeGame() {
  // Reset and initialize game state
  initializeGameState()

  // Initialize UI
  ui = initializeUI()

  // Initialize minimap
  initializeMinimap(ui)

  // Initialize input
  input = initializeInput()

  // Make three.js resources available globally for inventory system
  window.renderer = renderer
  window.scene = scene
  window.camera = camera

  // Initialize inventory system
  inventory = initializeInventory()

  // Setup keyboard listeners
  setupKeyboardListeners(input, {
    onReload: () => {
      // Only allow reloading if not typing in chat
      if (!chat || !chat.isTyping()) {
        handleReload(player, reloadWeapon, gameState)
      }
    },
    onFlashlightToggle: () => {
      // Only allow flashlight toggle if not typing in chat
      if (!chat || !chat.isTyping()) {
        // Play a click sound for feedback
        player.userData.flashlightOn = !player.userData.flashlightOn
        sendPlayerUpdate(player)
        SoundManager.playSound('CLICK', 0.3)
      }
    },
    onWeaponSwitch: (weaponIndex) => {
      console.log(
        'onWeaponSwitch called with index:',
        weaponIndex,
        'chat typing:',
        chat?.isTyping(),
      )
      // Only allow weapon switching if not typing in chat
      if (!chat || !chat.isTyping()) {
        console.log(
          'Calling handleWeaponSwitch, current index:',
          gameState.currentWeaponIndex,
        )
        const result = handleWeaponSwitch(
          player,
          weaponIndex,
          switchWeapon,
          gameState,
        )
        console.log(
          'handleWeaponSwitch result:',
          result,
          'new index:',
          gameState.currentWeaponIndex,
        )
      }
    },
    onInventoryToggle: () => {
      // Only allow inventory toggle if not typing in chat
      if (!chat || !chat.isTyping()) {
        toggleInventory(inventory, input)
      }
    },
  })

  // Create environment
  environment = createEnvironment(scene, camera)

  // Make obstacles available globally for zombie collision detection
  window.environmentObstacles = environment.obstacles || []

  // Make scene globally available for network code
  window.gameScene = scene

  // Create player
  player = initializePlayer(scene, gameState)

  // Create turrets at player spawn position
  turrets = createSpawnTurrets(scene, player.position)

  // Make gameState available globally for network code
  window.gameState = gameState

  // Make bullet-related functions available globally for network code
  window.getBulletModel = getBulletModel
  window.addRemoteBullet = addRemoteBullet

  // Initialize multiplayer networking
  try {
    await initializeNetworking((playerCount) => {
      updateMultiplayerStatus(playerCount)
    }, scene)

    // Make sendPlayerUpdate available globally for weapon firing updates
    window.sendPlayerUpdate = sendPlayerUpdate

    // Send player name to the server
    if (gameState.playerName) {
      setPlayerName(gameState.playerName)
    }

    // Initialize chat after networking is set up
    chat = initializeChat()
  } catch (error) {
    console.error('Failed to initialize networking:', error)
    // Continue with single-player mode if networking fails
  }

  // Set up mouse listeners for crosshair and shooting
  setupMouseListeners(input, {
    onMouseMove: (clientMousePosition) => {
      updateCrosshair(ui, clientMousePosition)
    },
    onMouseClick: () => {
      // Only allow shooting if not typing in chat
      if (!chat || !chat.isTyping()) {
        handleShooting(input, player, scene, gameState)
      }
    },
    onMouseUp: () => {},
  })

  // Create wave display UI if it doesn't exist
  createWaveUI()

  // Start the animation loop
  renderer.setAnimationLoop(animate)

  // Add Z key for spawning zombies (for debugging/testing)
  window.addEventListener('keydown', (event) => {
    // Skip if typing in chat
    if (chat && chat.isTyping()) return

    // Z key to spawn more zombies around the player
    if (event.key.toLowerCase() === 'z') {
      const playerPosition = player.position.clone()
      // Spawn zombies at a distance from the player in a random direction
      const spawnDistance = 15
      const spawnPosition = new THREE.Vector3(
        playerPosition.x + (Math.random() * 2 - 1) * spawnDistance,
        0,
        playerPosition.z + (Math.random() * 2 - 1) * spawnDistance,
      )

      // Spawn 3-8 zombies
      const zombieCount = Math.floor(Math.random() * 6) + 3
      ZombieSystem.spawnZombieHorde(scene, spawnPosition, zombieCount, player)

      console.log(`Spawned ${zombieCount} zombies at distance ${spawnDistance}`)
    }
  })
}

// Create UI elements for wave display
function createWaveUI() {
  // Check if wave UI already exists
  if (document.getElementById('wave-display')) return

  // Create wave panel
  const wavePanel = document.createElement('div')
  wavePanel.id = 'wave-panel'
  wavePanel.className = 'ui-panel'

  // Create wave display
  const waveDisplay = document.createElement('div')
  waveDisplay.id = 'wave-display'
  waveDisplay.className = 'wave-text'
  waveDisplay.textContent = 'Wave: 1'

  // Create zombies remaining display
  const zombiesDisplay = document.createElement('div')
  zombiesDisplay.id = 'zombies-remaining'
  zombiesDisplay.className = 'wave-text'
  zombiesDisplay.textContent = 'Zombies: 0'

  // Create next wave countdown display
  const countdownDisplay = document.createElement('div')
  countdownDisplay.id = 'wave-countdown'
  countdownDisplay.className = 'wave-text'
  countdownDisplay.textContent = 'Next Wave: --'
  countdownDisplay.style.display = 'none' // Hidden initially

  // Add elements to panel
  wavePanel.appendChild(waveDisplay)
  wavePanel.appendChild(zombiesDisplay)
  wavePanel.appendChild(countdownDisplay)

  // Add to UI container
  uiContainer.appendChild(wavePanel)

  // Note: Styles are now in /public/css/game-ui.css
}

// Update wave UI elements - optimized with cached DOM references
function updateWaveUI() {
  const waveInfo = getWaveInfo()

  // Cache DOM element references
  if (!_waveDisplayEl) _waveDisplayEl = document.getElementById('wave-display')
  if (!_zombiesDisplayEl)
    _zombiesDisplayEl = document.getElementById('zombies-remaining')
  if (!_countdownDisplayEl)
    _countdownDisplayEl = document.getElementById('wave-countdown')

  // Update wave display
  if (_waveDisplayEl) {
    _waveDisplayEl.textContent = `Wave: ${waveInfo.currentWave}`
  }

  // Update zombies remaining
  if (_zombiesDisplayEl) {
    _zombiesDisplayEl.textContent = `Zombies: ${waveInfo.zombiesRemaining}`
  }

  // Update countdown to next wave
  if (_countdownDisplayEl) {
    if (waveInfo.waveInProgress) {
      _countdownDisplayEl.style.display = 'none'
    } else {
      _countdownDisplayEl.style.display = 'block'
      _countdownDisplayEl.textContent = `Next Wave: ${waveInfo.nextWaveCountdown}s`
    }
  }
}

// Handle wave start event
function handleWaveStart(event) {
  const { wave, zombieCount } = event.detail

  console.log(`Starting wave ${wave} with ${zombieCount} zombies`)

  // Add visual wave start effect
  const waveDisplay = document.getElementById('wave-display')
  if (waveDisplay) {
    waveDisplay.classList.remove('wave-start')
    void waveDisplay.offsetWidth // Force reflow to restart animation
    waveDisplay.classList.add('wave-start')
  }

  // Spawn zombies for the new wave in groups around the player
  const playerPosition = player.position.clone()

  // Determine how many spawn groups to create (more for higher waves)
  const minGroups = 2
  const maxGroups = Math.min(5, 2 + Math.floor(wave / 3))
  const spawnGroups =
    Math.floor(Math.random() * (maxGroups - minGroups + 1)) + minGroups

  // Calculate zombies per group
  const zombiesPerGroup = Math.ceil(zombieCount / spawnGroups)

  // Generate spawn positions around player
  const spawnPositions = ZombieSystem.generateSpawnPointsAroundPlayer(
    player,
    20,
    30,
    spawnGroups,
  )

  // Spawn zombies at each point
  spawnPositions.forEach((position, index) => {
    // For the last group, make sure we don't spawn more than the total count
    const zombiesInThisGroup =
      index === spawnPositions.length - 1
        ? zombieCount - index * zombiesPerGroup
        : zombiesPerGroup

    if (zombiesInThisGroup > 0) {
      setTimeout(() => {
        ZombieSystem.spawnZombieHorde(
          scene,
          position,
          zombiesInThisGroup,
          player,
        )
      }, index * 500) // Stagger spawning of groups
    }
  })
}

// Update the animate function to include time delta for animations
let lastTime = 0
let animationFrameId = null

// Cache frequently accessed DOM elements
let _waveDisplayEl = null
let _zombiesDisplayEl = null
let _countdownDisplayEl = null

function animate(time) {
  const deltaTime =
    lastTime === 0 ? 0 : Math.min(0.05, (time - lastTime) / 1000)
  lastTime = time

  // Check if inventory is open - reduce update frequency for better performance
  const inventoryIsOpen = inventory && inventory.isOpen

  // Always increment game time
  gameState.gameTime += deltaTime
  gameState.frameCount++

  // Check if game is over
  if (gameState.health <= 0 && !gameState.gameOver) {
    handleGameOver()
    return
  }

  // Skip rendering if game over
  if (gameState.gameOver) {
    return
  }

  // Update game state regardless of inventory state
  updateGameState(deltaTime, input.keys)

  // Handle automatic weapon firing if mouse is held down (only if inventory is closed)
  if (
    !inventoryIsOpen &&
    input.mouseDown &&
    gameState.weapon &&
    gameState.weapon.isAutomatic
  ) {
    // Only attempt to fire if not typing in chat
    if (!chat || !chat.isTyping()) {
      handleShooting(input, player, scene, gameState)
    }
  }

  // Update player movement and direction (with potential movement restrictions if inventory is open)
  const direction = updatePlayerAndFlashlight(deltaTime, inventoryIsOpen)

  // Update core game systems at reduced frequency when inventory is open
  updateBullets(scene, ZombieSystem.getZombies())
  updateScreenShake(camera)
  ZombieSystem.updateZombies(deltaTime)
  updateTurrets(deltaTime, scene, ZombieSystem.getZombies())

  // Periodically cleanup dead zombies (less frequently)
  if (gameState.frameCount % 180 === 0) {
    ZombieSystem.cleanupDeadZombies(scene)
  }

  // Apply screen shake effect if enabled
  if (gameState.screenShake > 0) {
    // Apply screen shake
    const shakeIntensity = gameState.screenShake
    camera.position.x += (Math.random() - 0.5) * shakeIntensity * 0.1
    camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.1
    camera.position.z += (Math.random() - 0.5) * shakeIntensity * 0.1

    // Decay screen shake
    gameState.screenShake *= 0.9
    if (gameState.screenShake < 0.01) {
      gameState.screenShake = 0
    }
  }

  // Update UI elements less frequently (every 3 frames)
  if (gameState.frameCount % 3 === 0) {
    updateUI(ui, gameState)
    updateWaveUI()
  }

  // Update minimap even less frequently (every 5 frames)
  if (direction && gameState.frameCount % 5 === 0) {
    updateMinimap(
      ui,
      player.position,
      direction,
      window.environmentObstacles,
      ZombieSystem.getZombies(),
      getRemotePlayers(),
    )
  }

  // Update networking
  updateNetworking()

  // Update rain every frame for smooth animation
  if (environment && environment.rainParticles) {
    updateRain(environment.rainParticles, player.position)
  }

  // Always render the scene
  renderer.render(scene, camera)

  // Update labels renderer
  window.labelRenderer.render(scene, camera)
}

// Update the updatePlayerAndFlashlight function to send position updates to the server
function updatePlayerAndFlashlight(deltaTime, inventoryIsOpen) {
  // Don't update movement if typing in chat or inventory is open
  const isTypingInChat = chat && chat.isTyping()
  const shouldUpdateMovement = !isTypingInChat && !inventoryIsOpen

  // Update player movement and get direction
  const direction = updatePlayerMovement(
    player,
    input,
    gameState,
    deltaTime,
    raycaster,
    groundPlane,
    groundIntersectPoint,
    { camera },
    !shouldUpdateMovement, // Skip movement if typing in chat or inventory is open
  )

  // Animate player legs and arms when moving
  const isMoving =
    shouldUpdateMovement &&
    (input.keys.w || input.keys.a || input.keys.s || input.keys.d)
  animatePlayerLegs(player, isMoving, deltaTime, input.keys.shift)

  // Send player position update to server
  // More frequent updates in the first 5 seconds to ensure initial position is set
  const shouldSendUpdate =
    gameState.gameTime < 5.0
      ? gameState.frameCount % 2 === 0 // Every 2 frames during first 5 seconds
      : gameState.frameCount % 6 === 0 // Every 6 frames after that

  if (shouldSendUpdate) {
    // For normal position updates, explicitly set isFiring to false
    // Weapon firing updates are sent separately in handleShooting
    sendPlayerUpdate(
      player,
      false,
      gameState.weapon ? gameState.weapon.name : null,
    )
  }

  // Update flashlight
  updateFlashlight(environment.flashlight, player, direction)

  // Update camera position to follow player
  camera.position.x = player.position.x
  camera.position.z = player.position.z + 25
  camera.lookAt(player.position)

  // Return direction for minimap
  return direction
}

// Function to restart the game after game over
function restartGame() {
  // Hide game over screen
  gameOverScreen.style.display = 'none'

  // Clean up resources
  cleanupResources()

  // Re-initialize the game directly (skip welcome/class selection since we already have those)
  initializeGameState()

  // Update UI to reflect reset state
  updateUI(ui, gameState)
}

// Function to update the multiplayer status display
function updateMultiplayerStatus(remotePlayerCount) {
  if (multiplayerStatusElement) {
    multiplayerStatusElement.textContent = `${remotePlayerCount + 1}` // +1 for local player
  }
}

// Function to clean up resources when restarting or exiting the game
function cleanupResources() {
  // Reset game state
  initializeGameState()

  // Reset bullets before clearing zombies
  resetBullets(scene)

  // Clean up turrets
  cleanupTurrets(scene)

  // Clear existing zombies
  while (ZombieSystem.getZombies().length > 0) {
    const zombie = ZombieSystem.getZombies()[0]
    scene.remove(zombie)
    ZombieSystem.getZombies().splice(0, 1)
  }

  // Reset player position
  player.position.set(0, 1, 0)

  // Reset player health and UI
  updateUI(ui, gameState)

  // Reset restart button for future use
  setTimeout(() => {
    restartGameBtn.disabled = false
    restartGameBtn.style.opacity = '1'
    restartGameBtn.style.cursor = 'pointer'
    restartGameBtn.textContent = 'TRY AGAIN'
  }, 1000)

  // Clean up networking resources
  cleanupNetworking()
}
