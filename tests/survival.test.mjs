import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { test } from 'node:test'

// Exercise the real state and upgrade modules without a WebGL/audio device.
// Only platform services and the weapon renderer are replaced.
async function harness() {
  const events = []
  const elements = new Map()
  const context = vm.createContext({
    console: { log() {} }, Date, Math, performance,
    window: {},
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail } },
    document: {
      dispatchEvent(event) { events.push(event) },
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { textContent: '', style: {} })
        return elements.get(id)
      },
    },
  })
  const weaponSource = await readFile(new URL('../src/gameplay/weapons.js', import.meta.url), 'utf8')
  const literal = weaponSource.slice(weaponSource.indexOf('export const weapons ='), weaponSource.indexOf('\nlet bullets ='))
  const weapons = vm.runInContext(literal.replace('export const', 'const') + '\nweapons', context)
  const modules = new Map()
  function synthetic(id, values) {
    const module = new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value)
    }, { context, identifier: id })
    modules.set(id, module)
  }
  synthetic('gameplay/weapons.js', { weapons, switchWeapon() {}, reloadWeapon() {}, checkReloadCompletion() {} })
  synthetic('services/sound.js', { default: { playSound() {} } })
  synthetic('services/network.js', { sendPlayerDeathEvent() {} })
  for (const id of ['core/gameState.js', 'core/classes.js', 'input.js', 'ui/survival.js']) {
    modules.set(id, new vm.SourceTextModule(await readFile(new URL(`../src/${id}`, import.meta.url), 'utf8'), { context, identifier: id }))
  }
  const resolve = (specifier, referencing) => {
    const resolved = new URL(specifier, `file:///src/${referencing.identifier}`).pathname.replace('/src/', '')
    return modules.get(resolved)
  }
  const survival = modules.get('ui/survival.js')
  await survival.link(resolve)
  await survival.evaluate()
  const state = modules.get('core/gameState.js').namespace
  state.setPlayerClass('soldier')
  state.initializeGameState()
  return { ...state, upgrades: survival.namespace.SURVIVAL_UPGRADES, events, elements }
}

test('first wave follows simulation time and cannot start while paused', async () => {
  const h = await harness()
  h.gameState.isPaused = true
  h.updateGameState(20, {})
  h.startNextWave()
  assert.equal(h.gameState.currentWave, 0)
  h.gameState.isPaused = false
  h.updateGameState(2.9, {})
  assert.equal(h.gameState.currentWave, 0)
  h.updateGameState(.2, {})
  assert.equal(h.gameState.currentWave, 1)
  assert.equal(h.gameState.zombiesRemainingInWave, 10)
  assert.equal(h.events.filter(e => e.type === 'waveStart').length, 1)
})

test('clearing a wave awards score, health, supplies and one upgrade event', async () => {
  const h = await harness()
  h.startNextWave()
  h.gameState.health = 50
  const reserve = h.gameState.weapon.totalAmmo
  for (let i = 0; i < 10; i++) h.recordZombieKill('REGULAR')
  assert.equal(h.gameState.score, 1500)
  assert.equal(h.gameState.health, 65)
  assert.equal(h.gameState.weapon.totalAmmo, reserve + 24)
  assert.equal(h.gameState.waveInProgress, false)
  assert.equal(h.events.filter(e => e.type === 'waveComplete').length, 1)
  h.updateGameState(12, {})
  assert.equal(h.gameState.currentWave, 2)
  assert.equal(h.gameState.zombiesRemainingInWave, 14)
})

test('all upgrades apply, stack, and reset with a fresh run', async () => {
  const h = await harness()
  const initial = { damage: h.gameState.weapon.damage, capacity: h.gameState.weapon.maxAmmo, health: h.gameState.maxHealth, reload: h.gameState.weapon.reloadTime, stamina: h.gameState.maxStamina }
  for (const upgrade of h.upgrades) { upgrade.apply(); upgrade.apply() }
  assert.equal(h.gameState.weapon.damage, initial.damage * 1.2 * 1.2)
  assert.equal(h.gameState.maxHealth, initial.health + 50)
  assert.equal(h.gameState.health, h.gameState.maxHealth)
  assert.equal(h.gameState.maxStamina, initial.stamina + 60)
  assert.equal(h.gameState.healthRegenRate, 2)
  assert.ok(h.gameState.weapon.maxAmmo > initial.capacity)
  assert.ok(h.gameState.weapon.reloadTime < initial.reload)
  h.gameState.isPaused = true
  h.gameState.upgrades = 6
  h.initializeGameState()
  assert.equal(h.gameState.weapon.damage, initial.damage)
  assert.equal(h.gameState.weapon.maxAmmo, initial.capacity)
  assert.equal(h.gameState.maxHealth, initial.health)
  assert.equal(h.gameState.healthRegenRate, 0)
  assert.equal(h.gameState.isPaused, false)
  assert.equal(h.gameState.upgrades, 0)
})

test('game-over survival time excludes paused wall time', async () => {
  const h = await harness()
  h.gameState.gameTime = 125
  h.gameOver()
  assert.equal(h.elements.get('survival-time').textContent, '2:05')
  h.gameOver()
  assert.equal(h.events.filter(e => e.type === 'runEnded').length, 1)
})
