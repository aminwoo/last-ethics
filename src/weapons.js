import * as THREE from 'three';
import SoundManager from './sound.js';
import { applyScreenShake } from './effects.js';

export const weapons = [
    {
        name: "Pistol",
        damage: 25,
        ammo: 120,
        maxAmmo: 120,
        totalAmmo: 999,
        fireRate: 0.5,
        lastFired: 0,
        reloadTime: 1.5, 
        isReloading: false,
        reloadStartTime: 0,
        image: "/images/GUN_01_[square_frame]_01_V1.00.png",
        type: "ranged",
        bulletsPerShot: 1,
        color: 0xffff00, 
        spread: 0.15, 
        bulletSpeed: 1.5,
        shakeIntensity: 0.3,
    },
    {
        name: "Shotgun",
        damage: 9,
        ammo: 6,
        maxAmmo: 6,
        totalAmmo: 999,
        fireRate: 1.0, 
        lastFired: 0,
        reloadTime: 2.5, 
        isReloading: false,
        reloadStartTime: 0,
        image: "/images/[32x96]Shotgun_V1.01.png",
        type: "ranged",
        bulletsPerShot: 8, 
        color: 0xff8800, 
        spread: 0.2, 
        bulletSpeed: 0.4,
        shakeIntensity: 1.0,
    },
    {
        name: "Assault Rifle",
        damage: 30,
        ammo: 30,
        maxAmmo: 30,
        totalAmmo: 999, 
        fireRate: 0.08, 
        lastFired: 0,
        reloadTime: 2.0, 
        isReloading: false,
        reloadStartTime: 0,
        image: "/images/[design] Assault_rifle_V1.00.png",
        type: "ranged",
        isAutomatic: true, 
        bulletsPerShot: 1,
        color: 0xff0000, 
        spread: 0.05,
        bulletSpeed: 0.6,
        shakeIntensity: 0.3,
    },
    {
        name: "Sniper Rifle",
        damage: 100,
        ammo: 5,
        maxAmmo: 5,
        totalAmmo: 999,
        fireRate: 1.5, 
        lastFired: 0,
        reloadTime: 3.0, 
        isReloading: false,
        reloadStartTime: 0,
        image: "/images/[design]_Sniper_rifle_[KAR98]_V1.00.png", 
        type: "ranged",
        twoHanded: true,
        isSniper: true, 
        bulletsPerShot: 1,
        color: 0x00ffff, 
        spread: 0.01, 
        bulletSpeed: 1.3,
        shakeIntensity: 0.4,
        canPierce: true,
        maxPierceCount: 3
    },
];

let bullets = [];

// Create bullet model (for reuse)
let bulletModel;

function initBulletModel() {
    const bulletGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
    bulletGeometry.rotateX(Math.PI / 2);  // Rotate to point forward
    const bulletMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xffffaa,
        emissive: 0xffff00,
        emissiveIntensity: 0.8, // Increased from 0.5 to 0.8
        metalness: 0.8,
        roughness: 0.2
    });
    bulletModel = new THREE.Mesh(bulletGeometry, bulletMaterial);
}

// Constants for bullet system
const BULLET_LIFE_TIME = 8000; // milliseconds - increased from 3000 to 8000
const MUZZLE_FLASH_DURATION = 100; // milliseconds
const SCREEN_SHAKE_DECAY = 0.9;
const TRAIL_LENGTH = 20; // Number of segments in bullet trail

// Last muzzle flash time
let lastMuzzleFlashTime = 0;

// Store active bullets
const activeBullets = [];

// Create a separate array for remote player bullets
const remotePlayerBullets = [];

// Constants for bullet management
const BULLET_TRAIL_LENGTH = 20; // Length of the bullet trail

