import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { loadGameModule } from './kitHarness.mjs'

// Exercises the real Quaternius survivor rigs, clips and weapon meshes.
const module = await loadGameModule('../src/gameplay/playerVisual.js')

const WEAPON_ANCHORS = ['pistol', 'shotgun', 'assaultRifle', 'sniperRifle', 'bat']

async function player(survivor, equipped = 'pistol') {
  const p = new THREE.Group()
  p.userData = { survivor, weapons: {}, animationState: module.createAnimationState() }
  for (const key of WEAPON_ANCHORS) {
    const anchor = new THREE.Group()
    anchor.name = key
    anchor.visible = key === equipped
    anchor.add(new THREE.Object3D())
    p.add(anchor)
    p.userData.weapons[key] = anchor
  }
  await module.attachPlayerVisual(p)
  return p
}

test('every class deploys a real authored survivor standing 2.8 units on the ground', async () => {
  assert.deepEqual([...new Set(Object.values(module.SURVIVOR_MODELS))].sort(), ['Lis', 'Matt', 'Sam', 'Shaun'])
  for (const classId of ['soldier', 'medic', 'scout', 'heavy', 'assassin', 'engineer']) {
    const name = module.survivorForClass(classId)
    const p = await player(name)
    const visual = p.userData.playerVisual
    assert.equal(visual.survivor, name)
    assert.equal(visual.model.name, `animated-survivor-${name.toLowerCase()}`)
    // The posed body, not the arms-out bind pose and not the held weapon.
    const skin = []
    visual.model.traverse(node => { if (node.isSkinnedMesh) skin.push(node) })
    assert.ok(skin.length > 0)
    const box = new THREE.Box3()
    const vertex = new THREE.Vector3()
    for (const mesh of skin) {
      const position = mesh.geometry.getAttribute('position')
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i)
        mesh.applyBoneTransform(i, vertex)
        box.expandByPoint(vertex.applyMatrix4(mesh.matrixWorld))
      }
    }
    // Tolerance covers the blend between the measured frame and this one.
    assert.ok(Math.abs(box.getSize(new THREE.Vector3()).y - 2.8) < 0.05, `${name} height ${box.getSize(new THREE.Vector3()).y}`)
    assert.ok(Math.abs(box.min.y) < 0.05, `${name} floats at ${box.min.y}`)
  }
  // An unknown class still deploys rather than failing to a missing model.
  assert.equal(module.survivorForClass('nope'), module.DEFAULT_SURVIVOR)
})

test('remote survivors spread over the four outfits and are stable per peer', async () => {
  const picks = new Set()
  for (let i = 0; i < 40; i++) picks.add(module.survivorForId(`peer-${i}`))
  assert.equal(picks.size, 4)
  assert.equal(module.survivorForId('peer-7'), module.survivorForId('peer-7'))
  assert.ok(module.SURVIVORS.includes(module.survivorForId(undefined)))
})

test('legs and upper body run on independent tracks while firing and reloading', async () => {
  const p = await player('Matt')
  const visual = p.userData.playerVisual
  p.userData.animationState.moving = true
  module.updatePlayerVisual(p, 0.3)
  const leg = visual.model.getObjectByName('LowerLegL')
  const arm = visual.model.getObjectByName('LowerArmL')
  const legBefore = leg.quaternion.clone()
  module.triggerPlayerShot(p, { name: 'Shotgun' })
  const armAtShot = arm.quaternion.clone()
  module.updatePlayerVisual(p, 0.02)
  assert.equal(visual.lowerAction, 'walk')
  assert.equal(visual.upperAction, 'aim')
  // The stride keeps going through the shot, and the shot moves the arm.
  assert.ok(legBefore.angleTo(leg.quaternion) > 0.005)
  assert.ok(armAtShot.angleTo(arm.quaternion) > 0.005)

  p.userData.animationState.sprinting = true
  module.updatePlayerVisual(p, 0.3)
  assert.equal(visual.lowerAction, 'run')

  module.triggerPlayerReload(p, 2)
  module.updatePlayerVisual(p, 0.8)
  assert.equal(visual.upperAction, 'reload')
  assert.equal(visual.lowerAction, 'run')
  module.cancelPlayerAction(p)
  module.updatePlayerVisual(p, 0.2)
  assert.equal(visual.upperAction, 'aim')
})

