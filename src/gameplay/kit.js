import * as THREE from 'three'

// Shared facts about the Quaternius Zombie Apocalypse Kit (CC0), whose models
// the town, the survivors and the enemies all come from.
//
// The kit's characters and props are authored at one scale: the survivor stands
// 1.37 units tall in his gun pose, so pinning him at 2.8 game units fixes the
// size of every barrel, wreck and street tile beside him.
export const SURVIVOR_POSED_HEIGHT = 1.37
export const PLAYER_HEIGHT = 2.8
export const WORLD_SCALE = PLAYER_HEIGHT / SURVIVOR_POSED_HEIGHT

const vertex = new THREE.Vector3()

// Box3 ignores skinning, so a rig measured that way reports its bind pose: arms
// out, weapons included. Measure the posed skin from its own bone matrices.
export function posedBounds(model, box = new THREE.Box3()) {
  box.makeEmpty()
  model.updateMatrixWorld(true)
  model.traverse(node => {
    if (!node.isSkinnedMesh) return
    const position = node.geometry.getAttribute('position')
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i)
      node.applyBoneTransform(i, vertex)
      box.expandByPoint(vertex.applyMatrix4(node.matrixWorld))
    }
  })
  return box
}

// A textured emissive fill keeps kit models readable in the dark arena while
// they still take the scene's directional light and cast shadows.
export function dressKitMaterial(material) {
  if (material.userData.dressed) return material
  material.userData.dressed = true
  material.roughness = 0.9
  material.metalness = 0
  if (material.map) {
    material.emissive.setHex(0xffffff)
    material.emissiveMap = material.map
    material.emissiveIntensity = 0.25
  } else if (material.name === 'Light') {
    material.emissive.setHex(0xffd9a0)
    material.emissiveIntensity = 1.4
  } else if (material.name === 'BrakeLight') {
    material.emissive.setHex(0xff2a18)
    material.emissiveIntensity = 0.45
  } else if (material.name === 'Headlights') {
    // Wrecks: the glass catches the moon rather than lighting the road.
    material.emissive.setHex(0xdde8ff)
    material.emissiveIntensity = 0.2
  }
  return material
}

export function dressKitModel(model) {
  model.traverse(node => {
    if (!node.isMesh) return
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      dressKitMaterial(material)
    }
  })
  return model
}
