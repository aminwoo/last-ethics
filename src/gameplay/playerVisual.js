import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { PLAYER_HEIGHT, dressKitModel, posedBounds } from './kit.js'

// Quaternius, Zombie Apocalypse Kit (CC0). See public/models/survivors/README.md.
// Six classes, four authored outfits: the pairs share a survivor rather than
// wear a tinted copy of one, since the atlas is a palette and takes tint badly.
export const SURVIVOR_MODELS = {
  soldier: 'Matt', heavy: 'Sam', engineer: 'Sam',
  scout: 'Shaun', assassin: 'Shaun', medic: 'Lis',
}
export const SURVIVORS = ['Matt', 'Sam', 'Shaun', 'Lis']
export const DEFAULT_SURVIVOR = 'Matt'
export const survivorUrl = name => `/models/survivors/Characters_${name}.gltf`
export const survivorForClass = classId => SURVIVOR_MODELS[classId] || DEFAULT_SURVIVOR

// Multiplayer carries no class, so remote survivors are spread over the four
// outfits by id: four distinct people beat four copies of the same one.
export function survivorForId(id) {
  let hash = 0
  for (const character of String(id ?? '')) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return SURVIVORS[hash % SURVIVORS.length]
}

// Every kit weapon rides on the rig's left hand; only the equipped one is shown.
const KIT_WEAPONS = ['Axe', 'Guitar', 'Knife', 'Pistol', 'Rifle', 'Shotgun', 'SMG', 'Spear', 'WoodenBat_Barbed', 'WoodenBat_Saw']
// The anchors weapons.js toggles, mapped to the kit mesh each one should show.
const WEAPON_MESHES = {
  pistol: 'Pistol', shotgun: 'Shotgun', assaultRifle: 'SMG',
  sniperRifle: 'Rifle', bat: 'WoodenBat_Barbed',
}
// Legs and pelvis. The upper body is everything above, so aiming and firing
// never interrupt a stride and a stride never disturbs the aim.
const LOWER_BONES = /^(Root|Body|Hips|UpperLeg|LowerLeg|Foot|PoleTarget)/

const loader = new GLTFLoader()
const assets = new Map()
const v = new THREE.Vector3()
const q = new THREE.Quaternion()
const parentRotation = new THREE.Quaternion()
const recoilRotation = new THREE.Quaternion()
const xAxis = new THREE.Vector3(1, 0, 0)
const bounds = new THREE.Box3()

function loadAsset(name) {
  if (!assets.has(name)) {
    const pending = loader.loadAsync(survivorUrl(name))
      .then(asset => dressKitModel(asset.scene) && asset)
      .catch(error => { assets.delete(name); throw error })
    assets.set(name, pending)
  }
  return assets.get(name)
}

export const preloadSurvivor = name => loadAsset(name || DEFAULT_SURVIVOR)

const isLowerTrack = track => LOWER_BONES.test(track.name)