// Create weapon models for the player
export function createWeaponModels(leftForearmGroup) {
    const weaponModels = {};
    
    // Shared material for weapons
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    
    // Pistol - attach to left hand
    const pistolGroup = new THREE.Group();
    pistolGroup.position.set(0, -0.4, 0.2);
    // Rotate gun to point forward properly
    pistolGroup.rotation.x = Math.PI / 2;
    pistolGroup.name = "pistol";
    pistolGroup.visible = true; // Initially visible if starting with pistol
    leftForearmGroup.add(pistolGroup);
    
    // Create a detailed pistol
    const pistolBarrelGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.6);
    const pistolHandleGeometry = new THREE.BoxGeometry(0.08, 0.2, 0.12);
    
    // Pistol barrel
    const pistolBarrel = new THREE.Mesh(pistolBarrelGeometry, gunMaterial);
    pistolBarrel.position.z = 0.3;
    pistolBarrel.name = 'pistolBarrel';
    pistolGroup.add(pistolBarrel);
    
    // Pistol handle/grip
    const pistolHandle = new THREE.Mesh(pistolHandleGeometry, gunMaterial);
    pistolHandle.position.y = -0.1;
    pistolHandle.position.z = 0.05;
    pistolGroup.add(pistolHandle);
    
    weaponModels.pistol = pistolGroup;
    
    // Shotgun - positioned between both hands
    const shotgunGroup = new THREE.Group();
    shotgunGroup.position.set(0, -0.4, 0.2);
    shotgunGroup.rotation.x = Math.PI / 2;
    shotgunGroup.name = "shotgun";
    shotgunGroup.visible = false; // Initially hidden if starting with pistol
    leftForearmGroup.add(shotgunGroup);
    
    // Create a detailed shotgun
    const shotgunBarrelGeometry = new THREE.BoxGeometry(0.1, 0.1, 1.2);
    const shotgunStockGeometry = new THREE.BoxGeometry(0.08, 0.15, 0.6);
    const shotgunPumpGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.2);
    
    // Shotgun barrel
    const shotgunBarrel = new THREE.Mesh(shotgunBarrelGeometry, gunMaterial);
    shotgunBarrel.position.z = 0.6;
    shotgunBarrel.name = 'shotgunBarrel';
    shotgunGroup.add(shotgunBarrel);
    
    // Shotgun stock
    const shotgunStock = new THREE.Mesh(shotgunStockGeometry, gunMaterial);
    shotgunStock.position.y = -0.05;
    shotgunStock.position.z = 0.1;
    shotgunGroup.add(shotgunStock);
    
    // Shotgun pump
    const shotgunPump = new THREE.Mesh(shotgunPumpGeometry, gunMaterial);
    shotgunPump.position.z = 0.3;
    shotgunPump.position.y = -0.15;
    shotgunPump.name = 'shotgunPump';
    shotgunGroup.add(shotgunPump);
    
    weaponModels.shotgun = shotgunGroup;
    
    // Assault Rifle - positioned between both hands
    const rifleGroup = new THREE.Group();
    rifleGroup.position.set(0, -0.4, 0.2);
    rifleGroup.rotation.x = Math.PI / 2;
    rifleGroup.name = "assaultRifle";
    rifleGroup.visible = false; // Initially hidden
    leftForearmGroup.add(rifleGroup);
    
    // Create a detailed assault rifle
    const rifleBarrelGeometry = new THREE.BoxGeometry(0.06, 0.06, 1.0);
    const rifleBodyGeometry = new THREE.BoxGeometry(0.12, 0.1, 0.5);
    const rifleStockGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.4);
    const rifleMagazineGeometry = new THREE.BoxGeometry(0.08, 0.25, 0.1);
    const rifleHandleGeometry = new THREE.BoxGeometry(0.07, 0.15, 0.12);
    
    // Rifle barrel
    const rifleBarrel = new THREE.Mesh(rifleBarrelGeometry, gunMaterial);
    rifleBarrel.position.z = 0.6;
    rifleBarrel.name = 'rifleBarrel';
    rifleGroup.add(rifleBarrel);
    
    // Rifle body
    const rifleBody = new THREE.Mesh(rifleBodyGeometry, gunMaterial);
    rifleBody.position.z = 0.2;
    rifleGroup.add(rifleBody);
    
    // Rifle stock
    const rifleStock = new THREE.Mesh(rifleStockGeometry, gunMaterial);
    rifleStock.position.z = -0.15;
    rifleStock.position.y = 0.02;
    rifleGroup.add(rifleStock);
    
    // Rifle magazine
    const rifleMagazine = new THREE.Mesh(rifleMagazineGeometry, gunMaterial);
    rifleMagazine.position.z = 0.1;
    rifleMagazine.position.y = -0.15;
    rifleGroup.add(rifleMagazine);
    
    // Rifle handle/grip
    const rifleHandle = new THREE.Mesh(rifleHandleGeometry, gunMaterial);
    rifleHandle.position.y = -0.1;
    rifleHandle.position.z = -0.05;
    rifleGroup.add(rifleHandle);
    
    // Add a sight to the rifle
    const rifleSightBaseGeometry = new THREE.BoxGeometry(0.04, 0.08, 0.02);
    const rifleSightBase = new THREE.Mesh(rifleSightBaseGeometry, gunMaterial);
    rifleSightBase.position.y = 0.1;
    rifleSightBase.position.z = 0.4;
    rifleGroup.add(rifleSightBase);
    
    const rifleSightPostGeometry = new THREE.BoxGeometry(0.01, 0.05, 0.01);
    const rifleSightPost = new THREE.Mesh(rifleSightPostGeometry, gunMaterial);
    rifleSightPost.position.y = 0.15;
    rifleSightPost.position.z = 0.4;
    rifleGroup.add(rifleSightPost);
    
    weaponModels.assaultRifle = rifleGroup;
    
    // Sniper Rifle - positioned between both hands
    const sniperGroup = new THREE.Group();
    sniperGroup.position.set(0, -0.4, 0.2);
    sniperGroup.rotation.x = Math.PI / 2;
    sniperGroup.name = "sniperRifle";
    sniperGroup.visible = false; // Initially hidden
    leftForearmGroup.add(sniperGroup);
    
    // Create a detailed sniper rifle
    const sniperBarrelGeometry = new THREE.BoxGeometry(0.05, 0.05, 1.4); // Longer barrel
    const sniperBodyGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
    const sniperStockGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.5); // Longer stock
    const sniperMagazineGeometry = new THREE.BoxGeometry(0.07, 0.2, 0.1);
    const sniperHandleGeometry = new THREE.BoxGeometry(0.06, 0.15, 0.12);
    
    // Sniper barrel
    const sniperBarrel = new THREE.Mesh(sniperBarrelGeometry, gunMaterial);
    sniperBarrel.position.z = 0.7;
    sniperBarrel.name = 'sniperBarrel';
    sniperGroup.add(sniperBarrel);
    
    // Sniper body
    const sniperBody = new THREE.Mesh(sniperBodyGeometry, gunMaterial);
    sniperBody.position.z = 0.2;
    sniperGroup.add(sniperBody);
    
    // Sniper stock
    const sniperStock = new THREE.Mesh(sniperStockGeometry, gunMaterial);
    sniperStock.position.z = -0.2;
    sniperStock.position.y = 0.02;
    sniperGroup.add(sniperStock);
    
    // Sniper magazine
    const sniperMagazine = new THREE.Mesh(sniperMagazineGeometry, gunMaterial);
    sniperMagazine.position.z = 0.1;
    sniperMagazine.position.y = -0.15;
    sniperGroup.add(sniperMagazine);
    
    // Sniper handle/grip
    const sniperHandle = new THREE.Mesh(sniperHandleGeometry, gunMaterial);
    sniperHandle.position.y = -0.1;
    sniperHandle.position.z = -0.05;
    sniperGroup.add(sniperHandle);
    
    // Add a scope to the sniper rifle
    const scopeBodyGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.25, 8);
    const scopeBody = new THREE.Mesh(scopeBodyGeometry, gunMaterial);
    scopeBody.rotation.x = Math.PI / 2; // Rotate to be parallel with barrel
    scopeBody.position.y = 0.15;
    scopeBody.position.z = 0.3;
    sniperGroup.add(scopeBody);
    
    // Add scope lenses
    const scopeLensGeometry = new THREE.CircleGeometry(0.04, 8);
    const scopeLensMaterial = new THREE.MeshBasicMaterial({ color: 0x88CCFF });
    
    // Front lens
    const frontLens = new THREE.Mesh(scopeLensGeometry, scopeLensMaterial);
    frontLens.position.z = 0.12;
    frontLens.rotation.y = Math.PI / 2;
    scopeBody.add(frontLens);
    
    // Rear lens
    const rearLens = new THREE.Mesh(scopeLensGeometry, scopeLensMaterial);
    rearLens.position.z = -0.12;
    rearLens.rotation.y = -Math.PI / 2;
    scopeBody.add(rearLens);
    
    // Add scope mount
    const scopeMountGeometry = new THREE.BoxGeometry(0.08, 0.05, 0.1);
    const scopeMount = new THREE.Mesh(scopeMountGeometry, gunMaterial);
    scopeMount.position.y = 0.075;
    scopeMount.position.z = 0.3;
    sniperGroup.add(scopeMount);
    
    // Bipod legs (folded)
    const bipodLegGeometry = new THREE.BoxGeometry(0.02, 0.15, 0.02);
    const bipodLegMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
    
    // Left bipod leg
    const leftBipodLeg = new THREE.Mesh(bipodLegGeometry, bipodLegMaterial);
    leftBipodLeg.position.x = -0.04;
    leftBipodLeg.position.y = -0.05;
    leftBipodLeg.position.z = 1.0;
    leftBipodLeg.rotation.x = -Math.PI / 4; // Angled backward
    sniperGroup.add(leftBipodLeg);
    
    // Right bipod leg
    const rightBipodLeg = new THREE.Mesh(bipodLegGeometry, bipodLegMaterial);
    rightBipodLeg.position.x = 0.04;
    rightBipodLeg.position.y = -0.05;
    rightBipodLeg.position.z = 1.0;
    rightBipodLeg.rotation.x = -Math.PI / 4; // Angled backward
    sniperGroup.add(rightBipodLeg);
    
    weaponModels.sniperRifle = sniperGroup;
    
    // Baseball Bat - positioned for two-handed swing
    const batGroup = new THREE.Group();
    batGroup.position.set(0, -0.4, 0.2);
    batGroup.rotation.x = Math.PI / 2;
    batGroup.name = "baseballBat";
    batGroup.visible = false; // Initially hidden
    leftForearmGroup.add(batGroup);
    
    // Create a detailed baseball bat
    const batMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Brown wood color
    
    // Bat handle
    const batHandleGeometry = new THREE.CylinderGeometry(0.03, 0.05, 0.4, 8);
    const batHandle = new THREE.Mesh(batHandleGeometry, batMaterial);
    batHandle.position.z = 0.2;
    batHandle.name = 'batHandle';
    batGroup.add(batHandle);
    
    // Bat barrel
    const batBarrelGeometry = new THREE.CylinderGeometry(0.1, 0.05, 0.8, 8);
    const batBarrel = new THREE.Mesh(batBarrelGeometry, batMaterial);
    batBarrel.position.z = 0.8;
    batBarrel.name = 'batBarrel';
    batGroup.add(batBarrel);
    
    // Add a grip tape to the handle
    const gripMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 }); // Black grip
    const batGripGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8);
    const batGrip = new THREE.Mesh(batGripGeometry, gripMaterial);
    batGrip.position.z = 0.1;
    batGroup.add(batGrip);
    
    weaponModels.baseballBat = batGroup;
    
    return weaponModels;
}

