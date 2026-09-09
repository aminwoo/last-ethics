import * as THREE from 'three'

const loader = new THREE.TextureLoader()
const atlas = loader.load('/sprites/characters-v1.png')
atlas.colorSpace = THREE.SRGBColorSpace
// Explicit bounds accommodate the painted atlas rather than assuming uniform rows.
const rows = { SURVIVOR: [0, 314], REGULAR: [314, 630], RUNNER: [630, 878], BRUTE: [878, 1254] }
const frames = new Map()
const worldRotation = new THREE.Quaternion()
const forward = new THREE.Vector3()

function characterFrames(type) {
  if (frames.has(type)) return frames.get(type)
  const [top, bottom] = rows[type]
  const textures = Array.from({ length: 4 }, (_, column) => {
    const texture = atlas.clone()
    texture.repeat.set(0.25, (bottom - top) / 1254)
    texture.offset.set(column / 4, 1 - bottom / 1254)
    // Clones share the source image, including when created before loading finishes.
    return texture
  })
  frames.set(type, textures)
  return textures
}

export function attachCharacterSprite(actor, type, height) {
  const material = new THREE.SpriteMaterial({
    map: characterFrames(type)[0], transparent: true, alphaTest: 0.12,
    depthWrite: true, toneMapped: false, fog: true,
  })
  const sprite = new THREE.Sprite(material)
  sprite.name = 'character-art'
  sprite.center.set(0.5, 0.04)
  sprite.position.y = 0.06
  const [top, bottom] = rows[type]
  const width = height * (1254 / 4) / (bottom - top)
  sprite.scale.set(width, height, 1)
  actor.add(sprite)
  actor.userData.spriteArt = { sprite, type, width, height }
  // Sprite billboards face the camera; choose the painted view from world heading.
  sprite.onBeforeRender = () => {
    actor.getWorldQuaternion(worldRotation)
    forward.set(0, 0, 1).applyQuaternion(worldRotation)
    const angle = Math.atan2(forward.x, forward.z)
    const quadrant = ((Math.round(angle / (Math.PI / 2)) % 4) + 4) % 4
    const column = [0, 3, 2, 1][quadrant]
    material.map = characterFrames(type)[column]
  }
  return sprite
}

export function updateCharacterSprite(actor, time, state = 'idle', progress = 0) {
  const art = actor.userData.spriteArt
  if (!art) return
  const { sprite, width, height } = art
  const moving = state === 'walking'
  const pace = art.type === 'RUNNER' ? 14 : art.type === 'BRUTE' ? 6 : 9
  const stride = moving ? Math.sin(time * pace) : Math.sin(time * 2) * 0.12
  const attack = state === 'attacking' ? Math.sin(Math.min(time, 1) * Math.PI) : 0
  sprite.position.y = 0.06 + (moving ? Math.abs(stride) * 0.07 : 0)
  sprite.material.rotation = stride * 0.025 + attack * 0.14
  sprite.scale.set(width * (1 + attack * 0.08), height * (1 + stride * 0.015), 1)
  sprite.material.color.setHex(Date.now() - (actor.userData.hitTime || 0) < 160 ? 0xff7777 : 0xffffff)
  if (state === 'dying') {
    const fall = THREE.MathUtils.smoothstep(progress, 0.05, 0.8)
    sprite.material.rotation = -fall * Math.PI / 2
    sprite.scale.set(width * (1 - fall * 0.25), height * (1 - fall * 0.45), 1)
    sprite.material.opacity = 1 - THREE.MathUtils.smoothstep(progress, 0.5, 1)
    sprite.visible = progress < 1
  }
}

export function disposeCharacterSprite(actor) {
  actor.userData.spriteArt?.sprite.material.dispose()
  // Atlas textures are shared for the whole session, never disposed per enemy.
}

const propAtlas = loader.load('/sprites/props-v1.png')
propAtlas.colorSpace = THREE.SRGBColorSpace
const propMaterials = Array.from({ length: 4 }, (_, index) => {
  const map = propAtlas.clone()
  map.repeat.set(0.5, 0.5)
  map.offset.set((index % 2) / 2, index < 2 ? 0.5 : 0)
  return new THREE.SpriteMaterial({ map, alphaTest: 0.15, depthWrite: true, toneMapped: false })
})

export function createPropSprite(index, width = 4) {
  const sprite = new THREE.Sprite(propMaterials[index])
  sprite.name = ['sandbags-art', 'crates-art', 'drums-art', 'rubble-art'][index]
  sprite.center.set(0.5, 0.08)
  sprite.scale.set(width, width, 1)
  return sprite
}

export function createGroundTexture() {
  const texture = loader.load('/sprites/courtyard-v1.png')
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(50, 50)
  texture.anisotropy = 8
  return texture
}
