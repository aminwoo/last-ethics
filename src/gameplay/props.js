import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { WORLD_SCALE, dressKitModel, posedBounds } from './kit.js'

// Quaternius, Zombie Apocalypse Kit (CC0). See public/models/props/README.md.
// Props are placed in the kit's own authored units through m(), never eyeballed.
const m = value => value * WORLD_SCALE
// Authored street tiles are 8 units square and carry their own kerbs and pavements.
export const TILE = m(8)
// The ring road runs three tiles out, so its corners sit at radius ~70.
const RING = 3
export const TOWN_RADIUS = RING * TILE * Math.SQRT2 + TILE
// Kerbs sit 3.4 units in from the tile edge; poles stand on the pavement.
const KERB = m(3.4)
// Full-height street furniture is authored for an eye-level camera. From 25
// units up at 45 degrees a 13-unit pole sweeps clean across the play area, so
// the tall pieces are shortened until they frame the street instead of hiding it.
const LAMP_SCALE = 0.6
const SIGN_SCALE = 0.7
// The lamp head hangs 2.39 units along the pole's own +Z, 6.37 units up.
const LAMP_REACH = m(2.39) * LAMP_SCALE
const LAMP_HEIGHT = m(6.37) * LAMP_SCALE
const HALF = Math.PI / 2
const BLOOD_VARIANTS = ['Blood_1', 'Blood_2', 'Blood_3']
// Kills reuse the two smaller splashes only. The largest is nearly two bodies
// across: a wave's worth of those in one doorway reads as a red carpet.
const KILL_VARIANTS = ['Blood_2', 'Blood_3']
const BLOOD_POOL = 12
const CORPSE_MODEL = '/models/enemies/Zombie_Ribcage.gltf'

const loader = new GLTFLoader()
const assets = new Map()
const matrix = new THREE.Matrix4()
const quaternion = new THREE.Quaternion()
const euler = new THREE.Euler()
const scaling = new THREE.Vector3()
const bounds = new THREE.Box3()
const decals = []
let decalCursor = 0

