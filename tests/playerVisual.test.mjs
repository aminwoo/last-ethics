import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { test } from 'node:test'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

// Parse the real rig and animation data; omit only image decoding for Node.
// No renderer, fake skeleton, or replacement animation clips are used.
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init) } }
let asset
async function harness() {
  if (!asset) {
    const bytes = await readFile(new URL('../public/models/Male Survivor 2 .glb', import.meta.url))
    const length = bytes.readUInt32LE(12)
    const json = JSON.parse(bytes.subarray(20, 20 + length).toString())
    for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material
    delete json.materials
    delete json.textures
    delete json.images
    json.buffers[0].uri = `data:application/octet-stream;base64,${bytes.subarray(28 + length).toString('base64')}`
    asset = await new GLTFLoader().parseAsync(JSON.stringify(json), '')
  }
  const context = vm.createContext({ Math, Infinity, Error })
  const modules = new Map()
  for (const [id, exports] of [
    ['three', THREE],
    ['three/examples/jsm/loaders/GLTFLoader.js', { GLTFLoader: class { async loadAsync() { return asset } } }],
    ['three/examples/jsm/utils/SkeletonUtils.js', { clone }],
  ]) {
    modules.set(id, new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context }))
  }
  const module = new vm.SourceTextModule(await readFile(new URL('../src/gameplay/playerVisual.js', import.meta.url), 'utf8'), { context })
  await module.link(id => modules.get(id))
  await module.evaluate()
  const h = module.namespace
  async function player() {
    const p = new THREE.Group()
    const weapon = new THREE.Group()
    weapon.add(new THREE.Object3D())
    p.add(weapon)
    p.userData = { weapons: { pistol: weapon }, animationState: h.createAnimationState() }
    await h.attachPlayerVisual(p)
    return p
  }
  return { h, player }
}

test('real survivor walks and runs while firing independently of leg motion', async () => {
  const { h, player } = await harness()
  const p = await player()
  p.userData.animationState.moving = true
  h.updatePlayerVisual(p, .3)
  const visual = p.userData.playerVisual
  const leg = visual.model.getObjectByName('DEF_LEGL001')
  const before = leg.quaternion.clone()
  h.triggerPlayerShot(p, { name: 'Shotgun' })
  h.updatePlayerVisual(p, .1)
  assert.equal(visual.lowerAction, 'walk')
  assert.equal(visual.upperAction, 'fire')
  assert.ok(before.angleTo(leg.quaternion) > .01)
  p.userData.animationState.sprinting = true
  h.updatePlayerVisual(p, .3)
  assert.equal(visual.lowerAction, 'run')
  assert.equal(visual.upperAction, 'aim')
})

test('repeated recoil and reload evaluation never accumulates offsets on constant tracks', async () => {
  const { h, player } = await harness()
  const p = await player()
  h.triggerPlayerShot(p, { name: 'Shotgun' })
  h.updatePlayerVisual(p, .1)
  const visual = p.userData.playerVisual
  const position = visual.weapon.position.clone()
  const rotation = visual.weapon.quaternion.clone()
  for (let i = 0; i < 100; i++) h.updatePlayerVisual(p, 0)
  assert.ok(visual.weapon.position.distanceTo(position) < 1e-6)
  assert.ok(visual.weapon.quaternion.angleTo(rotation) < 1e-6)
  h.triggerPlayerReload(p, 2)
  h.updatePlayerVisual(p, .8)
  const hand = visual.leftHand.position.clone()
  for (let i = 0; i < 100; i++) h.updatePlayerVisual(p, 0)
  assert.ok(visual.leftHand.position.distanceTo(hand) < 1e-6)
  assert.equal(visual.upperAction, 'reload')
  h.cancelPlayerAction(p)
  h.updatePlayerVisual(p, .2)
  assert.equal(visual.upperAction, 'aim')
})

test('muzzle follows the animated rig at arbitrary angles and cloned skeletons are independent', async () => {
  const { h, player } = await harness()
  const a = await player(), b = await player()
  a.rotation.y = .371
  h.triggerPlayerShot(a, { name: 'Pistol' })
  h.updatePlayerVisual(a, .02)
  const av = a.userData.playerVisual, bv = b.userData.playerVisual
  assert.notEqual(av.weapon, bv.weapon)
  assert.equal(bv.state.shotTime, Infinity)
  a.updateMatrixWorld(true)
  const expected = av.muzzle.getWorldPosition(new THREE.Vector3())
  const actual = a.userData.weapons.pistol.children[0].getWorldPosition(new THREE.Vector3())
  assert.ok(actual.distanceTo(expected) < 1e-6)
  assert.equal(a.rotation.y, .371)
  h.disposePlayerVisual(a)
  assert.equal(a.userData.playerVisual, undefined)
  h.updatePlayerVisual(b, .1)
  assert.equal(bv.model.parent, b)
})
