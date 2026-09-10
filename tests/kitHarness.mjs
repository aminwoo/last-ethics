import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

// Parse the real meshes, skeletons and clips; omit only image decoding, which
// Node has no decoder for. No fake rigs and no replacement animation data.
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init) } }

const assets = new Map()

export class AssetLoader {
  async loadAsync(url) {
    if (!assets.has(url)) {
      const json = JSON.parse(await readFile(new URL(`../public${url}`, import.meta.url), 'utf8'))
      for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material
      delete json.materials
      delete json.textures
      delete json.images
      assets.set(url, await new GLTFLoader().parseAsync(JSON.stringify(json), ''))
    }
    return assets.get(url)
  }
}

// Loads a game module inside a vm, compiling the local modules it imports so a
// test exercises the real dependency graph rather than a stub of it.
export async function loadGameModule(entry, { globals = {}, stubs = {} } = {}) {
  const context = vm.createContext({ Date, Math, Error, Infinity, console, ...globals })
  const shared = new Map()
  for (const [id, exports] of [
    ['three', THREE],
    ['three/examples/jsm/loaders/GLTFLoader.js', { GLTFLoader: AssetLoader }],
    ['three/examples/jsm/utils/SkeletonUtils.js', { clone }],
    ...Object.entries(stubs),
  ]) {
    shared.set(id, new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value)
    }, { context }))
  }
  const compiled = new Map()
  const compile = async url => {
    if (compiled.has(url.href)) return compiled.get(url.href)
    const module = new vm.SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href })
    compiled.set(url.href, module)
    await module.link(async specifier =>
      shared.get(specifier) ?? compile(new URL(specifier, url)))
    return module
  }
  const module = await compile(new URL(entry, import.meta.url))
  await module.evaluate()
  return module.namespace
}