// Function to update player arms based on weapon type
export function updatePlayerArmsForWeapon(player, gameState) {
    const userData = player.userData;
    const weapon = gameState.weapon;
    
    // Hide all weapons first
    userData.weapons.pistol.visible = false;
    userData.weapons.shotgun.visible = false;
    userData.weapons.baseballBat.visible = false;
    userData.weapons.assaultRifle.visible = false;
    userData.weapons.sniperRifle.visible = false;
    
    if (weapon.type === "melee") {
        // Baseball bat
        userData.weapons.baseballBat.visible = true;
        
        // Set arms position for baseball bat (both arms forward, ready to swing)
        userData.leftArm.upper.rotation.x = -Math.PI / 2.5;
        userData.leftArm.upper.rotation.y = 0;
        userData.leftArm.upper.rotation.z = -Math.PI / 8;
        
        userData.rightArm.upper.rotation.x = -Math.PI / 2.5;
        userData.rightArm.upper.rotation.y = 0;
        userData.rightArm.upper.rotation.z = Math.PI / 8;
        
        // Position forearms
        userData.leftArm.forearm.rotation.x = Math.PI / 8;
        userData.rightArm.forearm.rotation.x = Math.PI / 8;
    } else if (weapon.twoHanded) {
        // Determine which two-handed weapon to show
        if (weapon.name === "Assault Rifle") {
            userData.weapons.assaultRifle.visible = true;
        } else if (weapon.name === "Sniper Rifle") {
            userData.weapons.sniperRifle.visible = true;
        } else {
            // Shotgun
            userData.weapons.shotgun.visible = true;
        }
        
        // Left arm already points forward for aiming
        
        // Adjust right arm to also point forward for supporting the two-handed weapon
        userData.rightArm.upper.rotation.x = -Math.PI / 2.2; // Slightly different angle than left arm
        userData.rightArm.upper.rotation.y = 0;
        userData.rightArm.upper.rotation.z = 0;
        
        // Position right forearm
        userData.rightArm.forearm.rotation.x = Math.PI / 10;
        
        // Special positioning for sniper rifle - slightly different posture
        if (weapon.name === "Sniper Rifle") {
            // Adjust arms to be steady for precision aiming
            userData.leftArm.upper.rotation.x = -Math.PI / 1.9; // More vertical
            userData.rightArm.upper.rotation.x = -Math.PI / 1.9;
            
            // Tilt slightly to look through scope
            userData.leftArm.upper.rotation.y = Math.PI / 32;
            userData.rightArm.upper.rotation.y = Math.PI / 32;
        }
    } else {
        // Pistol
        userData.weapons.pistol.visible = true;
        
        // Left arm already points forward for aiming
        userData.leftArm.upper.rotation.x = -Math.PI / 2;
        userData.leftArm.upper.rotation.y = 0;
        userData.leftArm.upper.rotation.z = 0;
        
        // Reset right arm to hanging position
        userData.rightArm.upper.rotation.x = 0;
        userData.rightArm.upper.rotation.y = 0;
        userData.rightArm.upper.rotation.z = 0;
        
        // Reset right forearm
        userData.rightArm.forearm.rotation.x = 0;
    }
    
    // Reset the bat swing animation state
    userData.batSwingAnimation.isSwinging = false;
    userData.batSwingAnimation.progress = 0;
}

// Function to handle weapon switching
export function handleWeaponSwitch(player, weaponIndex, switchWeaponFn, gameState) {
    // Use the imported switchWeapon function
    if (switchWeaponFn(gameState, weaponIndex)) {
        // Update player model to reflect the new weapon
        updatePlayerArmsForWeapon(player, gameState);
        
        // Play weapon switch sound (if available)
        if (SoundManager.playWeaponSwitch) {
            SoundManager.playWeaponSwitch();
        }
        
        return true;
    }
    
    return false;
}

// Function to handle weapon reloading
export function handleReload(player, reloadWeaponFn, gameState) {
    // Check if we're reloading an Assault Rifle
    const isAssaultRifle = gameState.weapon && gameState.weapon.name === "Assault Rifle";
    
    if (reloadWeaponFn(gameState)) {
        SoundManager.playReload();
        return true;
    }
    
    return false;
}

