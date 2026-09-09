import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { test } from 'node:test'
import * as THREE from 'three'

async function harness() {
  const textures = []
  class TextureLoader {
    load(url) {
      const texture = new THREE.Texture()
      textures.push({ url, texture })
      return texture
    }
  }
  const exports = { ...THREE, TextureLoader }
  const context = vm.createContext({ Date, Math, Map })
  const three = new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
  }, { context })
  const module = new vm.SourceTextModule(await readFile(new URL('../src/gameplay/sprites.js', import.meta.url), 'utf8'), { context })
  await module.link(() => three)
  await module.evaluate()
  return { ...module.namespace, textures }
}

test('painted views follow all world headings, including a rotated parent', async () => {
  const h = await harness()
  const parent = new THREE.Group()
  const actor = new THREE.Group()
  parent.add(actor)
  const sprite = h.attachCharacterSprite(actor, 'SURVIVOR', 2.8)
  for (const [angle, column] of [[0, 0], [Math.PI / 2, 3], [Math.PI, 2], [-Math.PI / 2, 1]]) {
    parent.rotation.y = angle
    sprite.onBeforeRender()
    assert.equal(sprite.material.map.offset.x, column / 4)
  }
})

test('enemies share texture sources but keep hit flashes and death effects independent', async () => {
  const h = await harness()
  const a = new THREE.Group(), b = new THREE.Group()
  const first = h.attachCharacterSprite(a, 'REGULAR', 2.7)
  const second = h.attachCharacterSprite(b, 'REGULAR', 2.7)
  assert.equal(first.material.map, second.material.map)
  assert.notEqual(first.material, second.material)
  a.userData.hitTime = Date.now()
  h.updateCharacterSprite(a, 0.2, 'walking')
  assert.equal(first.material.color.getHex(), 0xff7777)
  assert.equal(second.material.color.getHex(), 0xffffff)
  h.updateCharacterSprite(a, 1.5, 'dying', 1)
  assert.equal(first.visible, false)
  assert.equal(second.visible, true)
  let textureDisposed = false, materialDisposed = false
  first.material.map.addEventListener('dispose', () => { textureDisposed = true })
  first.material.addEventListener('dispose', () => { materialDisposed = true })
  h.disposeCharacterSprite(a)
  assert.equal(materialDisposed, true)
  assert.equal(textureDisposed, false)
})

test('atlas views keep the shared source when images finish loading after actor creation', async () => {
  const h = await harness()
  const sprite = h.attachCharacterSprite(new THREE.Group(), 'BRUTE', 3.4)
  const atlas = h.textures.find(({ url }) => url.includes('characters')).texture
  const image = { width: 1254, height: 1254 }
  atlas.image = image
  atlas.needsUpdate = true
  assert.equal(sprite.material.map.image, image)
  assert.ok(sprite.material.map.version > 0)
  assert.ok(sprite.material.map.offset.y >= 0)
  assert.ok(sprite.material.map.repeat.y < 1)
})
