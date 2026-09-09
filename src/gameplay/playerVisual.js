import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

// Authored, skinned asset already bundled with the game. No generated geometry.
export const PLAYER_MODEL_URL = '/models/Male Survivor 2 .glb'
const loader = new GLTFLoader()
let assetPromise
const v = new THREE.Vector3()
const q = new THREE.Quaternion()
const parentRotation = new THREE.Quaternion()
const recoilRotation = new THREE.Quaternion()
const xAxis = new THREE.Vector3(1, 0, 0)
const muzzleRotation = new THREE.Quaternion().setFromAxisAngle(xAxis, -Math.PI / 2)

function loadAsset() {
  if (!assetPromise) {
    assetPromise = loader.loadAsync(PLAYER_MODEL_URL).then(asset => {
      // A small textured fill keeps the survivor readable in the dark arena,
      // while retaining the scene's directional lighting and cast shadows.
      const materials = new Set()
      asset.scene.traverse(node => {
        if (!node.isMesh) return
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (materials.has(material)) continue
          materials.add(material)
          material.emissive.setHex(0xffffff)
          material.emissiveMap = material.map
          material.emissiveIntensity = 0.3
        }
      })
      return asset
    }).catch(error => {
      assetPromise = null
      throw error
    })
  }
  return assetPromise
}

// Blender's generic clip names are mapped explicitly after inspecting the asset.
// Lower and upper tracks never overlap: firing cannot stop the walking cycle.
const isLowerTrack = track => /DEF_LEG|DEF_TORSO001\./.test(track.name)
export function makePlayerClips(clips) {
  const select = (index, name, lower) => {
    const source = clips[index]
    if (!source) throw new Error(`Survivor animation missing: ${name}`)
    return new THREE.AnimationClip(name, source.duration,
      source.tracks.filter(track => isLowerTrack(track) === lower).map(track => track.clone()))
  }
  return {
    idle: select(0, 'idle-legs', true),
    walk: select(1, 'walk-legs', true),
    run: select(2, 'run-legs', true),
    aim: select(3, 'aim-upper', false),
    fire: select(4, 'fire-upper', false),
    reload: select(0, 'lower-weapon-upper', false),
  }
}

export function createAnimationState() {
  return { moving: false, sprinting: false, shotTime: Infinity, shotStrength: 0,
    reloadTime: 0, reloadDuration: 0, reloading: false }
}

export function advanceAnimationState(state, deltaTime) {
  state.shotTime += deltaTime
  if (state.reloading) {
    state.reloadTime = Math.min(state.reloadDuration, state.reloadTime + deltaTime)
    if (state.reloadTime >= state.reloadDuration) state.reloading = false
  }
  return {
    locomotion: state.moving ? (state.sprinting ? 'run' : 'walk') : 'idle',
    upper: state.reloading ? 'reload' : state.shotTime < 0.24 ? 'fire' : 'aim',
    recoil: state.shotStrength * Math.exp(-state.shotTime * 22),
    reloadProgress: state.reloading ? state.reloadTime / state.reloadDuration : 0,
  }
}

function transition(visual, layer, name) {
  const previous = visual[layer]
  if (previous === name) return
  const action = visual.actions[name]
  action.reset().setEffectiveWeight(1).play()
  if (previous) visual.actions[previous].fadeOut(0.12)
  action.fadeIn(previous ? 0.12 : 0)
  visual[layer] = name
}

export async function attachPlayerVisual(player) {
  const asset = await loadAsset()
  if (player.userData.visualDisposed) return
  const model = clone(asset.scene)
  model.name = 'animated-survivor'
  const bounds = new THREE.Box3().setFromObject(model)
  const scale = 2.8 / bounds.getSize(v).y
  model.scale.multiplyScalar(scale)
  model.position.y = -bounds.min.y * scale
  model.traverse(node => {
    if (node.isMesh) {
      node.castShadow = true
      node.receiveShadow = true
      // Animated bounds change; do not cull a limb using its bind-pose bounds.
      node.frustumCulled = false
    }
  })
  player.add(model)
  const mixer = new THREE.AnimationMixer(model)
  const clips = makePlayerClips(asset.animations)
  const actions = Object.fromEntries(Object.entries(clips).map(([name, clip]) => [name, mixer.clipAction(clip)]))
  actions.run.timeScale = 1.65
  actions.walk.timeScale = 1.3
  actions.fire.setLoop(THREE.LoopOnce, 1)
  actions.fire.clampWhenFinished = true
  actions.fire.timeScale = clips.fire.duration / 0.24
  const weapon = model.getObjectByName('DEF_weapon001')
  const muzzle = new THREE.Object3D()
  muzzle.position.set(0, 6, 0)
  weapon.add(muzzle)
  const visual = {
    model, mixer, actions, weapon, muzzle,
    leftHand: model.getObjectByName('DEF_ARML003'),
    rightHand: model.getObjectByName('DEF_ARMR003'),
    upperTorso: model.getObjectByName('DEF_TORSO002'),
    state: player.userData.animationState,
    lowerAction: null, upperAction: null,
    basePose: null,
  }
  player.userData.playerVisual = visual
  updatePlayerVisual(player, 0)
}