// Create a muzzle flash effect
export function createMuzzleFlash(player, scene) {
    // Determine which weapon is active
    const userData = player.userData;
    let currentWeapon = 'pistol';
    
    if (!userData || !userData.weapons) {
        console.warn("Player userData or weapons not found for muzzle flash");
        return; // Exit early if userData isn't valid
    }
    
    if (userData.weapons.shotgun && userData.weapons.shotgun.visible) {
        currentWeapon = 'shotgun';
    } else if (userData.weapons.assaultRifle && userData.weapons.assaultRifle.visible) {
        currentWeapon = 'rifleBarrel';
    } else if (userData.weapons.sniperRifle && userData.weapons.sniperRifle.visible) {
        currentWeapon = 'sniperBarrel';
    }
    
    const barrelName = currentWeapon === 'rifleBarrel' || currentWeapon === 'sniperBarrel' 
                     ? currentWeapon 
                     : currentWeapon + 'Barrel';
    
    // Find the gun barrel
    let gunBarrel = null;
    player.traverse((child) => {
        if (child.name === barrelName) {
            gunBarrel = child;
        }
    });
    
    if (gunBarrel) {
        // Create a group for the muzzle flash and attach it to the gun barrel
        const muzzleFlashGroup = new THREE.Group();
        gunBarrel.add(muzzleFlashGroup);
        
        // Calculate position based on barrel type
        // Note: This now uses the actual barrel dimensions so it aligns with bullet spawning
        let barrelLength;
        if (currentWeapon === 'shotgun') {
            barrelLength = 1.2;
        } else if (currentWeapon === 'sniperBarrel') {
            barrelLength = 1.4;
        } else if (currentWeapon === 'rifleBarrel') {
            barrelLength = 1.0;
        } else {
            barrelLength = 0.6; // Pistol
        }
        
        // Position at the exact end of the barrel
        muzzleFlashGroup.position.set(0, 0, barrelLength/2);
        
        // Create a point light for the muzzle flash
        const muzzleLight = new THREE.PointLight(0xffaa00, 8, 3);
        muzzleFlashGroup.add(muzzleLight);
        
        // Create a small sphere for the visual flash effect
        let flashSize;
        if (currentWeapon === 'shotgun') {
            flashSize = 0.15;
        } else if (currentWeapon === 'sniperBarrel') {
            flashSize = 0.12; // Larger flash for sniper
        } else {
            flashSize = 0.1;
        }
        const flashGeometry = new THREE.SphereGeometry(flashSize, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
        muzzleFlashGroup.add(flashMesh);
        
        // Add a cone for a more directional flash effect
        let coneLength, coneWidth;
        if (currentWeapon === 'shotgun') {
            coneLength = 0.3;
            coneWidth = 0.1;
        } else if (currentWeapon === 'sniperBarrel') {
            coneLength = 0.4; // Longer flash for sniper
            coneWidth = 0.06;
        } else {
            coneLength = 0.2;
            coneWidth = 0.05;
        }
        const coneGeometry = new THREE.ConeGeometry(coneWidth, coneLength, 8);
        const coneMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff99,
            transparent: true,
            opacity: 0.6
        });
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.rotation.x = Math.PI / 2; // Point forward
        cone.position.z = coneLength / 2;
        cone.scale.set(1, 1, 1);
        muzzleFlashGroup.add(cone);
        
        // For shotgun, add additional smaller flashes for a spread effect
        if (currentWeapon === 'shotgun') {
            for (let i = 0; i < 5; i++) {
                const smallFlashGeometry = new THREE.SphereGeometry(0.05, 8, 8);
                const smallFlashMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xffff00,
                    transparent: true,
                    opacity: 0.6
                });
                const smallFlash = new THREE.Mesh(smallFlashGeometry, smallFlashMaterial);
                // Position randomly around the main flash
                smallFlash.position.set(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    Math.random() * 0.1
                );
                muzzleFlashGroup.add(smallFlash);
            }
        }
        
        // For sniper rifle, add a distinctive long-range flash effect
        if (currentWeapon === 'sniperBarrel') {
            // Add a trail of small flashes behind the main flash
            for (let i = 0; i < 3; i++) {
                const trailFlashGeometry = new THREE.SphereGeometry(0.03, 8, 8);
                const trailFlashMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0xffffcc,
                    transparent: true,
                    opacity: 0.4
                });
                const trailFlash = new THREE.Mesh(trailFlashGeometry, trailFlashMaterial);
                // Position in a line behind the main flash
                trailFlash.position.set(
                    (Math.random() - 0.5) * 0.05,
                    (Math.random() - 0.5) * 0.05,
                    -0.1 - (i * 0.1)
                );
                muzzleFlashGroup.add(trailFlash);
            }
        }
        
        // Animate the muzzle flash
        let scalePhase = 0;
        const animateFlash = () => {
            try {
                scalePhase += 0.2;
                const scale = 1 + Math.sin(scalePhase) * 0.3;
                
                // Check if flashMesh still exists before scaling
                if (flashMesh.parent) {
                    flashMesh.scale.set(scale, scale, scale);
                    
                    // Random rotation for variation
                    muzzleFlashGroup.rotation.z = Math.random() * Math.PI * 2;
                    
                    if (scalePhase < Math.PI) {
                        requestAnimationFrame(animateFlash);
                    } else {
                        // Remove the muzzle flash after animation completes
                        if (gunBarrel && muzzleFlashGroup.parent) {
                            gunBarrel.remove(muzzleFlashGroup);
                        }
                    }
                }
            } catch (error) {
                console.error("Error animating muzzle flash:", error);
                // Attempt cleanup
                if (gunBarrel && muzzleFlashGroup.parent) {
                    gunBarrel.remove(muzzleFlashGroup);
                }
            }
        };
        
        // Start animation
        animateFlash();
        
        // Remove the muzzle flash after a short time as a fallback
        setTimeout(() => {
            try {
                if (muzzleFlashGroup.parent) {
                    gunBarrel.remove(muzzleFlashGroup);
                }
            } catch (error) {
                console.error("Error removing muzzle flash:", error);
            }
        }, 100);
    } else {
        // Fallback if we can't find the gun barrel - create a temporary flash at player position
        try {
            const flashGroup = new THREE.Group();
            scene.add(flashGroup);
            
            // Position in front of the player
            flashGroup.position.copy(player.position);
            flashGroup.position.y += 1.5;
            
            // Get the forward direction of the player
            const forward = new THREE.Vector3(0, 0, 1);
            forward.applyQuaternion(player.quaternion);
            
            // Position the muzzle flash in front of the player
            flashGroup.position.add(forward.multiplyScalar(1.5));
            
            // Create a point light
            const muzzleLight = new THREE.PointLight(0xffaa00, 5, 3);
            flashGroup.add(muzzleLight);
            
            // Create a small sphere
            const flashGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const flashMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffff00,
                transparent: true,
                opacity: 0.8
            });
            const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
            flashGroup.add(flashMesh);
            
            // Remove after a short time
            setTimeout(() => {
                scene.remove(flashGroup);
            }, 100);
        } catch (error) {
            console.error("Error creating fallback muzzle flash:", error);
        }
    }
}

