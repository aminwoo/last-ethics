import * as THREE from 'three';
import SoundManager from './sound.js';

// Store all active turrets
const turrets = [];

// Constants for turret properties
const TURRET_FIRE_RATE = 0.15; // seconds between shots
const TURRET_RANGE = 30; // How far the turret can detect and shoot zombies
const TURRET_DAMAGE = 35; // Damage per bullet
const TURRET_ROTATION_SPEED = 5.0; // How fast the turret can rotate
const TURRET_BULLET_SPEED = 1.0; // Speed of turret bullets
const TURRET_BULLET_LIFETIME = 1000; // milliseconds

/**
 * Create a machine gun turret
 * @param {THREE.Scene} scene - The game scene
 * @param {THREE.Vector3} position - The position to place the turret
 * @returns {Object} The turret object
 */
export function createTurret(scene, position) {
    // Create the turret group
    const turret = new THREE.Group();
    turret.position.copy(position);
    turret.name = 'turret';

    // Create base
    const baseGeometry = new THREE.CylinderGeometry(1, 1.2, 0.5, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x555555,
        metalness: 0.8,
        roughness: 0.2
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    turret.add(base);

    // Create middle rotating part
    const middleGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 8);
    const middleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x777777,
        metalness: 0.7,
        roughness: 0.3
    });
    const middle = new THREE.Mesh(middleGeometry, middleMaterial);
    middle.position.y = 0.5;
    turret.add(middle);

    // Create gun mount
    const mountGeometry = new THREE.BoxGeometry(1.5, 0.4, 0.8);
    const mountMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444,
        metalness: 0.9,
        roughness: 0.1
    });
    const mount = new THREE.Mesh(mountGeometry, mountMaterial);
    mount.position.y = 0.8;
    middle.add(mount);

    // Create gun barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8);
    barrelGeometry.rotateZ(Math.PI / 2); // Rotate to point forward
    const barrelMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        metalness: 0.9,
        roughness: 0.1
    });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.position.set(1.0, 0, 0); // Position barrel at the end of the mount
    barrel.name = 'turretBarrel';
    mount.add(barrel);

    // Add a small muzzle at the end of the barrel
    const muzzleGeometry = new THREE.CylinderGeometry(0.2, 0.17, 0.3, 8);
    muzzleGeometry.rotateZ(Math.PI / 2);
    const muzzleMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x222222,
        metalness: 0.9,
        roughness: 0.1
    });
    const muzzle = new THREE.Mesh(muzzleGeometry, muzzleMaterial);
    muzzle.position.set(1.5, 0, 0);
    mount.add(muzzle);

    // Create bullet starting position
    const bulletSpawnPoint = new THREE.Object3D();
    bulletSpawnPoint.position.set(1.7, 0, 0);
    bulletSpawnPoint.name = 'bulletSpawnPoint';
    mount.add(bulletSpawnPoint);

    // Add a spotlight to the turret for visual effect
    const spotlight = new THREE.SpotLight(0xffffcc, 5, 10, Math.PI / 8, 0.5, 1);
    spotlight.position.set(1.5, 0.1, 0);
    spotlight.target.position.set(5, 0, 0);
    mount.add(spotlight);
    mount.add(spotlight.target);

    // Add shadow casting
    base.castShadow = true;
    middle.castShadow = true;
    mount.castShadow = true;
    barrel.castShadow = true;
    muzzle.castShadow = true;
    base.receiveShadow = true;
    middle.receiveShadow = true;
    mount.receiveShadow = true;
    barrel.receiveShadow = true;
    muzzle.receiveShadow = true;

    // Initial orientation - make sure mount points forward
    mount.rotation.z = 0;
    
    // Add turret to scene
    scene.add(turret);
    
    // Store turret data
    const turretData = {
        object: turret,
        mount: middle, // The middle part that rotates
        barrel: mount, // The mount that holds the gun barrel
        bulletSpawn: bulletSpawnPoint,
        spotlight: spotlight,
        lastFired: 0,
        targetZombie: null,
        range: TURRET_RANGE,
        fireRate: TURRET_FIRE_RATE,
        damage: TURRET_DAMAGE,
        rotationSpeed: TURRET_ROTATION_SPEED,
        ammo: Infinity, // Unlimited ammo for turrets
        active: true,
        bullets: [],
        // Add initial direction the turret is facing
        initialDirection: new THREE.Vector3(0, 0, -1)
    };
    
    // Add to global turrets array
    turrets.push(turretData);
    
    return turretData;
}

/**
 * Find the closest zombie to a turret
 * @param {Object} turret - The turret data
 * @param {Array} zombies - Array of zombies
 * @returns {Object} The closest zombie, or null if none in range
 */