test('procedural recoil and reload never accumulate on constant tracks', async () => {
  const p = await player('Sam')
  const visual = p.userData.playerVisual
  module.triggerPlayerShot(p, { name: 'Shotgun' })
  module.updatePlayerVisual(p, 0.1)
  const position = visual.gunHand.position.clone()
  const rotation = visual.gunHand.quaternion.clone()
  for (let i = 0; i < 100; i++) module.updatePlayerVisual(p, 0)
  assert.ok(visual.gunHand.position.distanceTo(position) < 1e-6)
  assert.ok(visual.gunHand.quaternion.angleTo(rotation) < 1e-6)
  module.triggerPlayerReload(p, 2)
  module.updatePlayerVisual(p, 0.8)
  const hand = visual.freeArm.position.clone()
  for (let i = 0; i < 100; i++) module.updatePlayerVisual(p, 0)
  assert.ok(visual.freeArm.position.distanceTo(hand) < 1e-6)
})

test('the equipped anchor decides which kit weapon the survivor actually holds', async () => {
  const expected = { pistol: 'Pistol', shotgun: 'Shotgun', assaultRifle: 'SMG', sniperRifle: 'Rifle', bat: 'WoodenBat_Barbed' }
  const p = await player('Shaun')
  const visual = p.userData.playerVisual
  assert.equal(visual.weapons.size, 10, 'the rig carries all ten kit weapons')
  for (const [anchor, mesh] of Object.entries(expected)) {
    for (const key of WEAPON_ANCHORS) p.userData.weapons[key].visible = key === anchor
    module.updatePlayerVisual(p, 0.016)
    const shown = [...visual.weapons].filter(([, weapon]) => weapon.mesh.visible).map(([key]) => key)
    assert.deepEqual(shown, [mesh], `${anchor} should show ${mesh} alone`)
    // Every anchor's barrel tracks the muzzle of the mesh in the hand.
    p.updateMatrixWorld(true)
    const muzzle = visual.weapons.get(mesh).muzzle.getWorldPosition(new THREE.Vector3())
    for (const key of WEAPON_ANCHORS) {
      const barrel = p.userData.weapons[key].children[0].getWorldPosition(new THREE.Vector3())
      assert.ok(barrel.distanceTo(muzzle) < 1e-6, `${key} barrel lags the ${mesh} muzzle`)
    }
    // weapons.js tests bullets against a sphere of 2.5 on the enemy torso at
    // 1.3. A muzzle too far above that spends the radius on the vertical gap
    // and the shot sails over the horde, so hold on to some horizontal reach.
    const reach = Math.sqrt(Math.max(0, 2.5 ** 2 - (muzzle.y - 1.3) ** 2))
    assert.ok(reach > 1.5, `${mesh} muzzle at ${muzzle.y} leaves only ${reach} of hit radius`)
  }
})

test('muzzle follows the rig at arbitrary headings and clones stay independent', async () => {
  const a = await player('Matt')
  const b = await player('Lis')
  a.rotation.y = 0.371
  module.triggerPlayerShot(a, { name: 'Pistol' })
  module.updatePlayerVisual(a, 0.02)
  const av = a.userData.playerVisual
  const bv = b.userData.playerVisual
  assert.notEqual(av.weapons.get('Pistol').mesh, bv.weapons.get('Pistol').mesh)
  assert.equal(bv.state.shotTime, Infinity)
  a.updateMatrixWorld(true)
  const expected = av.weapons.get('Pistol').muzzle.getWorldPosition(new THREE.Vector3())
  const actual = a.userData.weapons.pistol.children[0].getWorldPosition(new THREE.Vector3())
  assert.ok(actual.distanceTo(expected) < 1e-6)
  assert.equal(a.rotation.y, 0.371)
  module.disposePlayerVisual(a)
  assert.equal(a.userData.playerVisual, undefined)
  module.updatePlayerVisual(b, 0.1)
  assert.equal(bv.model.parent, b)
})

test('removal during loading cannot attach a ghost survivor after a restart', async () => {
  const p = new THREE.Group()
  p.userData = { survivor: 'Matt', weapons: {}, animationState: module.createAnimationState() }
  const pending = module.attachPlayerVisual(p)
  module.disposePlayerVisual(p)
  await pending
  assert.equal(p.userData.playerVisual, undefined)
  assert.equal(p.children.length, 0)
})
