import { gameState, startNextWave } from '../core/gameState.js'
import { setInputDisabled } from '../input.js'

export const SURVIVAL_UPGRADES = [
  { name: 'Hollow point', type: 'FIREPOWER', description: '+20% damage with every weapon.', apply: () => gameState.weapons.forEach(w => { w.damage *= 1.2 }) },
  { name: 'Field medicine', type: 'SURVIVABILITY', description: '+25 maximum health. Fully restore health.', apply: () => { gameState.maxHealth += 25; gameState.health = gameState.maxHealth } },
  { name: 'Extended magazines', type: 'CAPACITY', description: '+25% magazine capacity. Reload all weapons.', apply: () => gameState.weapons.forEach(w => { w.maxAmmo = Math.ceil(w.maxAmmo * 1.25); w.ammo = w.maxAmmo; w.isReloading = false }) },
  { name: 'Quick hands', type: 'HANDLING', description: 'Reload every weapon 15% faster.', apply: () => gameState.weapons.forEach(w => { w.reloadTime *= .85 }) },
  { name: 'Second wind', type: 'ENDURANCE', description: '+30 maximum stamina. +20% stamina recovery.', apply: () => { gameState.maxStamina += 30; gameState.stamina = gameState.maxStamina; gameState.staminaRegenRate *= 1.2 } },
  { name: 'Regenerative tissue', type: 'RECOVERY', description: 'Permanently regenerate 1 extra health per second.', apply: () => { gameState.healthRegenRate += 1 } },
]