// The town is authored, not random: one seed keeps every session identical.
function seeded(seed) {
  return () => {
    seed = seed + 0x6d2b79f5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function loadAsset(url) {
  if (!assets.has(url)) {
    const pending = loader.loadAsync(url)
      .then(asset => (dressKitModel(asset.scene), asset))
      .catch(error => { assets.delete(url); throw error })
    assets.set(url, pending)
  }
  return assets.get(url)
}

const loadProp = file => loadAsset(`/models/props/${file}.gltf`)

// One InstancedMesh per authored mesh: the whole town costs a few dozen draws.
function instance(asset, placements, { shadows = true } = {}) {
  const meshes = []
  asset.scene.updateMatrixWorld(true)
  asset.scene.traverse(node => { if (node.isMesh) meshes.push(node) })
  return meshes.map(mesh => {
    const instanced = new THREE.InstancedMesh(mesh.geometry, mesh.material, placements.length)
    instanced.name = `${mesh.name}-instances`
    instanced.castShadow = shadows
    instanced.receiveShadow = true
    placements.forEach((placement, index) => {
      const scale = (placement.scale || 1) * WORLD_SCALE
      euler.set(placement.tilt || 0, placement.rotation || 0, placement.roll || 0)
      matrix.compose(placement.position, quaternion.setFromEuler(euler), scaling.setScalar(scale))
      instanced.setMatrixAt(index, matrix.multiply(mesh.matrixWorld))
    })
    instanced.instanceMatrix.needsUpdate = true
    return instanced
  })
}

// Ground-plane helper: the layout is written in (x, z) with y last.
function at(x, z, y = 0) {
  return new THREE.Vector3(x, y, z)
}

// A street light's arm reaches along its own +Z, so aim that at the road.
function facing(dx, dz) {
  return Math.atan2(dx, dz)
}

// === LAYOUT =================================================================
// A crossroads inside a square ring road. The tile openings were read off the
// authored kerbs: Straight opens along Z, the T's stem points at -X, and Turn
// joins +X to +Z. The rotations below place those openings.
export function roadTiles() {
  const tiles = {
    Street_4Way: [], Street_T: [], Street_Turn: [],
    Street_Straight: [], Street_Straight_Crack1: [], Street_Straight_Crack2: [],
  }
  const add = (file, tx, tz, rotation) => tiles[file].push({ position: at(tx * TILE, tz * TILE, 0.015), rotation })
  add('Street_4Way', 0, 0, 0)
  add('Street_T', 0, RING, -HALF)
  add('Street_T', 0, -RING, HALF)
  add('Street_T', RING, 0, 0)
  add('Street_T', -RING, 0, Math.PI)
  add('Street_Turn', -RING, -RING, 0)
  add('Street_Turn', RING, -RING, -HALF)
  add('Street_Turn', RING, RING, Math.PI)
  add('Street_Turn', -RING, RING, HALF)
  for (let i = 1; i < RING; i++) {
    // The four approach lanes stay smooth: this is where the fighting happens.
    add('Street_Straight', 0, i, 0)
    add('Street_Straight', 0, -i, 0)
    add('Street_Straight', i, 0, HALF)
    add('Street_Straight', -i, 0, HALF)
    // The ring is the derelict edge of town, so it takes the cracked tiles.
    for (const side of [1, -1]) {
      add(i % 2 ? 'Street_Straight_Crack1' : 'Street_Straight', i * side, RING, HALF)
      add(i % 2 ? 'Street_Straight' : 'Street_Straight_Crack2', i * side, -RING, HALF)
      add(i % 2 ? 'Street_Straight_Crack2' : 'Street_Straight', RING, i * side, 0)
      add(i % 2 ? 'Street_Straight' : 'Street_Straight_Crack1', -RING, i * side, 0)
    }
  }
  return tiles
}

// Poles alternate sides so the lit pools stagger along each street.
function streetLights() {
  const lights = []
  const pole = (x, z, dx, dz) => lights.push({ position: at(x, z), rotation: facing(dx, dz), scale: LAMP_SCALE })
  for (let i = 1; i < RING; i++) {
    const side = i % 2 ? 1 : -1
    pole(side * KERB, i * TILE, -side, 0)
    pole(-side * KERB, -i * TILE, side, 0)
    pole(i * TILE, side * KERB, 0, -side)
    pole(-i * TILE, -side * KERB, 0, side)
    // Outer kerb of the ring road, arms reaching back in over the asphalt.
    pole(i * TILE, RING * TILE + KERB, 0, -1)
    pole(-i * TILE, -RING * TILE - KERB, 0, 1)
    pole(RING * TILE + KERB, -i * TILE, -1, 0)
    pole(-RING * TILE - KERB, i * TILE, 1, 0)
  }
  // Four lamps ring the landing zone; these are the ones that carry real lights.
  const plaza = []
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * HALF
    plaza.push({
      position: at(Math.cos(angle) * 18, Math.sin(angle) * 18),
      rotation: facing(-Math.cos(angle), -Math.sin(angle)),
      scale: LAMP_SCALE,
    })
  }
  return { lights, plaza }
}

// Wrecks, barricades and junk: hand-placed anchors with seeded jitter inside them.
function dressing() {
  const random = seeded(0x5ec70407)
  const props = {}
  const put = (file, x, z, rotation, extra = {}) => {
    (props[file] ??= []).push({ position: at(x, z), rotation, ...extra })
  }
  const SIGN = { scale: SIGN_SCALE }
  const spread = (count, cx, cz, radius, build) => {
    for (let i = 0; i < count; i++) {
      const angle = random() * Math.PI * 2
      const distance = Math.sqrt(random()) * radius
      build(cx + Math.cos(angle) * distance, cz + Math.sin(angle) * distance)
    }
  }

  // Checkpoints: each approach lane is half-blocked a little short of the plaza.
  for (let lane = 0; lane < 4; lane++) {
    const angle = lane * HALF
    const [ux, uz] = [Math.cos(angle), Math.sin(angle)]
    const [px, pz] = [-uz, ux]
    // Distance down the lane is a gameplay number; the offset across it is
    // authored units, so barriers stay a barrier-width apart at any scale.
    const spot = (along, across, file, turn = 0) =>
      put(file, ux * along + px * m(across), uz * along + pz * m(across), angle + turn)
    spot(30, 0.9, 'TrafficBarrier_1')
    spot(30, 2.6, 'TrafficBarrier_1')
    spot(30, -1.8, 'TrafficBarrier_2')
    spot(27, -3.4, 'PlasticBarrier')
    spot(33, 4.3, 'PlasticBarrier')
    spot(25, 0.4, 'TrafficCone_1')
    spot(25, -1.1, 'TrafficCone_2')
    spot(35, 1.2, 'TrafficCone_1')
    spot(22, 3.6, 'Barrel')
    spot(23.4, 4.4, 'Barrel')
    spot(21.5, -3.9, 'Barrel')
    spot(31, -4.4, 'FireHydrant', HALF)
    spot(20, 5.4, 'Chest')
    spot(40, -5.6, 'Couch', 0.4)
  }
  put('Chest_Special', 5, -12, 0.6)

  // Landmarks that read from a long way off through the fog.
  put('WaterTower', -RING * TILE - m(4), RING * TILE + m(2), 0.5)
  put('TownSign', m(6), -RING * TILE - m(4.5), Math.PI, SIGN)
  put('TrafficLight_2', KERB, RING * TILE - KERB, facing(0, -1), SIGN)
  put('TrafficLight_2', -KERB, -RING * TILE + KERB, facing(0, 1), SIGN)
  put('TrafficLight_1', RING * TILE - KERB, KERB, facing(-1, 0), SIGN)
  put('TrafficLight_1', -RING * TILE + KERB, -KERB, facing(1, 0), SIGN)
  put('TrafficLight_1', KERB, KERB, facing(-1, -1), SIGN)
  put('TrafficLight_1', -KERB, -KERB, facing(1, 1), SIGN)

  // Containers seal the gaps between the ring road and the open ground.
  put('Container_Green', -RING * TILE - m(3.5), -TILE * 1.4, HALF)
  put('Container_Red', -RING * TILE - m(3.5), -TILE * 1.4 + m(3.2), HALF)
  put('Container_Red', RING * TILE + m(3.5), TILE * 1.1, HALF + 0.06)
  put('Container_Green', TILE * 0.9, RING * TILE + m(4), 0.04)
  put('Container_Green', -TILE * 1.7, -RING * TILE - m(4), Math.PI)

  // Wrecks: armour near the checkpoint, civilian cars abandoned further out.
  put('Vehicle_Truck_Armored', -18, 26, 0.28)
  put('Vehicle_Pickup_Armored', 25, -19, -1.9)
  put('Vehicle_Sports_Armored', -27, -23, 2.4)
  put('Vehicle_Truck', RING * TILE, -TILE * 1.3, 0.1)
  put('Vehicle_Pickup', -RING * TILE + m(0.8), TILE * 1.7, 3.3)
  put('Vehicle_Sports', TILE * 1.8, RING * TILE - m(1), HALF + 0.2)
  put('Vehicle_Pickup', -TILE * 1.4, -RING * TILE + m(1), HALF - 0.3)
  put('Vehicle_Sports', TILE * 2.4, -RING * TILE + m(0.6), -HALF - 0.15)
  put('Vehicle_Truck', -TILE * 2.3, RING * TILE + m(0.7), HALF + 0.1)

  // Junk piles fill the four blocks between the lanes and the ring road.
  const junk = ['Pallet', 'Pallet_Broken', 'TrashBag_1', 'TrashBag_2', 'Wheel', 'Wheels_Stack', 'CinderBlock', 'Barrel', 'Pipes']
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    for (const [ox, oz, count, radius] of [[1.5, 1.5, 11, 5], [0.8, 2.2, 7, 3.5], [2.2, 0.8, 7, 3.5]]) {
      spread(count, sx * ox * TILE, sz * oz * TILE, m(radius), (x, z) => {
        const file = junk[Math.floor(random() * junk.length)]
        put(file, x, z, random() * Math.PI * 2, file === 'CinderBlock' && random() < 0.3 ? { roll: HALF } : {})
      })
    }
  }
  // Litter along the pavements, where the eye actually spends its time.
  for (let i = 0; i < 22; i++) {
    const along = (random() * 2 - 1) * RING * TILE
    const lane = Math.floor(random() * 4)
    const kerb = (random() < 0.5 ? 1 : -1) * (KERB + m(random()))
    const [x, z] = lane < 2 ? [kerb + (lane ? RING * TILE : 0), along] : [along, kerb + (lane === 2 ? RING * TILE : 0)]
    put(['TrashBag_1', 'TrashBag_2', 'CinderBlock', 'Wheel', 'FireHydrant'][i % 5], x, z, random() * Math.PI * 2)
  }
  return props
}