// Handle shooting or melee attack
export function handleShooting(input, player, scene, gameState) {
    const currentTime = performance.now() / 1000; // Convert to seconds
    const weapon = gameState.weapon;
    
    // Check if weapon is currently reloading
    if (weapon.isReloading) {
        // If we're reloading the assault rifle, stop the sound
        return false;
    }
    
    // Check if enough time has passed since last attack
    if (currentTime - weapon.lastFired < weapon.fireRate) {
        return false;
    }
    
    // Update last fired/attack time
    weapon.lastFired = currentTime;
    
    // Ranged weapon (guns)
    // Only allow shooting if we have ammo
    if (weapon.ammo > 0) {
        // Decrease ammo
        weapon.ammo--;
        
        if (weapon.name === "Shotgun" && SoundManager.playShotgunShot) {
            SoundManager.playShotgunShot();
        } else if (weapon.name === "Sniper Rifle" && SoundManager.playRifleShot) {
            SoundManager.playRifleShot();
        } else if (SoundManager.playPistolShot) {
            SoundManager.playPistolShot();
        }
        
        // Apply the screen shake effect
        applyScreenShake(weapon.shakeIntensity);
        
        // Add muzzle flash effect
        createMuzzleFlash(player, scene);
        
        // Initialize bulletModel if not already done
        if (!bulletModel) {
            initBulletModel();
        }
        
        // Shoot bullet
        shootBullet(input, weapon, player, scene);
        
        // Send firing update to the network
        if (window.sendPlayerUpdate) {
            window.sendPlayerUpdate(player, true, weapon.name);
        }
        
        return true;
    } else if (weapon.ammo <= 0) {
        // Play empty gun sound (if available)
        if (SoundManager.playEmptyClip) {
            SoundManager.playEmptyClip();
        }
    }
    
    return false;
}


// Create bullet impact effect
function createBulletImpact(position, scene, surface = 'ground') {
    // Create a particle effect for bullet impact
    const particleCount = surface === 'zombie' ? 20 : (surface === 'ground' ? 15 : 8);
    const particleGeometry = new THREE.SphereGeometry(0.03, 4, 4);
    
    // Different colors based on impact surface
    let particleColor;
    if (surface === 'zombie') {
        particleColor = 0xAA0000; // Dark red for blood
    } else if (surface === 'ground') {
        particleColor = 0xCCCCCC; // Gray for ground/concrete
    } else {
        particleColor = 0xFF3333; // Lighter red for other surfaces
    }
    
    const particleMaterial = new THREE.MeshBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: 0.8
    });
    
    const particles = [];
    
    // Create particles
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        particle.position.copy(position);
        
        // Adjust particle size for blood
        if (surface === 'zombie') {
            const scale = 0.5 + Math.random() * 1.0; // Varied sizes for blood droplets
            particle.scale.set(scale, scale, scale);
        }
        
        // Random direction - adjusted for surface type
        let direction;
        if (surface === 'zombie') {
            // Blood splatter should spray outward from impact point with more variation
            direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            ).normalize();
        } else {
            direction = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                Math.random() * 1.5, // More upward for ground impacts
                (Math.random() - 0.5) * 2
            ).normalize();
        }
        
        // Random speed - faster for blood
        const speed = surface === 'zombie' ? 2 + Math.random() * 5 : 1 + Math.random() * 3;
        
        // Add to scene
        scene.add(particle);
        
        // Store particle data
        particles.push({
            mesh: particle,
            direction: direction,
            speed: speed,
            life: 1.0,  // Life counter
            surface: surface // Store surface type for specific animations
        });
    }
    
    // Animate particles
    const animateParticles = () => {
        if (particles.length === 0) return;
        
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            
            // Move particle
            p.mesh.position.add(p.direction.clone().multiplyScalar(p.speed * 0.016)); // Assuming 60fps
            
            // Apply gravity to blood particles for a more realistic effect
            if (p.surface === 'zombie') {
                p.direction.y -= 0.05; // Gravity effect for blood
                p.speed *= 0.98; // Blood slows down faster than other particles
            }
            
            // Decrease life and opacity
            p.life -= p.surface === 'zombie' ? 0.02 : 0.01; // Blood fades faster
            p.mesh.material.opacity = p.life;
            
            // Remove if life is depleted
            if (p.life <= 0) {
                scene.remove(p.mesh);
                particles.splice(i, 1);
            }
        }
        
        if (particles.length > 0) {
            requestAnimationFrame(animateParticles);
        }
    };
    
    // Start animation
    animateParticles();
}

// Switch to a different weapon
export function switchWeapon(gameState, weaponIndex) {
    if (weaponIndex >= 0 && weaponIndex < weapons.length && weaponIndex !== gameState.currentWeaponIndex) {
        gameState.currentWeaponIndex = weaponIndex;
        return true;
    }
    return false;
}

// Reload the current weapon
export function reloadWeapon(gameState) {
    const weapon = gameState.weapon;
    
    // Only reload ranged weapons that aren't already reloading
    if (weapon.type === "melee" || weapon.isReloading) {
        return false;
    }
    
    // Check if reload is needed and possible
    if (weapon.ammo < weapon.maxAmmo && weapon.totalAmmo > 0) {
        // Start the reload process
        weapon.isReloading = true;
        weapon.reloadStartTime = performance.now() / 1000; // Current time in seconds
        
        return true;
    }
    
    return false;
}

// Check if weapon reload is complete
export function checkReloadCompletion(gameState) {
    const weapon = gameState.weapon;
    
    // If not reloading, nothing to do
    if (!weapon.isReloading) {
        return;
    }
    
    const currentTime = performance.now() / 1000;
    const elapsedTime = currentTime - weapon.reloadStartTime;
    
    // Check if reload time has passed
    if (elapsedTime >= weapon.reloadTime) {
        // Reload complete, update ammo
        const ammoNeeded = weapon.maxAmmo - weapon.ammo;
        const ammoToAdd = Math.min(ammoNeeded, weapon.totalAmmo);
        
        weapon.ammo += ammoToAdd;
        weapon.totalAmmo -= ammoToAdd;
        
        // Reset reloading state
        weapon.isReloading = false;
    }
}

