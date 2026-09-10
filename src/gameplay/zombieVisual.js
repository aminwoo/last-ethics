import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

// Quaternius, Zombie Apocalypse Kit (CC0). See public/models/enemies/README.md.
// Each rig brings its own clip names: the dog bites rather than punches.
export const ZOMBIE_VISUALS = {
  REGULAR: { file: 'Zombie_Basic.gltf', height: 2.7, walk: 'Walk', attack: 'Punch', pace: 1.1 },
  RUNNER: { file: 'Zombie_Arm.gltf', height: 2.35, walk: 'Run', attack: 'Punch', pace: 1.4 },
  BRUTE: { file: 'Zombie_Chubby.gltf', height: 3.4, walk: 'Walk', attack: 'Punch', pace: 0.85 },
  DOG: { file: 'Characters_GermanShepherd.gltf', height: 1.9, walk: 'Run', attack: 'Attack', pace: 1.25 },
}
// Authored stride speeds, so a wave's speed scaling reads on the legs too.
const ZOMBIE_BASE_SPEED = { REGULAR: 0.035, RUNNER: 0.075, BRUTE: 0.03, DOG: 0.09 }
const loader = new GLTFLoader()
const assets = new Map()
const size = new THREE.Vector3()
const hitColor = new THREE.Color(0xff6666)
export const ZOMBIE_DEATH_DURATION = 1.5

function loadAsset(type) {
  if (!assets.has(type)) {
    const pending = loader.loadAsync(`/models/enemies/${ZOMBIE_VISUALS[type].file}`)
      .catch(error => { assets.delete(type); throw error })
    assets.set(type, pending)
  }
  return assets.get(type)
}

export function preloadZombieVisuals() {
  return Promise.all(Object.keys(ZOMBIE_VISUALS).map(loadAsset))
}

export async function attachZombieVisual(zombie) {
  const type = zombie.userData.zombieType
  const config = ZOMBIE_VISUALS[type]
  const asset = await loadAsset(type)
  // A restart or cleanup may remove an actor while its model is loading.
  if (zombie.userData.visualDisposed) return
  const model = clone(asset.scene)
  model.name = `animated-zombie-${type.toLowerCase()}`
  const mixer = new THREE.AnimationMixer(model)
  const names = { idle: 'Idle', walking: config.walk, attacking: config.attack, dying: 'Death' }
  const actions = {}
  for (const [state, name] of Object.entries(names)) {
    const clip = THREE.AnimationClip.findByName(asset.animations, name)
    if (!clip) throw new Error(`Zombie ${type} animation missing: ${name}`)
    actions[state] = mixer.clipAction(clip)
  }
  for (const state of ['attacking', 'dying']) {
    actions[state].setLoop(THREE.LoopOnce, 1)
    actions[state].clampWhenFinished = true
  }
  // Size the posed mesh, not the outstretched bind pose. All rigs face +Z.
  actions.idle.play()
  mixer.update(0)
  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(model, true)
  const scale = config.height / bounds.getSize(size).y
  model.scale.multiplyScalar(scale)
  model.position.y = -bounds.min.y * scale
  actions.idle.stop()

  // Share geometry/textures, but isolate hit flashes and fading per enemy.
  const materials = new Map()
  model.traverse(node => {
    if (!node.isMesh) return
    node.castShadow = true
    node.receiveShadow = true
    node.frustumCulled = false
    const materialFor = source => {
      if (!materials.has(source)) {
        const material = source.clone()
        material.emissive.setHex(0xffffff)
        material.emissiveMap = material.map
        material.emissiveIntensity = 0.3
        material.roughness = 0.9
        // The source atlas is opaque while alive; fade only during death.
        materials.set(source, material)
      }
      return materials.get(source)
    }
    node.material = Array.isArray(node.material)
      ? node.material.map(materialFor) : materialFor(node.material)
  })
  zombie.add(model)
  zombie.userData.zombieVisual = {
    model, mixer, actions, materials: [...materials.values()], config,
    state: null, attackSequence: -1, phase: Math.random(),
    baseY: model.position.y,
  }
  updateZombieVisual(zombie, 0)
}

export function updateZombieVisual(zombie, deltaTime) {
  const visual = zombie.userData.zombieVisual
  if (!visual) return
  const data = zombie.userData
  const state = data.isDying || data.isDead ? 'dying' : data.animationState
  const action = visual.actions[state] || visual.actions.idle
  const newAttack = state === 'attacking' && visual.attackSequence !== data.attackSequence
  if (visual.state !== state || newAttack) {
    const previous = visual.actions[visual.state]
    // stopFading matters when a rapid attack reuses an action still fading out.
    action.reset().stopFading().setEffectiveWeight(1).play()
    if (previous && previous !== action) {
      previous.fadeOut(0.12)
      action.fadeIn(0.12)
    }
    if (state === 'walking' || state === 'idle') {
      action.time = action.getClip().duration * visual.phase
    }
    visual.state = state
    visual.attackSequence = data.attackSequence
  }
  if (state === 'walking') {
    // Wave speed increases also speed up the stride, with a readable upper bound.
    const baseSpeed = ZOMBIE_BASE_SPEED[data.zombieType] || ZOMBIE_BASE_SPEED.REGULAR
    action.setEffectiveTimeScale(visual.config.pace * Math.min(2, data.speed / baseSpeed))
  } else if (state === 'attacking') {
    action.setEffectiveTimeScale(action.getClip().duration / Math.min(0.8, 1 / data.attackSpeed))
  } else {
    action.setEffectiveTimeScale(1)
  }
  visual.mixer.update(deltaTime)
  const hit = Date.now() - (data.hitTime || 0) < 160
  const deathTime = state === 'dying' ? data.animationTime : 0
  const fade = THREE.MathUtils.smoothstep(deathTime, 1, ZOMBIE_DEATH_DURATION)
  for (const material of visual.materials) {
    const fading = state === 'dying'
    if (material.alphaHash !== fading) {
      // Dithered death fade retains depth and avoids sorting skinned limbs.
      material.alphaHash = fading
      material.needsUpdate = true
    }
    material.color.setHex(0xffffff)
    if (hit) material.color.copy(hitColor)
    material.emissiveIntensity = hit ? 0.65 : 0.3
    material.opacity = 1 - fade
  }
  visual.model.position.y = visual.baseY - fade * 0.18
  visual.model.visible = !data.isDead && deathTime < ZOMBIE_DEATH_DURATION
}

export function disposeZombieVisual(zombie) {
  zombie.userData.visualDisposed = true
  const visual = zombie.userData.zombieVisual
  if (!visual) return
  visual.mixer.stopAllAction()
  visual.mixer.uncacheRoot(visual.model)
  const skeletons = new Set()
  visual.model.traverse(node => { if (node.isSkinnedMesh) skeletons.add(node.skeleton) })
  for (const skeleton of skeletons) skeleton.dispose()
  for (const material of visual.materials) material.dispose()
  zombie.remove(visual.model)
  delete zombie.userData.zombieVisual
}