// Dried splashes laid down before the first wave; fresh kills reuse the pool below.
function bloodStains() {
  const random = seeded(0x1f3a55)
  const stains = { Blood_1: [], Blood_2: [], Blood_3: [] }
  for (let i = 0; i < 15; i++) {
    const angle = random() * Math.PI * 2
    const distance = 16 + random() * 52
    stains[BLOOD_VARIANTS[i % 3]].push({
      position: at(Math.cos(angle) * distance, Math.sin(angle) * distance, 0.05),
      rotation: random() * Math.PI * 2,
      scale: 0.45 + random() * 0.35,
    })
  }
  return stains
}

// Corpses hold the last frame of the authored Death clip. No procedural posing.
async function corpses(group) {
  const asset = await loadAsset(CORPSE_MODEL)
  const random = seeded(0x0c0d5e)
  const death = THREE.AnimationClip.findByName(asset.animations, 'Death')
  if (!death) throw new Error('Zombie_Ribcage animation missing: Death')
  for (let i = 0; i < 7; i++) {
    const angle = random() * Math.PI * 2
    const distance = 18 + random() * 44
    const model = clone(asset.scene)
    model.name = 'town-corpse'
    const action = new THREE.AnimationMixer(model).clipAction(death)
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    // Hold the final pose: the bones are written once and the mixer is dropped.
    action.getMixer().setTime(death.duration)
    model.scale.setScalar(WORLD_SCALE)
    model.rotation.y = random() * Math.PI * 2
    model.updateMatrixWorld(true)
    // Rest the fallen pose on the ground rather than the bind pose's feet.
    model.position.set(Math.cos(angle) * distance, -posedBounds(model, bounds).min.y, Math.sin(angle) * distance)
    model.traverse(node => {
      if (!node.isMesh) return
      node.castShadow = true
      node.receiveShadow = true
      // Posed bounds differ from the bind pose; do not cull on the bind pose.
      node.frustumCulled = false
    })
    group.add(model)
  }
}