// Then modify the shootBullet function to include debug line drawing
function shootBullet(input, weapon, player, scene) {
    const currentTime = Date.now();
    
    // Play weapon sound using SoundManager if available
    if (SoundManager) {
        if (weapon.name === "Shotgun" && SoundManager.playShotgunShot) {
            SoundManager.playShotgunShot();
        } else if (weapon.name === "Sniper Rifle" && SoundManager.playRifleShot) {
            SoundManager.playRifleShot();
        } else if (SoundManager.playPistolShot) {
            SoundManager.playPistolShot();
        }
    } 

    // Position the bullet at the gun barrel instead of player position
    // This improves visual placement of bullets
    let gunTip = new THREE.Vector3();
    let gunDirection = new THREE.Vector3();
    
    // Try to find the gun barrel for accurate positioning
    let weaponObj = null;
        
    // Determine which weapon is active
    if (weapon.name === "Pistol" && player.userData.weapons.pistol) {
        weaponObj = player.userData.weapons.pistol;
    } else if (weapon.name === "Shotgun" && player.userData.weapons.shotgun) {
        weaponObj = player.userData.weapons.shotgun;
    } else if (weapon.name === "Assault Rifle" && player.userData.weapons.assaultRifle) {
        weaponObj = player.userData.weapons.assaultRifle;
    } else if (weapon.name === "Sniper Rifle" && player.userData.weapons.sniperRifle) {
        weaponObj = player.userData.weapons.sniperRifle;
    }
    
    let barrel = null;
    weaponObj.traverse((child) => {
        if (child.name && child.name.includes('Barrel')) {
            barrel = child;
        }
    });
    
    if (barrel) {
        // Get the world position of the barrel tip
        barrel.getWorldPosition(gunTip);
        
        // Get barrel's forward direction
        gunDirection.set(0, 0, 1).applyQuaternion(barrel.getWorldQuaternion(new THREE.Quaternion()));
    } else {
        // Fallback if barrel not found
        weaponObj.getWorldPosition(gunTip);
        gunDirection = initialDirection.clone();
    }
    
    // Calculate direction for bullet trajectory
    let initialDirection = new THREE.Vector3();
    let targetPoint = new THREE.Vector3(); // Store the target point for debug line
    
    // Create raycaster from the mouse position using the actual game camera
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(
        new THREE.Vector2(input.mousePosition.x, input.mousePosition.y),
        scene.camera
    );
    
    // Create a horizontal plane at the gun tip's height, not at ground level
    // This ensures bullets travel parallel to the ground at the gun's height
    const gunHeightPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -gunTip.y);
    
    // Find where the ray intersects the gun-height plane
    raycaster.ray.intersectPlane(gunHeightPlane, targetPoint);
    
    
    // Get direction from gun tip to target point
    initialDirection.subVectors(targetPoint, gunTip);
    
    // Since both points are already at the same height, this vector is already parallel to ground
    // Just normalize to get a unit vector
    initialDirection.normalize();
    
    // Set default values if properties are missing
    const bulletsPerShot = weapon.bulletsPerShot;
    const bulletColor = weapon.color;
    const bulletSpread = weapon.spread;
    const bulletSpeed = weapon.bulletSpeed;

    // Fire multiple bullets for shotgun
    for (let i = 0; i < bulletsPerShot; i++) {
        // Create bullet with trail
        const bullet = bulletModel.clone();
        
        // Set bullet position at gun tip WITHOUT the initial offset
        // This ensures bullets start exactly from the gun tip
        bullet.position.copy(gunTip);
        
        // Only add position offset for shotgun pattern, not for the initial position
        if (weapon.name === "Shotgun" && bulletsPerShot > 1) {
            // Create a circular pattern for pellets
            const angle = (i / bulletsPerShot) * Math.PI * 2;
            const radius = 0.1; // Initial spread radius
            
            // Calculate spread offset perpendicular to direction
            const perpX = new THREE.Vector3().crossVectors(initialDirection, new THREE.Vector3(0, 1, 0)).normalize();
            const perpY = new THREE.Vector3().crossVectors(initialDirection, perpX).normalize();
            
            bullet.position.add(perpX.multiplyScalar(Math.cos(angle) * radius));
            bullet.position.add(perpY.multiplyScalar(Math.sin(angle) * radius));
        }
        
        // Create bullet trail with higher visibility
        const trailGeometry = new THREE.BufferGeometry();
        
        // Enhanced trail material for sniper rifle
        const trailMaterial = new THREE.LineBasicMaterial({
            color: bulletColor,
            transparent: true,
            opacity: weapon.name === "Sniper Rifle" ? 0.9 : 0.8, // Higher opacity for sniper
            linewidth: weapon.name === "Sniper Rifle" ? 3 : 2    // Thicker line for sniper
        });
        
        // For sniper rifle, use a longer trail
        const trailLength = weapon.name === "Sniper Rifle" ? BULLET_TRAIL_LENGTH * 1.5 : BULLET_TRAIL_LENGTH;
        const trailPositions = new Float32Array(Math.round(trailLength) * 3);
        
        // Initialize all trail positions to bullet's starting position
        const validPos = new THREE.Vector3(
            isNaN(bullet.position.x) ? 0 : bullet.position.x,
            isNaN(bullet.position.y) ? 0 : bullet.position.y,
            isNaN(bullet.position.z) ? 0 : bullet.position.z
        );
        
        for (let j = 0; j < trailPositions.length / 3; j++) {
            trailPositions[j * 3] = validPos.x;
            trailPositions[j * 3 + 1] = validPos.y;
            trailPositions[j * 3 + 2] = validPos.z;
        }
        
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
        
        // Calculate direction with spread based on initialDirection (our aiming direction)
        let direction = initialDirection.clone();

        // Apply spread based on weapon type
        if (weapon.name === "Shotgun") {
            // Conical spread pattern
            const spreadAngle = weapon.spread * (1 - (i / weapon.bulletsPerShot)); // Tighter spread for center pellets
            direction.x += (Math.random() - 0.5) * spreadAngle;
            direction.y += (Math.random() - 0.5) * spreadAngle * 0.5; // Less vertical spread
            direction.z += (Math.random() - 0.5) * spreadAngle;
        } else {
            direction.x += (Math.random() - 0.5) * weapon.spread;
            direction.y += (Math.random() - 0.5) * weapon.spread;
            direction.z += (Math.random() - 0.5) * weapon.spread;
        }
        direction.normalize();
        
        // Rotate bullet to face direction
        bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
        
        // Add bullet to scene and tracking array
        scene.add(bullet);
        
        // Create a point light that follows the bullet for enhanced visibility
        const bulletLight = new THREE.PointLight(
            bulletColor, // Use same color as bullet
            weapon.name === "Sniper Rifle" ? 0.8 : 0.5, // Higher intensity for sniper
            weapon.name === "Sniper Rifle" ? 3 : 2      // Larger radius for sniper
        );
        bulletLight.position.copy(bullet.position);
        scene.add(bulletLight);
        
        // Calculate velocity using bulletDirection (our modified aiming direction with spread)
        const velocity = direction.clone().multiplyScalar(
            weapon.name === "Shotgun" 
                ? bulletSpeed * (0.7 + Math.random() * 0.3)
                : bulletSpeed
        );
        
        bullets.push({
            mesh: bullet,
            light: bulletLight, // Store light reference
            trail: trail,
            trailPositions: trailPositions,
            direction: direction,
            velocity: velocity,
            speed: bulletSpeed,
            damage: weapon.damage,
            weaponType: weapon.name, // Add weapon type for knockback calculation
            distance: 0,
            maxDistance: 50,
            createdAt: currentTime,
            // Add piercing properties if weapon can pierce
            canPierce: weapon.canPierce || false,
            maxPierceCount: weapon.maxPierceCount || 1,
            pierceCount: 0,               // Current number of zombies pierced
            piercedZombies: new Set()     // Set to track which zombies have been hit
        });
    } 
}