function findClosestZombie(turret, zombies) {
    let closestDistance = turret.range;
    let closestZombie = null;
    
    zombies.forEach(zombie => {
        if (zombie.userData.health <= 0) return;
        
        const distance = turret.object.position.distanceTo(zombie.position);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestZombie = zombie;
        }
    });
    
    return closestZombie;
}

/**
 * Rotate turret to face a target
 * @param {Object} turret - The turret data
 * @param {THREE.Vector3} targetPosition - Position to rotate towards
 * @param {number} deltaTime - Time since last frame
 * @returns {boolean} True if rotation is complete/close enough
 */
function rotateTurretToTarget(turret, targetPosition, deltaTime) {
    // Calculate direction to target
    const turretPosition = new THREE.Vector3();
    turret.object.getWorldPosition(turretPosition);
    
    // Vector from turret to target
    const direction = new THREE.Vector3().subVectors(targetPosition, turretPosition);
    direction.y = 0; // Keep rotation on xz plane only
    direction.normalize();
    
    // In THREE.js, the default front direction is negative Z (0,0,-1)
    // Calculate the angle between current facing direction and target direction
    const targetAngle = Math.atan2(direction.x, direction.z) - Math.PI / 2;
    
    // Get current rotation of middle part
    let currentRotationY = turret.mount.rotation.y;
    
    // Calculate the shortest path to rotate
    let angleDifference = targetAngle - currentRotationY;
    
    // Normalize the angle to be between -PI and PI
    while (angleDifference > Math.PI) angleDifference -= Math.PI * 2;
    while (angleDifference < -Math.PI) angleDifference += Math.PI * 2;
    
    // Calculate how much to rotate this frame based on rotation speed
    const rotationAmount = Math.min(
        Math.abs(angleDifference),
        turret.rotationSpeed * deltaTime
    ) * Math.sign(angleDifference);
    
    // Apply the rotation to the middle part
    turret.mount.rotation.y += rotationAmount;
    
    // Return true if we're close enough to the target angle
    return Math.abs(angleDifference) < 0.1;
}

/**
 * Fire a bullet from a turret
 * @param {Object} turret - The turret data
 * @param {THREE.Scene} scene - The game scene
 * @param {THREE.Vector3} targetPosition - Position to fire at
 */
function fireTurretBullet(turret, scene, targetPosition) {
    // Get bullet spawn position
    const bulletPosition = new THREE.Vector3();
    turret.bulletSpawn.getWorldPosition(bulletPosition);
    
    // Calculate direction to target - this ensures bullets go toward the target
    const direction = new THREE.Vector3().subVectors(targetPosition, bulletPosition).normalize();
    
    // Create bullet
    const bulletGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const bulletMaterial = new THREE.MeshStandardMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 0.8
    });
    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
    bullet.position.copy(bulletPosition);
    scene.add(bullet);
    
    // Add bullet light
    const bulletLight = new THREE.PointLight(0xffff00, 1, 3);
    bulletLight.position.copy(bulletPosition);
    scene.add(bulletLight);
    
    // Create muzzle flash
    createMuzzleFlash(turret, scene);
    
    // Play shooting sound
    //if (SoundManager) {
    //    SoundManager.playTurretShot(); // Lower volume for turret
    //}
    
    // Store bullet data
    turret.bullets.push({
        mesh: bullet,
        light: bulletLight,
        velocity: direction.multiplyScalar(TURRET_BULLET_SPEED),
        createdAt: Date.now(),
        damage: turret.damage
    });
    
    // Update last fired time
    turret.lastFired = performance.now() / 1000;
}

/**
 * Create muzzle flash effect for a turret
 * @param {Object} turret - The turret data
 * @param {THREE.Scene} scene - The game scene
 */
function createMuzzleFlash(turret, scene) {
    // Get muzzle position
    const muzzlePosition = new THREE.Vector3();
    turret.bulletSpawn.getWorldPosition(muzzlePosition);
    
    // Create point light for flash
    const flashLight = new THREE.PointLight(0xffff00, 3, 5);
    flashLight.position.copy(muzzlePosition);
    scene.add(flashLight);
    
    // Create a small sphere for the flash visual
    const flashGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffaa,
        transparent: true,
        opacity: 0.8
    });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.copy(muzzlePosition);
    scene.add(flashMesh);
    
    // Illuminate the turret's spotlight briefly
    turret.spotlight.intensity = 10;
    
    // Remove flash after a short time
    setTimeout(() => {
        scene.remove(flashLight);
        scene.remove(flashMesh);
        turret.spotlight.intensity = 5;
    }, 100);
}

/**
 * Update all turrets (targeting, rotation, firing)
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {THREE.Scene} scene - The game scene
 * @param {Array} zombies - Array of all zombies
 */
