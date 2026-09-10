import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { test } from 'node:test'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init) } }
const assets = new Map()
async function harness() {
  class AssetLoader {
    async loadAsync(url) {
      if (!assets.has(url)) {
        const json = JSON.parse(await readFile(new URL(`../public${url}`, import.meta.url), 'utf8'))
        // Exercise the real mesh, skeleton and clips; Node has no image decoder.
        for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material
        delete json.materials
        delete json.textures
        delete json.images
        assets.set(url, await new GLTFLoader().parseAsync(JSON.stringify(json), ''))
      }
      return assets.get(url)
    }
  }
  // Production randomizes horde phases; keep asset assertions reproducible.
  const math = Object.create(Math)
  math.random = () => 0.25
  const context = vm.createContext({ Date, Math: math, Error })
  const modules = new Map()
  for (const [id, exports] of [
    ['three', THREE],
    ['three/examples/jsm/loaders/GLTFLoader.js', { GLTFLoader: AssetLoader }],
    ['three/examples/jsm/utils/SkeletonUtils.js', { clone }],
  ]) {
    modules.set(id, new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context }))
  }
  const module = new vm.SourceTextModule(await readFile(new URL('../src/gameplay/zombieVisual.js', import.meta.url), 'utf8'), { context })
  await module.link(id => modules.get(id))
  await module.evaluate()
  const h = module.namespace
  function actor(type = 'REGULAR') {
    const zombie = new THREE.Group()
    zombie.userData = {
      zombieType: type, animationState: 'idle', animationTime: 0,
      attackSequence: 0, attackSpeed: type === 'RUNNER' ? 1.5 : 1,
      speed: type === 'RUNNER' ? .075 : type === 'BRUTE' ? .03 : type === 'DOG' ? .09 : .035,
    }
    return zombie
  }
  return { h, actor }
}

test('all four real rigs animate, face the actor heading, and have distinct heights', async () => {
  const { h, actor } = await harness()
  await h.preloadZombieVisuals()
  assert.deepEqual(Object.keys(h.ZOMBIE_VISUALS), ['REGULAR', 'RUNNER', 'BRUTE', 'DOG'])
  for (const type of ['REGULAR', 'RUNNER', 'BRUTE', 'DOG']) {
    const z = actor(type)
    await h.attachZombieVisual(z)
    const v = z.userData.zombieVisual
    z.updateMatrixWorld(true)
    const height = new THREE.Box3().setFromObject(v.model, true).getSize(new THREE.Vector3()).y
    assert.ok(Math.abs(height - h.ZOMBIE_VISUALS[type].height) < .15)
    // The dog is a quadruped rig with its own bone names.
    const bone = v.model.getObjectByName(type === 'DOG' ? 'FrontLowerLegL' : 'FootL')
    assert.ok(bone, `${type} rig is missing the bone the walk cycle is read from`)
    const before = bone.quaternion.clone()
    const position = bone.position.clone()
    z.userData.animationState = 'walking'
    let moved = false
    for (let step = 0; step < 6; step++) {
      h.updateZombieVisual(z, .1)
      moved ||= before.angleTo(bone.quaternion) > .01 || position.distanceTo(bone.position) > .01
    }
    assert.ok(moved, `${type} foot must move across the walking cycle`)
    assert.equal(v.actions.walking.getClip().name, type === 'RUNNER' || type === 'DOG' ? 'Run' : 'Walk')
    // The dog rig has no Punch; it bites with its own authored Attack clip.
    assert.equal(v.actions.attacking.getClip().name, type === 'DOG' ? 'Attack' : 'Punch')
    z.rotation.y = .73
    assert.ok(Math.abs(new THREE.Euler().setFromQuaternion(v.model.getWorldQuaternion(new THREE.Quaternion())).y - .73) < 1e-6)
    h.disposeZombieVisual(z)
  }
})

test('fast consecutive attacks restart even without a locomotion transition', async () => {
  const { h, actor } = await harness()
  const z = actor('RUNNER')
  await h.attachZombieVisual(z)
  z.userData.animationState = 'attacking'
  z.userData.attackSequence = 1
  h.updateZombieVisual(z, .3)
  const v = z.userData.zombieVisual
  assert.ok(v.actions.attacking.time > .3)
  z.userData.attackSequence++
  h.updateZombieVisual(z, 0)
  assert.equal(v.actions.attacking.time, 0)
  assert.equal(v.actions.attacking.isRunning(), true)
})

test('hit, death and disposal are isolated while geometry remains shared', async () => {
  const { h, actor } = await harness()
  const a = actor(), b = actor()
  await Promise.all([h.attachZombieVisual(a), h.attachZombieVisual(b)])
  const av = a.userData.zombieVisual, bv = b.userData.zombieVisual
  assert.notEqual(av.model.getObjectByName('FootL'), bv.model.getObjectByName('FootL'))
  assert.notEqual(av.materials[0], bv.materials[0])
  assert.equal(av.model.getObjectByName('Zombie').geometry, bv.model.getObjectByName('Zombie').geometry)
  a.userData.hitTime = Date.now()
  h.updateZombieVisual(a, .1)
  assert.equal(av.materials[0].color.getHex(), 0xff6666)
  assert.equal(bv.materials[0].color.getHex(), 0xffffff)
  a.userData.isDying = true
  a.userData.animationTime = 1.25
  h.updateZombieVisual(a, 1.25)
  assert.equal(av.state, 'dying')
  assert.ok(av.materials[0].opacity > 0 && av.materials[0].opacity < 1)
  assert.equal(bv.materials[0].opacity, 1)
  a.userData.animationTime = 1.5
  h.updateZombieVisual(a, .25)
  assert.equal(av.model.visible, false)
  let materialDisposed = false, geometryDisposed = false
  av.materials[0].addEventListener('dispose', () => { materialDisposed = true })
  av.model.getObjectByName('Zombie').geometry.addEventListener('dispose', () => { geometryDisposed = true })
  h.disposeZombieVisual(a)
  assert.equal(materialDisposed, true)
  assert.equal(geometryDisposed, false)
  h.updateZombieVisual(b, .1)
  assert.equal(bv.model.parent, b)
})

test('cleanup during loading cannot attach a ghost model after restart', async () => {
  const { h, actor } = await harness()
  const z = actor()
  const pending = h.attachZombieVisual(z)
  h.disposeZombieVisual(z)
  await pending
  assert.equal(z.children.length, 0)
  assert.equal(z.userData.zombieVisual, undefined)
})
