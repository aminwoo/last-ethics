// Character class definitions for role-playing elements

export const CHARACTER_CLASSES = {
  soldier: {
    id: 'soldier',
    name: 'Soldier',
    description:
      'A battle-hardened warrior with balanced stats and extra damage.',
    icon: '🎖️',
    color: 0x4a90d9, // Blue
    bodyColor: 0x3366ff,
    stats: {
      maxHealth: 100,
      maxStamina: 100,
      moveSpeed: 1.0,
      sprintMultiplier: 1.5,
      damageMultiplier: 1.15,
      reloadSpeedMultiplier: 1.0,
      staminaRegenRate: 10,
      staminaDrainRate: 25,
    },
    abilities: ['Weapon Mastery: +15% weapon damage'],
  },

  medic: {
    id: 'medic',
    name: 'Medic',
    description:
      'A field medic with enhanced regeneration and survival skills.',
    icon: '💉',
    color: 0x4ad94a, // Green
    bodyColor: 0x33aa33,
    stats: {
      maxHealth: 120,
      maxStamina: 90,
      moveSpeed: 0.95,
      sprintMultiplier: 1.4,
      damageMultiplier: 0.9,
      reloadSpeedMultiplier: 1.0,
      staminaRegenRate: 12,
      staminaDrainRate: 25,
      healthRegenRate: 2, // Unique: regenerates 2 HP per second
    },
    abilities: ['Regeneration: +2 HP per second', '+20% max health'],
  },

  scout: {
    id: 'scout',
    name: 'Scout',
    description: 'A swift recon specialist with superior speed and agility.',
    icon: '🏃',
    color: 0xd9d94a, // Yellow
    bodyColor: 0xccaa33,
    stats: {
      maxHealth: 80,
      maxStamina: 150,
      moveSpeed: 1.25,
      sprintMultiplier: 1.7,
      damageMultiplier: 0.95,
      reloadSpeedMultiplier: 1.2,
      staminaRegenRate: 15,
      staminaDrainRate: 20,
    },
    abilities: ['Swift: +25% movement speed', 'Endurance: +50% stamina'],
  },

  heavy: {
    id: 'heavy',
    name: 'Heavy',
    description: 'A tank-like brute with massive health but slower movement.',
    icon: '🛡️',
    color: 0xd94a4a, // Red
    bodyColor: 0xaa3333,
    stats: {
      maxHealth: 150,
      maxStamina: 70,
      moveSpeed: 0.8,
      sprintMultiplier: 1.3,
      damageMultiplier: 1.1,
      reloadSpeedMultiplier: 0.85,
      staminaRegenRate: 8,
      staminaDrainRate: 30,
      damageReduction: 0.15, // Takes 15% less damage
    },
    abilities: ['Tank: +50% max health', 'Armor: 15% damage reduction'],
  },

  assassin: {
    id: 'assassin',
    name: 'Assassin',
    description:
      'A deadly specialist with critical hit chance and fast reloads.',
    icon: '🗡️',
    color: 0x9b4ad9, // Purple
    bodyColor: 0x663399,
    stats: {
      maxHealth: 75,
      maxStamina: 120,
      moveSpeed: 1.1,
      sprintMultiplier: 1.6,
      damageMultiplier: 1.0,
      reloadSpeedMultiplier: 1.3,
      staminaRegenRate: 12,
      staminaDrainRate: 22,
      critChance: 0.2, // 20% chance to deal double damage
      critMultiplier: 2.0,
    },
    abilities: [
      'Critical Strike: 20% chance for 2x damage',
      'Quick Hands: +30% reload speed',
    ],
  },

  engineer: {
    id: 'engineer',
    name: 'Engineer',
    description:
      'A tactical expert with enhanced turret support and ammo efficiency.',
    icon: '🔧',
    color: 0xd9904a, // Orange
    bodyColor: 0xcc6633,
    stats: {
      maxHealth: 90,
      maxStamina: 100,
      moveSpeed: 0.95,
      sprintMultiplier: 1.45,
      damageMultiplier: 1.0,
      reloadSpeedMultiplier: 1.15,
      staminaRegenRate: 10,
      staminaDrainRate: 25,
      ammoEfficiency: 0.15, // 15% chance to not consume ammo
      turretDamageBonus: 0.25, // Turrets deal 25% more damage
    },
    abilities: [
      'Ammo Saver: 15% chance to save ammo',
      'Turret Expert: +25% turret damage',
    ],
  },
}

// Default class if none selected
export const DEFAULT_CLASS = 'soldier'

// Get a class by ID
export function getClass(classId) {
  return CHARACTER_CLASSES[classId] || CHARACTER_CLASSES[DEFAULT_CLASS]
}

// Get all available classes
export function getAllClasses() {
  return Object.values(CHARACTER_CLASSES)
}

// Calculate effective damage with class modifiers
export function calculateDamage(baseDamage, classStats) {
  let damage = baseDamage * (classStats.damageMultiplier || 1.0)

  // Check for critical hit
  if (classStats.critChance && Math.random() < classStats.critChance) {
    damage *= classStats.critMultiplier || 2.0
    console.log('Critical hit!')
  }

  return Math.floor(damage)
}

// Calculate damage taken with class modifiers
export function calculateDamageTaken(baseDamage, classStats) {
  const reduction = classStats.damageReduction || 0
  return Math.floor(baseDamage * (1 - reduction))
}

// Check if ammo should be consumed (for engineer class)
export function shouldConsumeAmmo(classStats) {
  if (classStats.ammoEfficiency && Math.random() < classStats.ammoEfficiency) {
    console.log('Ammo saved!')
    return false
  }
  return true
}

// Get reload time with class modifier
export function getReloadTime(baseReloadTime, classStats) {
  return baseReloadTime / (classStats.reloadSpeedMultiplier || 1.0)
}