export function updatePlayerVisual(player, deltaTime) {
  const visual = player.userData.playerVisual
  if (!visual) return
  const pose = advanceAnimationState(visual.state, deltaTime)
  transition(visual, 'lowerAction', pose.locomotion)
  transition(visual, 'upperAction', pose.upper)
  // Restore the unmodified pose: the mixer may skip writes to constant tracks.
  // Otherwise additive recoil/reload offsets would accumulate between frames.
  if (visual.basePose) {
    for (const pose of visual.basePose) {
      pose.bone.position.copy(pose.position)
      pose.bone.quaternion.copy(pose.quaternion)
    }
  }
  visual.mixer.update(deltaTime)
  if (!visual.basePose) {
    visual.basePose = [visual.weapon, visual.leftHand, visual.rightHand, visual.upperTorso]
      .map(bone => ({ bone, position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }))
  }
  for (const pose of visual.basePose) {
    pose.position.copy(pose.bone.position)
    pose.quaternion.copy(pose.bone.quaternion)
  }

  // The mixer restores the authored pose each frame before these additive motions.
  // Move the weapon and both hands together so recoil retains the grip.
  const kick = pose.recoil
  recoilRotation.setFromAxisAngle(xAxis, -kick * 0.12)
  for (const bone of [visual.weapon, visual.leftHand, visual.rightHand]) {
    bone.quaternion.multiply(recoilRotation)
    bone.position.z -= kick * 0.65
  }
  visual.upperTorso.quaternion.multiply(recoilRotation)
  if (visual.state.reloading) {
    const reach = Math.sin(pose.reloadProgress * Math.PI)
    const work = Math.sin(pose.reloadProgress * Math.PI * 4) * reach
    visual.leftHand.position.y -= reach * 1.8
    visual.leftHand.position.z += work * 0.65
    visual.leftHand.rotation.x += reach * 0.55
    visual.weapon.rotation.y += reach * 0.15
  }
  player.updateWorldMatrix(true, true)
  visual.muzzle.getWorldPosition(v)
  player.worldToLocal(v)
  player.getWorldQuaternion(parentRotation).invert()
  visual.weapon.getWorldQuaternion(q)
  q.multiply(muzzleRotation)
  q.premultiply(parentRotation)
  for (const anchor of Object.values(player.userData.weapons)) {
    const barrel = anchor.children[0]
    barrel.position.copy(v)
    barrel.quaternion.copy(q)
  }
}

export function triggerPlayerShot(player, weapon) {
  const state = player.userData.animationState
  if (!state) return
  state.shotTime = 0
  state.shotStrength = weapon.name === 'Shotgun' ? 1.3 : weapon.name === 'Sniper Rifle' ? 1.1 : 0.7
  const visual = player.userData.playerVisual
  if (visual) {
    // Every accepted automatic shot restarts recoil, even while already firing.
    visual.actions.fire.reset()
    updatePlayerVisual(player, 0)
  }
}

export function triggerPlayerReload(player, duration) {
  const state = player.userData.animationState
  if (!state || duration <= 0) return
  state.reloading = true
  state.reloadTime = 0
  state.reloadDuration = duration
  state.shotTime = Infinity
}

export function cancelPlayerAction(player) {
  const state = player.userData.animationState
  if (!state) return
  state.reloading = false
  state.shotTime = Infinity
}

export function disposePlayerVisual(player) {
  player.userData.visualDisposed = true
  const visual = player.userData.playerVisual
  if (!visual) return
  visual.mixer.stopAllAction()
  visual.mixer.uncacheRoot(visual.model)
  visual.model.traverse(node => { if (node.isSkinnedMesh) node.skeleton.dispose() })
  player.remove(visual.model)
  delete player.userData.playerVisual
  // Geometry, materials and textures belong to the cached asset, not this clone.
}
