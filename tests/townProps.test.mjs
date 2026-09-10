import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { loadGameModule } from './kitHarness.mjs'

// Exercises the real Quaternius environment, vehicle and corpse assets.
const module = await loadGameModule('../src/gameplay/props.js')
const scene = new THREE.Scene()
const town = await module.buildTown(scene)

// Which edges of each authored tile the asphalt runs through, read off the
// kerb geometry in the source files. The layout has to honour these to connect.
const TILE_OPENINGS = {
  Street_Straight: [[0, 1], [0, -1]],
  Street_Straight_Crack1: [[0, 1], [0, -1]],
  Street_Straight_Crack2: [[0, 1], [0, -1]],
  Street_T: [[-1, 0], [0, 1], [0, -1]],
  Street_Turn: [[1, 0], [0, 1]],
  Street_4Way: [[1, 0], [-1, 0], [0, 1], [0, -1]],
}

function instances(group) {
  const meshes = []
  group.traverse(node => { if (node.isInstancedMesh) meshes.push(node) })
  return meshes
}

test('every street tile opens onto a neighbour that opens back', () => {
  const grid = new Map()
  for (const [file, placements] of Object.entries(module.roadTiles())) {
    assert.ok(TILE_OPENINGS[file], `unknown street tile ${file}`)
    for (const placement of placements) {
      const tx = Math.round(placement.position.x / module.TILE)
      const tz = Math.round(placement.position.z / module.TILE)
      assert.ok(Math.abs(placement.position.x / module.TILE - tx) < 1e-9, 'tiles must land on the grid')
      const cos = Math.cos(placement.rotation)
      const sin = Math.sin(placement.rotation)
      grid.set(`${tx},${tz}`, {
        file,
        openings: TILE_OPENINGS[file].map(([dx, dz]) =>
          [Math.round(dx * cos + dz * sin), Math.round(-dx * sin + dz * cos)]),
      })
    }
  }
  assert.ok(grid.size >= 30, 'the town should be a network, not a handful of tiles')
  for (const [key, tile] of grid) {
    const [tx, tz] = key.split(',').map(Number)
    for (const [dx, dz] of tile.openings) {
      const neighbour = grid.get(`${tx + dx},${tz + dz}`)
      assert.ok(neighbour, `${tile.file} at ${key} opens onto empty ground towards ${dx},${dz}`)
      assert.ok(
        neighbour.openings.some(([ex, ez]) => ex === -dx && ez === -dz),
        `${tile.file} at ${key} opens into the kerb of ${neighbour.file}`,
      )
    }
  }
})

test('the whole town draws as a few dozen instanced batches', () => {
  const meshes = instances(town.group)
  const placed = meshes.reduce((total, mesh) => total + mesh.count, 0)
  assert.ok(placed > 250, `only ${placed} props placed`)
  assert.ok(meshes.length < 100, `${meshes.length} batches for ${placed} props`)
  assert.equal(town.lamps.length, 4)
  for (const lamp of town.lamps) assert.ok(lamp.isPointLight && lamp.position.y > 5)
})

test('props sit on the flat ground the terrain leaves for them', () => {
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  for (const mesh of instances(town.group)) {
    if (mesh.name.startsWith('blood-decals')) continue // pool slots start parked
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix)
      position.setFromMatrixPosition(matrix)
      assert.ok(position.y > -1 && position.y < 1, `${mesh.name} placed at y ${position.y}`)
      assert.ok(Math.hypot(position.x, position.z) < module.TOWN_RADIUS,
        `${mesh.name} at ${position.x},${position.z} sits on the rolling hills`)
    }
  }
})

test('corpses hold the fallen pose and rest on the ground', () => {
  const corpses = town.group.children.filter(child => child.name === 'town-corpse')
  assert.ok(corpses.length > 0)
  const box = new THREE.Box3()
  const vertex = new THREE.Vector3()
  for (const corpse of corpses) {
    corpse.updateMatrixWorld(true)
    box.makeEmpty()
    corpse.traverse(node => {
      if (!node.isSkinnedMesh) return
      const attribute = node.geometry.getAttribute('position')
      for (let i = 0; i < attribute.count; i++) {
        vertex.fromBufferAttribute(attribute, i)
        node.applyBoneTransform(i, vertex)
        box.expandByPoint(vertex.applyMatrix4(node.matrixWorld))
      }
    })
    assert.ok(Math.abs(box.min.y) < 0.02, `corpse floats at ${box.min.y}`)
    const size = box.getSize(new THREE.Vector3())
    // Fallen, not standing: the death pose is wider on the ground than it is tall.
    assert.ok(Math.max(size.x, size.z) > size.y, `corpse is still standing: ${size.x}x${size.y}x${size.z}`)
  }
})

test('the horde gets obstacle proxies that keep clear of the landing zone', () => {
  assert.ok(town.obstacles.length > 20)
  for (const obstacle of town.obstacles) {
    assert.equal(obstacle.userData.type, 'obstacle')
    assert.ok(obstacle.userData.radius > 0)
    // The minimap draws obstacles from their scale, the horde from the radius.
    assert.equal(obstacle.scale.x, obstacle.userData.radius * 2)
    assert.ok(Math.hypot(obstacle.position.x, obstacle.position.z) > 10,
      'nothing may block the spawn where the player and turrets deploy')
  }
})

test('blood decals recycle through a fixed pool instead of growing', () => {
  const pools = instances(town.group).filter(mesh => mesh.name.startsWith('blood-decals'))
  assert.equal(pools.length, 2)
  const capacity = pools.reduce((total, mesh) => total + mesh.instanceMatrix.count, 0)
  assert.equal(pools.reduce((total, mesh) => total + mesh.count, 0), 0, 'no kills, no splashes')
  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  for (let i = 0; i < capacity * 3; i++) {
    module.spawnBloodDecal(new THREE.Vector3(i, 0, -i), 1)
  }
  assert.equal(pools.reduce((total, mesh) => total + mesh.count, 0), capacity)
  // The last kills are the ones on the ground, at the position they happened.
  const placed = []
  for (const mesh of pools) {
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix)
      placed.push(position.setFromMatrixPosition(matrix).clone())
    }
  }
  assert.equal(placed.length, capacity)
  for (const spot of placed) {
    assert.ok(spot.y > 0 && spot.y < 0.2, 'splashes lie on the ground')
    assert.ok(Math.abs(spot.x + spot.z) < 1e-6, 'splash landed away from its kill')
  }
})