// Soft warm pools under every lamp: cheaper than lighting each pole for real.
function lampPools(placements) {
  const side = 64
  const data = new Uint8Array(side * side * 4)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const distance = Math.hypot(x - (side - 1) / 2, y - (side - 1) / 2) / (side / 2)
      const falloff = Math.max(0, 1 - distance) ** 2.2
      const index = (y * side + x) * 4
      data.set([255, 190, 130, Math.round(falloff * 255)], index)
    }
  }
  const texture = new THREE.DataTexture(data, side, side, THREE.RGBAFormat)
  texture.needsUpdate = true
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false,
    // Additive under near-black fog fades the far pools out for free.
    blending: THREE.AdditiveBlending, toneMapped: false,
  })
  const pools = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, placements.length)
  pools.name = 'lamp-pools'
  pools.castShadow = false
  placements.forEach((placement, index) => {
    euler.set(-HALF, 0, 0)
    matrix.compose(
      at(placement.position.x + Math.sin(placement.rotation) * LAMP_REACH,
        placement.position.z + Math.cos(placement.rotation) * LAMP_REACH, 0.1),
      quaternion.setFromEuler(euler), scaling.setScalar(m(8)),
    )
    pools.setMatrixAt(index, matrix)
  })
  return pools
}

// Footprints the horde steers around, in authored units; small litter is
// walked over instead. Roughly the half-footprint of each piece.
const BLOCKING = {
  Vehicle_Truck: 2, Vehicle_Truck_Armored: 2.1, Vehicle_Pickup: 1.9, Vehicle_Pickup_Armored: 2,
  Vehicle_Sports: 1.9, Vehicle_Sports_Armored: 2, Container_Green: 2.8, Container_Red: 2.8,
  WaterTower: 1.4, TownSign: 1, TrafficBarrier_1: 0.8, TrafficBarrier_2: 0.8, PlasticBarrier: 0.6,
  Couch: 1, Barrel: 0.4, Chest: 0.4, Chest_Special: 0.5,
}