export function updateBullets(scene, zombies = []) {
    const currentTime = Date.now();
    
    // Update local player bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
                
        // Update bullet position
        bullet.mesh.position.add(bullet.velocity);
        
        // Update light position if it exists
        if (bullet.light) {
            bullet.light.position.copy(bullet.mesh.position);
        }
        
        // Check for collisions with zombies
        let hitZombie = false;
        if (zombies && zombies.length > 0) {
            const bulletPos = bullet.mesh.position.clone();
            // Increase bullet collision radius for better hit detection
            const bulletRadius = 0.5; // Increased from 0.2 for better hit detection
            
            for (let j = 0; j < zombies.length; j++) {
                const zombie = zombies[j];

                // Skip dead zombies or zombies already hit by this piercing bullet
                if (zombie.userData.health <= 0 || (bullet.piercedZombies && bullet.piercedZombies.has(zombie.id))) {
                    continue;
                }
                
                // Simple distance-based collision detection
                const zombiePos = zombie.position.clone();
                // Don't adjust height - check full 3D collision
                // zombiePos.y = bulletPos.y; // This line was limiting collision to a 2D plane
                
                const distance = bulletPos.distanceTo(zombiePos);
                
                // Collision radius (combined size of bullet and zombie)
                const zombieRadius = 2.0; 
                
                if (distance < (bulletRadius + zombieRadius)) {
                    hitZombie = true;
                    
                    // Create impact effect at the hit position
                    // Adjust position slightly to be on zombie surface
                    const impactPos = bulletPos.clone();
                    const toZombie = new THREE.Vector3().subVectors(zombiePos, bulletPos).normalize();
                    impactPos.add(toZombie.multiplyScalar(bulletRadius));
                    
                    // Create blood impact effect
                    createBulletImpact(impactPos, scene, 'zombie');
                    
                    // For piercing sniper bullets, add a special effect
                    if (bullet.canPierce && bullet.weaponType === "Sniper Rifle") {
                        // Create a more dramatic piercing effect
                        createPiercingEffect(bullet, zombie, scene);
                    }
                    
                    // Calculate knockback force based on bullet damage and type
                    const knockbackAmount = bullet.damage * (bullet.weaponType === 'Shotgun' ? 0.1 : 0.5);
                    
                    // Apply damage to zombie with the direction for knockback
                    let damageApplied = false;
                    
                    if (typeof zombie.takeDamage === 'function') {
                        // Call with bullet direction for knockback and damage
                        zombie.takeDamage(bullet.damage, bullet.direction, knockbackAmount);
                        damageApplied = true;
                    } else if (zombie.userData && typeof zombie.userData.takeDamage === 'function') {
                        // Fall back to userData.takeDamage
                        zombie.userData.takeDamage(bullet.damage, bullet.direction, knockbackAmount);
                        damageApplied = true;
                    } else if (zombie.userData && typeof zombie.userData.onHit === 'function') {
                        // Fall back to legacy onHit method
                        zombie.userData.onHit(bullet.damage);
                        damageApplied = true;
                        
                        // Apply knockback separately for legacy method
                        if (zombie.userData.knockback) {
                            const knockbackForce = bullet.direction.clone().multiplyScalar(
                                bullet.damage * 0.02 * (bullet.weaponType === 'Shotgun' ? 0.1 : 0.5)
                            );
                            zombie.userData.knockback.velocity.copy(knockbackForce);
                            zombie.userData.knockback.active = true;
                        }
                    } else if (zombie.health !== undefined) {
                        // Direct health modification if no functions exist
                        zombie.health -= bullet.damage;
                        damageApplied = true;
                    } else {
                        console.warn("Zombie hit but no way to apply damage was found");
                    }
                    
                    if (damageApplied) {
                        console.log(`Zombie hit! Damage: ${bullet.damage}, Knockback: ${knockbackAmount.toFixed(2)}`);
                    }
                    
                    // For piercing bullets, track the zombie and increment pierce count
                    if (bullet.canPierce) {
                        // Ensure zombie has an ID for tracking
                        if (!zombie.id) {
                            zombie.id = Date.now() + '_' + Math.random();
                        }
                        
                        // Add to list of pierced zombies
                        bullet.piercedZombies.add(zombie.id);
                        bullet.pierceCount++;
                        
                        // If we've hit max pierce count, set hitZombie to true to remove bullet
                        if (bullet.pierceCount >= bullet.maxPierceCount) {
                            // We've reached our pierce limit, stop the bullet
                            break;
                        }
                        // Otherwise continue to the next zombie (don't break)
                    } else {
                        // Non-piercing bullets stop at the first hit
                        break;
                    }
                }
            }
        }
        
        const positions = bullet.trailPositions;
        // Shift old positions back
        for (let j = positions.length - 3; j >= 3; j -= 3) {
            positions[j] = positions[j - 3];
            positions[j + 1] = positions[j - 2];
            positions[j + 2] = positions[j - 1];
        }
        
        // Add new position - ensure values are not NaN
        positions[0] = bullet.mesh.position.x;
        positions[1] = bullet.mesh.position.y;
        positions[2] = bullet.mesh.position.z;
        
        // Update the buffer attribute
        bullet.trail.geometry.attributes.position.needsUpdate = true;
        
        // Update distance traveled
        const travelDistance = bullet.velocity.length();
        bullet.distance += travelDistance;
        
        // For piercing bullets, only remove if max pierce count reached or max distance exceeded
        const shouldRemovePiercingBullet = bullet.canPierce && bullet.pierceCount >= bullet.maxPierceCount;
        
        // Remove bullet if it's gone too far, too old, or hit a zombie (and can't pierce or reached max pierce)
        if (bullet.distance > bullet.maxDistance || 
            currentTime - bullet.createdAt > BULLET_LIFE_TIME ||
            (hitZombie && (!bullet.canPierce || shouldRemovePiercingBullet))) {
            scene.remove(bullet.mesh);
            scene.remove(bullet.trail);
            if (bullet.light) {
                scene.remove(bullet.light);
            }
            bullets.splice(i, 1);
        }
    }
    
    // Update remote player bullets (similar logic but no zombie collision)
    for (let i = remotePlayerBullets.length - 1; i >= 0; i--) {
        const bullet = remotePlayerBullets[i];
        
        // Update bullet position
        bullet.mesh.position.add(bullet.velocity);
        
        // Update light position if it exists
        if (bullet.light) {
            bullet.light.position.copy(bullet.mesh.position);
        }
        
        // Update the trail
        const positions = bullet.trailPositions;
        // Shift old positions back
        for (let j = positions.length - 3; j >= 3; j -= 3) {
            positions[j] = positions[j - 3];
            positions[j + 1] = positions[j - 2];
            positions[j + 2] = positions[j - 1];
        }
        
        // Add new position
        positions[0] = bullet.mesh.position.x;
        positions[1] = bullet.mesh.position.y;
        positions[2] = bullet.mesh.position.z;
        
        // Update the buffer attribute
        bullet.trail.geometry.attributes.position.needsUpdate = true;
        
        // Update distance traveled
        const travelDistance = bullet.velocity.length();
        bullet.distance += travelDistance;
        
        // Remote player bullets don't cause damage but should still be removed when too old or traveled too far
        if (bullet.distance > bullet.maxDistance || 
            currentTime - bullet.createdAt > BULLET_LIFE_TIME) {
            scene.remove(bullet.mesh);
            scene.remove(bullet.trail);
            if (bullet.light) {
                scene.remove(bullet.light);
            }
            remotePlayerBullets.splice(i, 1);
        }
    }
}