export function initializeSurvival(input) {
  const root = document.getElementById('ui-container')
  const hud = document.createElement('div')
  hud.innerHTML = `<div class="run-clock" id="run-clock">RUN 00:00</div>
    <div class="mission-notice" role="status"><strong></strong><span></span></div>
    <div class="kill-feed" aria-hidden="true"></div><div class="hit-marker" aria-hidden="true">×</div>
    <div class="reload-track" hidden><span></span></div>
    <div class="field-controls"><button id="next-wave-button" hidden>ENTER / NEXT WAVE</button><button id="pause-button">ESC / FIELD GUIDE</button></div>`
  root.append(hud)
  const overlay = document.createElement('div')
  overlay.className = 'field-overlay'
  overlay.hidden = true
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', 'Field operations')
  document.body.append(overlay)
  const notice = hud.querySelector('.mission-notice')
  const marker = hud.querySelector('.hit-marker')
  const feed = hud.querySelector('.kill-feed')
  const clock = hud.querySelector('.run-clock')
  const next = hud.querySelector('#next-wave-button')
  const reload = hud.querySelector('.reload-track')
  let noticeUntil = 0, hitUntil = 0, pauseStart = 0, choosing = false
  let previousFocus = null

  function announce(title, detail) {
    notice.querySelector('strong').textContent = title
    notice.querySelector('span').textContent = detail
    noticeUntil = gameState.gameTime + 3
    notice.classList.add('visible')
  }
  function pause() {
    document.dispatchEvent(new CustomEvent('closeInventory'))
    pauseStart = performance.now()
    previousFocus = document.activeElement
    gameState.isPaused = true
    setInputDisabled(input, true)
    overlay.hidden = false
  }
  function resume() {
    // Weapons use wall-clock timestamps; exclude time spent in menus.
    const elapsed = (performance.now() - pauseStart) / 1000
    gameState.weapons.forEach(w => {
      if (w.isReloading) w.reloadStartTime += elapsed
      w.lastFired += elapsed
    })
    gameState.isPaused = false
    setInputDisabled(input, false)
    overlay.hidden = true
    previousFocus?.focus()
  }
  function showPause() {
    if (gameState.isGameOver || choosing || input.inventoryModifier) return
    if (gameState.isPaused) { resume(); return }
    pause()
    overlay.innerHTML = `<div class="field-sheet"><div class="eyebrow">FIELD OPERATIONS / SECTOR 07</div><h2>HOLD YOUR POSITION.</h2><p>The fight can wait. Take a breath.</p>
      <div class="field-guide"><div><kbd>W A S D</kbd> Move</div><div><kbd>MOUSE</kbd> Aim & fire</div><div><kbd>SHIFT</kbd> Sprint</div><div><kbd>R</kbd> Reload</div><div><kbd>1 — 4</kbd> Switch weapon</div><div><kbd>F</kbd> Flashlight</div><div><kbd>I</kbd> Inventory</div><div><kbd>ENTER</kbd> Next wave</div></div>
      <p>Stay mobile. Watch your stamina. Use the turrets to cover your retreat.<br>Clear a wave to earn supplies and a permanent upgrade.</p><button class="field-button">RESUME OPERATION ↗</button></div>`
    overlay.querySelector('button').onclick = resume
    overlay.querySelector('button').focus()
  }
  hud.querySelector('#pause-button').onclick = showPause
  next.onclick = () => startNextWave()
  window.addEventListener('keydown', event => {
    if (event.target instanceof Element && event.target.closest('input, textarea, [contenteditable="true"]')) return
    if (event.key === 'Tab' && !overlay.hidden) {
      const buttons = [...overlay.querySelectorAll('button')]
      const index = buttons.indexOf(document.activeElement)
      event.preventDefault()
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus()
    }
    if (event.repeat) return
    if (event.key === 'Escape') showPause()
    if (event.key === 'Enter' && !gameState.isPaused && !input.inventoryModifier && gameState.currentWave > 0) startNextWave()
  })
  window.addEventListener('blur', () => { if (!gameState.isPaused) showPause() })
  document.addEventListener('visibilitychange', () => { if (document.hidden && !gameState.isPaused) showPause() })
  document.addEventListener('waveStart', event => announce(`WAVE ${String(event.detail.wave).padStart(2, '0')}`, `${event.detail.zombieCount} HOSTILES INBOUND / HOLD THE LINE`))
  document.addEventListener('waveComplete', () => {
    choosing = true
    pause()
    // Fisher–Yates gives every upgrade the same chance of appearing.
    const choices = [...SURVIVAL_UPGRADES]
    for (let i = choices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[choices[i], choices[j]] = [choices[j], choices[i]]
    }
    overlay.innerHTML = `<div class="field-sheet"><div class="eyebrow">WAVE ${String(gameState.currentWave).padStart(2, '0')} / PERIMETER SECURED</div><h2>LIVE. LEARN. RELOAD.</h2><p>+15 health & ammunition delivered. Choose your next advantage.<br>Upgrades stack and last until the end of this run.</p><div class="upgrade-grid"></div><p>The next wave waits until you've made your choice.</p></div>`
    choices.slice(0, 3).forEach((upgrade, index) => {
      const button = document.createElement('button')
      button.className = 'upgrade-card'
      button.innerHTML = `<small>0${index + 1} / ${upgrade.type}</small><strong>${upgrade.name}</strong><span>${upgrade.description}</span>`
      button.onclick = () => {
        if (!choosing) return
        upgrade.apply()
        gameState.upgrades++
        choosing = false
        resume()
        announce('UPGRADE EQUIPPED', `${upgrade.name.toUpperCase()} / ENTER TO CALL THE NEXT WAVE`)
      }
      overlay.querySelector('.upgrade-grid').append(button)
    })
    overlay.querySelector('button').focus()
  })
  document.addEventListener('bulletHit', () => {
    hitUntil = gameState.gameTime + .12
    marker.className = 'hit-marker active'
  })
  document.addEventListener('zombieKilled', event => {
    marker.className = 'hit-marker active kill'
    hitUntil = gameState.gameTime + .2
    const item = document.createElement('div')
    item.textContent = `${event.detail.zombieType} NEUTRALIZED  +${event.detail.scoreValue}`
    item.dataset.expires = gameState.gameTime + 4
    feed.prepend(item)
    while (feed.children.length > 4) feed.lastChild.remove()
  })
  document.addEventListener('runReset', () => {
    choosing = false
    overlay.hidden = true
    feed.replaceChildren()
    setInputDisabled(input, false)
    announce('WELCOME TO SECTOR 07', 'WASD TO MOVE / CLICK TO FIRE / ESC FOR FIELD GUIDE')
  })
  document.addEventListener('runEnded', () => {
    setInputDisabled(input, true)
    try {
      const best = Number(localStorage.getItem('last-ethics-best') || 0)
      if (gameState.score > best) localStorage.setItem('last-ethics-best', String(gameState.score))
    } catch { /* Storage may be disabled in private contexts. */ }
  })
  announce('WELCOME TO SECTOR 07', 'WASD TO MOVE / CLICK TO FIRE / ESC FOR FIELD GUIDE')
  return {
    update() {
      const seconds = Math.floor(gameState.gameTime)
      clock.textContent = `RUN ${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} / ${gameState.upgrades} UPGRADES`
      next.hidden = gameState.waveInProgress || gameState.currentWave === 0
      notice.classList.toggle('visible', gameState.gameTime < noticeUntil)
      if (gameState.gameTime > hitUntil) marker.classList.remove('active')
      marker.style.left = `${input.clientMousePosition.x}px`
      marker.style.top = `${input.clientMousePosition.y}px`
      for (const item of [...feed.children]) if (Number(item.dataset.expires) < gameState.gameTime) item.remove()
      const weapon = gameState.weapon
      reload.hidden = !weapon.isReloading
      if (weapon.isReloading) reload.firstChild.style.width = `${Math.min(100, (performance.now() / 1000 - weapon.reloadStartTime) / (weapon.reloadTime / gameState.reloadSpeedMultiplier) * 100)}%`
    },
  }
}

try {
  const best = Number(localStorage.getItem('last-ethics-best') || 0)
  if (best > 0) document.getElementById('personal-best').textContent = `PERSONAL BEST / ${best.toLocaleString()}`
} catch { /* The game remains playable without storage. */ }