// The kit's clips are named, so these are lookups rather than index guesses.
// The _Gun variants were authored as one set: their legs match this upper body.
export function makePlayerClips(clips) {
  const source = name => {
    const clip = THREE.AnimationClip.findByName(clips, name)
    if (!clip) throw new Error(`Survivor animation missing: ${name}`)
    return clip
  }
  const layer = (name, from, lower) => new THREE.AnimationClip(name, from.duration,
    from.tracks.filter(track => isLowerTrack(track) === lower).map(track => track.clone()))
  return {
    idle: layer('idle-legs', source('Idle_Gun'), true),
    walk: layer('walk-legs', source('Walk_Gun'), true),
    run: layer('run-legs', source('Run_Gun'), true),
    aim: layer('aim-upper', source('Idle_Gun'), false),
    // The unarmed idle doubles as the lowered-weapon pose a reload starts from.
    reload: layer('lower-weapon-upper', source('Idle'), false),
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
    upper: state.reloading ? 'reload' : 'aim',
    // The kit has no firing clip: recoil is the shot, and it decays fast.
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

function bone(model, name) {
  const found = model.getObjectByName(name)
  if (!found) throw new Error(`Survivor rig missing bone: ${name}`)
  return found
}

// Which anchor weapons.js has made visible is already the game's source of
// truth for the equipped weapon, so the mesh follows it with no new plumbing.
function equippedAnchor(player) {
  for (const key of Object.keys(WEAPON_MESHES)) {
    if (player.userData.weapons?.[key]?.visible) return key
  }
  return 'pistol'
}

export async function attachPlayerVisual(player) {
  const name = player.userData.survivor || DEFAULT_SURVIVOR
  const asset = await loadAsset(name)
  // A restart or a disconnect may remove an actor while its model is loading.
  if (player.userData.visualDisposed) return
  const model = clone(asset.scene)
  model.name = `animated-survivor-${name.toLowerCase()}`
  const mixer = new THREE.AnimationMixer(model)
  const clips = makePlayerClips(asset.animations)
  const actions = Object.fromEntries(Object.entries(clips).map(([key, clip]) => [key, mixer.clipAction(clip)]))
  actions.walk.timeScale = 1.2
  actions.run.timeScale = 1.45

  // Each weapon gets a muzzle at the forward tip of its own geometry, so the
  // barrel the game shoots from is the barrel of the mesh in the survivor's hand.
  const weapons = new Map()
  for (const key of KIT_WEAPONS) {
    const mesh = model.getObjectByName(key)
    if (!mesh) throw new Error(`Survivor ${name} is missing weapon mesh: ${key}`)
    mesh.visible = false
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox
    const muzzle = new THREE.Object3D()
    muzzle.position.set((box.min.x + box.max.x) / 2, (box.min.y + box.max.y) / 2, box.max.z)
    mesh.add(muzzle)
    weapons.set(key, { mesh, muzzle })
  }

  // Size the posed survivor, weapons excluded: the bind pose is arms-out and a
  // held spear would otherwise decide how tall the player stands.
  actions.idle.play()
  actions.aim.play()
  mixer.update(0)
  const scale = PLAYER_HEIGHT / posedBounds(model, bounds).getSize(v).y
  model.scale.multiplyScalar(scale)
  model.position.y = -posedBounds(model, bounds).min.y
  actions.idle.stop()
  actions.aim.stop()
  model.traverse(node => {
    if (!node.isMesh) return
    node.castShadow = true
    node.receiveShadow = true
    // Animated bounds change; do not cull a limb using its bind-pose bounds.
    node.frustumCulled = false
  })
  player.add(model)
  const visual = {
    model, mixer, actions, weapons, survivor: name,
    gunHand: bone(model, 'Middle2L'),
    gunArm: bone(model, 'LowerArmL'),
    freeArm: bone(model, 'LowerArmR'),
    upperTorso: bone(model, 'Torso'),
    state: player.userData.animationState,
    lowerAction: null, upperAction: null, equipped: null, basePose: null,
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

  const equipped = equippedAnchor(player)
  if (equipped !== visual.equipped) {
    for (const [key, weapon] of visual.weapons) weapon.mesh.visible = key === WEAPON_MESHES[equipped]
    visual.equipped = equipped
  }
  const held = visual.weapons.get(WEAPON_MESHES[equipped])

  // Restore the unmodified pose: the mixer may skip writes to constant tracks.
  // Otherwise additive recoil/reload offsets would accumulate between frames.
  if (visual.basePose) {
    for (const rest of visual.basePose) {
      rest.bone.position.copy(rest.position)
      rest.bone.quaternion.copy(rest.quaternion)
    }
  }
  visual.mixer.update(deltaTime)
  if (!visual.basePose) {
    visual.basePose = [visual.gunHand, visual.gunArm, visual.freeArm, visual.upperTorso]
      .map(target => ({ bone: target, position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }))
  }
  for (const rest of visual.basePose) {
    rest.position.copy(rest.bone.position)
    rest.quaternion.copy(rest.bone.quaternion)
  }

  // The mixer restores the authored pose each frame before these additive
  // motions. Both arms move together so recoil keeps the two-handed grip.
  const kick = pose.recoil
  recoilRotation.setFromAxisAngle(xAxis, -kick * 0.14)
  for (const target of [visual.gunHand, visual.gunArm, visual.freeArm]) {
    target.quaternion.multiply(recoilRotation)
    target.position.z -= kick * 0.05
  }
  visual.upperTorso.quaternion.multiply(recoilRotation)
  if (visual.state.reloading) {
    // The kit has no reload clip; the free hand fetches a magazine instead.
    const reach = Math.sin(pose.reloadProgress * Math.PI)
    const work = Math.sin(pose.reloadProgress * Math.PI * 4) * reach
    visual.freeArm.position.y -= reach * 0.22
    visual.freeArm.position.z += work * 0.1
    visual.freeArm.rotation.x += reach * 0.55
    visual.gunHand.rotation.z += reach * 0.2
  }

  // Muzzle anchors follow the animated weapon so bullets, flashes and the
  // barrel the HUD reads all come from the mesh actually in the hand.
  player.updateWorldMatrix(true, true)
  held.muzzle.getWorldPosition(v)
  player.worldToLocal(v)
  player.getWorldQuaternion(parentRotation).invert()
  held.mesh.getWorldQuaternion(q)
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
  // Every accepted shot restarts recoil, even while already firing.
  if (player.userData.playerVisual) updatePlayerVisual(player, 0)
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