// Initialize the bullet model immediately
initBulletModel();

// Function to get the bullet model (for remote players)
export function getBulletModel() {
    if (!bulletModel) {
        initBulletModel();
    }
    return bulletModel;
}

// Add a remote player bullet to be updated
export function addRemoteBullet(bullet) {
    if (!bullet || !bullet.mesh) {
        console.warn("Tried to add invalid remote bullet");
        return;
    }
    
    // Add network-related piercing properties if it's a sniper rifle
    if (bullet.weaponType === "Sniper Rifle") {
        bullet.canPierce = true;
        bullet.maxPierceCount = 3;
        bullet.pierceCount = 0;
        bullet.piercedZombies = new Set();
    }
    
    remotePlayerBullets.push(bullet);
}

export function resetBullets(scene) {
    // Clear all bullets (local player and remote players)
    while (bullets.length > 0) {
        const bullet = bullets.pop();
        if (scene) {
            scene.remove(bullet.mesh);
            scene.remove(bullet.trail);
            if (bullet.light) {
                scene.remove(bullet.light);
            }
        }
    }
    
    // Clear all remote player bullets
    while (remotePlayerBullets.length > 0) {
        const bullet = remotePlayerBullets.pop();
        if (scene) {
            scene.remove(bullet.mesh);
            scene.remove(bullet.trail);
            if (bullet.light) {
                scene.remove(bullet.light);
            }
        }
    }
    
    // Reset bullet model
    bulletModel = null;
}


// Function to create a special effect when a sniper bullet pierces through a zombie
function createPiercingEffect(bullet, zombie, scene) {
    // Calculate exit point
    const exitPoint = zombie.position.clone();
    
    // Add slight offset based on bullet direction to create exit wound
    exitPoint.add(bullet.direction.clone().multiplyScalar(2.0));
    
    // Create a bright flash effect at exit point
    const flashGeometry = new THREE.SphereGeometry(0.2, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000, // Bright red
        transparent: true,
        opacity: 0.8
    });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.copy(exitPoint);
    scene.add(flashMesh);
    
    // Create exit particles (blood spray)
    const particleCount = 10;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    // Setup exit particle positions
    for (let i = 0; i < particleCount; i++) {
        // Start at exit point
        particlePositions[i * 3] = exitPoint.x;
        particlePositions[i * 3 + 1] = exitPoint.y;
        particlePositions[i * 3 + 2] = exitPoint.z;
        
        // Random sizes for particles
        particleSizes[i] = Math.random() * 0.1 + 0.05;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // Create material for particles
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xff0000, // Red for blood
        size: 0.1,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.userData = {
        velocities: Array(particleCount).fill().map(() => {
            // Direction is mostly along bullet path with some spread
            return new THREE.Vector3(
                bullet.direction.x + (Math.random() - 0.5) * 0.5,
                bullet.direction.y + (Math.random() - 0.5) * 0.5 + 0.1, // Slightly upward
                bullet.direction.z + (Math.random() - 0.5) * 0.5
            ).normalize().multiplyScalar(Math.random() * 0.2 + 0.05);
        }),
        createdAt: Date.now()
    };
    scene.add(particles);
    
    // Add a temporary light at exit point
    const exitLight = new THREE.PointLight(0xff0000, 2, 4);
    exitLight.position.copy(exitPoint);
    scene.add(exitLight);
    
    // Animate the effect
    const animateEffect = () => {
        // Update particle positions
        const positions = particles.geometry.attributes.position.array;
        const velocities = particles.userData.velocities;
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] += velocities[i].x;
            positions[i * 3 + 1] += velocities[i].y;
            positions[i * 3 + 2] += velocities[i].z;
            
            // Add gravity effect
            velocities[i].y -= 0.001;
        }
        
        // Update particle positions and opacity
        particles.geometry.attributes.position.needsUpdate = true;
        
        // Fade out the flash and particles over time
        const age = (Date.now() - particles.userData.createdAt) / 500; // 500ms lifetime
        if (age < 1) {
            particles.material.opacity = flashMesh.material.opacity = 1 - age;
            exitLight.intensity = 2 * (1 - age);
            requestAnimationFrame(animateEffect);
        } else {
            // Remove everything when animation completes
            scene.remove(flashMesh);
            scene.remove(particles);
            scene.remove(exitLight);
        }
    };
    
    // Start animation
    requestAnimationFrame(animateEffect);
}