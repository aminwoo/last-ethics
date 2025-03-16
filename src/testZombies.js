import * as THREE from 'three';
import * as ZombieSystem from './zombies.js';

// Function to create all three zombie types side by side for comparison
export function testZombieTypes(scene, playerRef) {
    console.log("Creating test zombies of all types...");
    
    // Create zombies at specific positions
    const regularZombie = ZombieSystem.createZombie(
        scene, 
        new THREE.Vector3(-5, 0, -5), 
        'REGULAR', 
        playerRef
    );
    
    const runnerZombie = ZombieSystem.createZombie(
        scene, 
        new THREE.Vector3(0, 0, -5), 
        'RUNNER', 
        playerRef
    );
    
    const bruteZombie = ZombieSystem.createZombie(
        scene, 
        new THREE.Vector3(5, 0, -5), 
        'BRUTE', 
        playerRef
    );
    
    // Disable movement so they stay in place for comparison
    regularZombie.userData.isMoving = false;
    runnerZombie.userData.isMoving = false;
    bruteZombie.userData.isMoving = false;
    
    console.log("Test zombies created:");
    console.log("- Regular zombie at position (-5, 0, -5)");
    console.log("- Runner zombie at position (0, 0, -5)");
    console.log("- Brute zombie at position (5, 0, -5)");
    
    return {
        regularZombie,
        runnerZombie,
        bruteZombie
    };
}

// Function to test zombie damage and death animations
export function testZombieDamage(zombie, damage = 10, hitDirection) {
    if (!zombie) {
        console.error("No zombie provided for damage test");
        return;
    }
    
    // Default hit direction (from player towards zombie)
    const defaultDirection = new THREE.Vector3(0, 0, -1);
    const direction = hitDirection || defaultDirection;
    
    console.log(`Testing damage on ${zombie.userData.zombieType} zombie`);
    console.log(`Current health: ${zombie.userData.health}/${zombie.userData.maxHealth}`);
    console.log(`Applying ${damage} damage...`);
    
    // Apply damage to zombie
    const died = zombie.takeDamage(damage, direction, 1.0, false);
    
    console.log(`New health: ${zombie.userData.health}/${zombie.userData.maxHealth}`);
    
    if (died) {
        console.log("Zombie died! Ragdoll physics activated.");
    }
    
    return died;
}

// Function to test zombie hordes with different composition
export function testZombieHorde(scene, position, playerRef) {
    // Create a mixed horde with all three types
    const horde = [];
    
    // Create 3 regular zombies
    for (let i = 0; i < 3; i++) {
        const zombie = ZombieSystem.createZombie(
            scene, 
            new THREE.Vector3(
                position.x + (Math.random() * 10 - 5), 
                0, 
                position.z + (Math.random() * 10 - 5)
            ), 
            'REGULAR', 
            playerRef
        );
        horde.push(zombie);
    }
    
    // Create 2 runner zombies
    for (let i = 0; i < 2; i++) {
        const zombie = ZombieSystem.createZombie(
            scene, 
            new THREE.Vector3(
                position.x + (Math.random() * 10 - 5), 
                0, 
                position.z + (Math.random() * 10 - 5)
            ), 
            'RUNNER', 
            playerRef
        );
        horde.push(zombie);
    }
    
    // Create 1 brute zombie
    const bruteZombie = ZombieSystem.createZombie(
        scene, 
        new THREE.Vector3(
            position.x, 
            0, 
            position.z
        ), 
        'BRUTE', 
        playerRef
    );
    horde.push(bruteZombie);
    
    console.log(`Created test horde at (${position.x}, ${position.z}) with:`);
    console.log("- 3 Regular zombies");
    console.log("- 2 Runner zombies");
    console.log("- 1 Brute zombie");
    
    return horde;
} 