export function preloadTownProps() {
  const files = new Set([
    'StreetLights', ...BLOOD_VARIANTS, ...Object.keys(roadTiles()), ...Object.keys(dressing()),
  ])
  return Promise.all([loadAsset(CORPSE_MODEL), ...[...files].map(loadProp)])
}

export async function buildTown(scene) {
  const group = new THREE.Group()
  group.name = 'town'
  const obstacles = []
  const add = async (file, placements, options) => {
    const asset = await loadProp(file)
    for (const mesh of instance(asset, placements, options)) group.add(mesh)
    const radius = BLOCKING[file] && m(BLOCKING[file])
    if (!radius) return
    for (const placement of placements) {
      // Lightweight proxies: the horde and the minimap only read these fields.
      const proxy = new THREE.Object3D()
      proxy.position.copy(placement.position)
      proxy.scale.set(radius * 2, 1, radius * 2)
      proxy.userData = { type: 'obstacle', radius, prop: file }
      obstacles.push(proxy)
    }
  }

  const { lights, plaza } = streetLights()
  const jobs = []
  // Asphalt sits a hair above the ground plane and never casts a shadow.
  for (const [file, placements] of Object.entries(roadTiles())) jobs.push(add(file, placements, { shadows: false }))
  for (const [file, placements] of Object.entries(dressing())) jobs.push(add(file, placements))
  for (const [file, placements] of Object.entries(bloodStains())) jobs.push(add(file, placements, { shadows: false }))
  jobs.push(add('StreetLights', [...lights, ...plaza]))
  jobs.push(corpses(group))
  await Promise.all(jobs)
  group.add(lampPools([...lights, ...plaza]))

  // Only the four plaza lamps light the scene; the rest glow and drop pools.
  const lamps = plaza.map(placement => {
    const lamp = new THREE.PointLight(0xef9b54, 18, 26, 2)
    lamp.position.set(
      placement.position.x + Math.sin(placement.rotation) * LAMP_REACH,
      LAMP_HEIGHT,
      placement.position.z + Math.cos(placement.rotation) * LAMP_REACH,
    )
    group.add(lamp)
    return lamp
  })

  // A small ring buffer of splashes: kills mark the ground without unbounded growth.
  decals.length = 0
  decalCursor = 0
  for (const variant of KILL_VARIANTS) {
    const asset = await loadProp(variant)
    const [mesh] = instance(asset, Array.from({ length: BLOOD_POOL }, () => ({ position: at(0, 0) })), { shadows: false })
    mesh.name = `blood-decals-${variant}`
    mesh.count = 0
    // Matrices move at runtime, so the cached instance bounds cannot be trusted.
    mesh.frustumCulled = false
    decals.push(mesh)
    group.add(mesh)
  }
  scene.add(group)
  return { group, obstacles, lamps }
}

// Called on every kill: writes one instance matrix and allocates nothing.
export function spawnBloodDecal(position, scale = 1) {
  if (!decals.length) return
  const mesh = decals[decalCursor % decals.length]
  const index = Math.floor(decalCursor / decals.length) % BLOOD_POOL
  decalCursor = (decalCursor + 1) % (decals.length * BLOOD_POOL)
  // Golden-angle spin keeps repeated splashes on one spot from stacking exactly.
  euler.set(0, decalCursor * 2.399963, 0)
  // Roughly a body's width of ground per kill, and never more.
  matrix.compose(at(position.x, position.z, 0.06), quaternion.setFromEuler(euler), scaling.setScalar(scale * WORLD_SCALE * 0.6))
  mesh.setMatrixAt(index, matrix)
  mesh.count = Math.max(mesh.count, index + 1)
  mesh.instanceMatrix.needsUpdate = true
}