export function updateTurrets(deltaTime, scene, zombies) {
    const currentTime = performance.now() / 1000;
    
    // Update each turret
    turrets.forEach(turret => {
        if (!turret.active) return;
        
        // Find nearest zombie if we don't have a target or current target is dead
        if (!turret.targetZombie || turret.targetZombie.userData.health <= 0) {
            turret.targetZombie = findClosestZombie(turret, zombies);
        }
        
        // If we have a target, rotate to face it and fire when ready
        if (turret.targetZombie) {
            // Check if target is still in range
            const distanceToTarget = turret.object.position.distanceTo(turret.targetZombie.position);
            
            if (distanceToTarget <= turret.range) {
                // Rotate turret to face zombie
                const isAimed = rotateTurretToTarget(
                    turret,
                    turret.targetZombie.position,
                    deltaTime
                );
                
                // If aimed correctly and enough time has passed since last shot, fire
                if (isAimed && currentTime - turret.lastFired >= turret.fireRate) {
                    fireTurretBullet(
                        turret,
                        scene,
                        turret.targetZombie.position.clone().add(new THREE.Vector3(0, 1, 0))
                    );
                }
            } else {
                // Target out of range, clear it
                turret.targetZombie = null;
            }
        } else {
            // No target, rotate slowly to scan for threats
            turret.mount.rotation.y += 0.2 * deltaTime;
        }
        
        // Update bullets
        updateTurretBullets(turret, scene, zombies, deltaTime);
    });
}

/**
 * Update turret bullets (movement and collision detection)
 * @param {Object} turret - The turret data
 * @param {THREE.Scene} scene - The game scene
 * @param {Array} zombies - Array of all zombies
 * @param {number} deltaTime - Time since last frame
 */
function updateTurretBullets(turret, scene, zombies, deltaTime) {
    const currentTime = Date.now();
    const bulletsToRemove = [];
    
    // Update each bullet
    turret.bullets.forEach((bullet, index) => {
        // Move bullet
        bullet.mesh.position.add(bullet.velocity.clone().multiplyScalar(deltaTime * 60));
        bullet.light.position.copy(bullet.mesh.position);
        
        // Check for lifetime expiration
        if (currentTime - bullet.createdAt > TURRET_BULLET_LIFETIME) {
            bulletsToRemove.push(index);
            return;
        }
        
        // Check for collision with zombies
        zombies.forEach(zombie => {
            // Skip dead zombies
            if (zombie.userData && (zombie.userData.isDead || zombie.userData.health <= 0)) return;
            
            const distance = bullet.mesh.position.distanceTo(zombie.position);
            if (distance < 2.0) { // Collision radius
                // Damage zombie
                if (zombie.userData && zombie.userData.onHit) {
                    zombie.userData.onHit(bullet.damage);
                    
                    // Add bullet to removal list
                    if (!bulletsToRemove.includes(index)) {
                        bulletsToRemove.push(index);
                    }
                }
            }
        });
    });
    
    // Remove bullets in reverse order
    bulletsToRemove.sort((a, b) => b - a).forEach(index => {
        const bullet = turret.bullets[index];
        
        // Remove bullet from scene
        scene.remove(bullet.mesh);
        scene.remove(bullet.light);
        
        // Remove from bullets array
        turret.bullets.splice(index, 1);
    });
}

/**
 * Get all active turrets
 * @returns {Array} Array of all active turrets
 */
export function getTurrets() {
    return turrets;
}

/**
 * Clean up turret resources
 * @param {THREE.Scene} scene - The game scene
 */
export function cleanupTurrets(scene) {
    turrets.forEach(turret => {
        // Remove all bullets
        turret.bullets.forEach(bullet => {
            scene.remove(bullet.mesh);
            scene.remove(bullet.light);
        });
        
        // Remove turret object
        scene.remove(turret.object);
    });
    
    // Clear turrets array
    turrets.length = 0;
}

/**
 * Create turrets around the spawn points
 * @param {THREE.Scene} scene - The game scene
 * @returns {Array} - Array of turret objects
 */
export function createSpawnTurrets(scene) {
    const turrets = [];
    const spawnPoint = getSpawnPoint();
    
    // Place 4 turrets in a square around the spawn point
    const positions = [
        { x: spawnPoint.x + 15, z: spawnPoint.z + 15 },
        { x: spawnPoint.x + 15, z: spawnPoint.z - 15 },
        { x: spawnPoint.x - 15, z: spawnPoint.z + 15 },
        { x: spawnPoint.x - 15, z: spawnPoint.z - 15 }
    ];
    
    positions.forEach(pos => {
        const turret = createTurret(new THREE.Vector3(pos.x, 0, pos.z), scene);
        turrets.push(turret);
    });
    
    return turrets;
} 