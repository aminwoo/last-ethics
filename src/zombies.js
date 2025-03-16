import * as THREE from 'three';
import { recordZombieKill, gameState, setPlayerInvulnerable, isPlayerInvulnerable, gameOver, getWaveDifficultyScaling, getWaveComposition } from './gameState.js';
import SoundManager from './sound.js';
import { showDamageFlash } from './effects.js';

// Zombie types with different characteristics
const ZOMBIE_TYPES = {
    REGULAR: {
        speed: 0.015,
        health: 100,
        damage: 20,
        color: 0x2D7C3F, // Sickly green
        attackRange: 1.5,
        attackSpeed: 1.0, // Attacks per secondw
        size: { width: 0.8, height: 1.8, depth: 0.5 }
    },
    RUNNER: {
        speed: 0.04,
        health: 80,
        damage: 15,
        color: 0x8FBC8F, // Light green
        attackRange: 1.2,
        attackSpeed: 1.5, // Faster attacks
        size: { width: 0.7, height: 1.6, depth: 0.4 }
    },
    BRUTE: {
        speed: 0.03,
        health: 300,
        damage: 35,
        color: 0x006400, // Dark green
        attackRange: 1.8,
        attackSpeed: 0.7, // Slower attacks
        size: { width: 1.2, height: 2.2, depth: 0.8 }
    }
};

// Store all zombies
const zombies = [];

// Export zombies array for bullet collision detection
export function getZombies() {
    return zombies;
}

// Create a zombie and add it to the scene with difficulty scaling based on current wave
export function createZombie(scene, position, type = 'REGULAR', playerRef) {
    const zombieType = ZOMBIE_TYPES[type];
    
    // Apply wave difficulty scaling
    const difficultyScaling = getWaveDifficultyScaling();
    
    // Create zombie group
    const zombie = new THREE.Group();
    zombie.position.copy(position);
    zombie.userData = {
        type: 'enemy', // For bullet collision detection
        zombieType: type, // Store the zombie type
        health: Math.round(zombieType.health * difficultyScaling.health),
        maxHealth: Math.round(zombieType.health * difficultyScaling.health),
        speed: zombieType.speed * difficultyScaling.speed,
        damage: Math.round(zombieType.damage * difficultyScaling.damage),
        attackRange: zombieType.attackRange,
        attackSpeed: zombieType.attackSpeed,
        lastAttackTime: 0,
        isAttacking: false,
        isDying: false,
        isDead: false,
        isMoving: true,
        animationState: 'idle',
        animationTime: 0,
        targetPlayer: playerRef,
        hitTime: 0,
        // Add knockback properties
        knockback: {
            velocity: new THREE.Vector3(0, 0, 0),
            active: false,
            decayRate: type === 'BRUTE' ? 0.85 : (type === 'RUNNER' ? 0.9 : 0.88) // Different decay rates for different zombie types
        },
        // Increase collision radius for more effective separation
        radius: Math.max(zombieType.size.width, zombieType.size.depth) * 0.8, // Larger radius for collision
        onHit: function(damage) {
            // Handle being hit by bullet
            this.health -= damage;
            this.hitTime = Date.now();
            
            // Play hit sound or effect
            if (this.health <= 0 && !this.isDying) {
                this.isDying = true;
                this.animationState = 'dying';
                this.animationTime = 0;
                // Play death sound
                recordZombieKill(this.zombieType);
            } else {
                // Play hit sound
            }
        }
    };
    
    // Create zombie body parts
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: zombieType.color,
        roughness: 0.8,
        metalness: 0.2
    });
    
    // Create torso
    const torsoGeometry = new THREE.BoxGeometry(
        zombieType.size.width, 
        zombieType.size.height * 0.4, 
        zombieType.size.depth
    );
    const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
    torso.position.y = zombieType.size.height * 0.6; // Position at 60% of height
    torso.name = 'torso';
    zombie.add(torso);
    
    // Create head
    const headGeometry = new THREE.SphereGeometry(zombieType.size.width * 0.35, 8, 8);
    const headMaterial = new THREE.MeshStandardMaterial({ 
        color: new THREE.Color(zombieType.color).offsetHSL(0, 0, -0.1).getHex(), 
        roughness: 0.7, 
        metalness: 0.3 
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = zombieType.size.height * 0.85;
    head.name = 'head';
    zombie.add(head);
    
    // Add glowing red eyes
    const eyeGeometry = new THREE.SphereGeometry(zombieType.size.width * 0.07, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-zombieType.size.width * 0.15, 0, zombieType.size.width * 0.25);
    head.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(zombieType.size.width * 0.15, 0, zombieType.size.width * 0.25);
    head.add(rightEye);
    
    // Create arms
    const armGeometry = new THREE.BoxGeometry(
        zombieType.size.width * 0.25, 
        zombieType.size.height * 0.4, 
        zombieType.size.width * 0.25
    );
    
    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
    leftArm.position.set(
        -zombieType.size.width * 0.6, 
        zombieType.size.height * 0.6, 
        0
    );
    leftArm.name = 'leftArm';
    zombie.add(leftArm);
    
    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
    rightArm.position.set(
        zombieType.size.width * 0.6, 
        zombieType.size.height * 0.6, 
        0
    );
    rightArm.name = 'rightArm';
    zombie.add(rightArm);
    
    // Create legs
    const legGeometry = new THREE.BoxGeometry(
        zombieType.size.width * 0.3, 
        zombieType.size.height * 0.4, 
        zombieType.size.width * 0.3
    );
    
    // Left leg
    const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    leftLeg.position.set(
        -zombieType.size.width * 0.2, 
        zombieType.size.height * 0.2, 
        0
    );
    leftLeg.name = 'leftLeg';
    zombie.add(leftLeg);
    
    // Right leg
    const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
    rightLeg.position.set(
        zombieType.size.width * 0.2, 
        zombieType.size.height * 0.2, 
        0
    );
    rightLeg.name = 'rightLeg';
    zombie.add(rightLeg);
    
    // Add some damage/decay to make it look more zombie-like
    addZombieDetails(zombie, zombieType);
    
    // Add to scene and zombies array
    scene.add(zombie);
    zombies.push(zombie);
    
    return zombie;
}

// Add detailed elements to make zombie look decayed and scary
function addZombieDetails(zombie, zombieType) {
    // Find body parts
    let torso, head, leftArm, rightArm, leftLeg, rightLeg;
    
    zombie.traverse((child) => {
        if (child.name === 'torso') torso = child;
        if (child.name === 'head') head = child;
        if (child.name === 'leftArm') leftArm = child;
        if (child.name === 'rightArm') rightArm = child;
        if (child.name === 'leftLeg') leftLeg = child;
        if (child.name === 'rightLeg') rightLeg = child;
    });
    
    if (!torso) return; // Safety check
    
    // Add blood splatter to torso
    const bloodMaterial = new THREE.MeshBasicMaterial({ color: 0x8B0000 });
    const splatGeometry = new THREE.CircleGeometry(zombieType.size.width * 0.2, 8);
    const bloodSplat = new THREE.Mesh(splatGeometry, bloodMaterial);
    bloodSplat.position.z = zombieType.size.depth / 2 + 0.01;
    bloodSplat.rotation.x = Math.PI / 2;
    torso.add(bloodSplat);
    
    // Add wounds/cuts
    const woundMaterial = new THREE.MeshBasicMaterial({ color: 0x8B0000 });
    const woundGeometry = new THREE.BoxGeometry(
        zombieType.size.width * 0.1,
        zombieType.size.height * 0.05,
        zombieType.size.depth * 0.1
    );
    
    // Add random wounds to each limb
    [torso, leftArm, rightArm, leftLeg, rightLeg].forEach(limb => {
        if (!limb) return;
        
        const numberOfWounds = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < numberOfWounds; i++) {
            const wound = new THREE.Mesh(woundGeometry, woundMaterial);
            
            // Position randomly on the limb surface
            const limbGeometry = limb.geometry;
            const parameters = limbGeometry.parameters;
            
            wound.position.set(
                (Math.random() - 0.5) * parameters.width * 0.8,
                (Math.random() - 0.5) * parameters.height * 0.8,
                parameters.depth / 2 + 0.01
            );
            
            limb.add(wound);
        }
    });
    
    // Add decay/tattered clothing effects
    if (head) {
        // Add sunken areas to face 
        const sunkenAreaGeometry = new THREE.SphereGeometry(
            zombieType.size.width * 0.1, 8, 8
        );
        const sunkenAreaMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(zombieType.color).offsetHSL(0, 0, -0.2).getHex(),
            roughness: 1.0,
            metalness: 0.0
        });
        
        const leftCheek = new THREE.Mesh(sunkenAreaGeometry, sunkenAreaMaterial);
        leftCheek.position.set(
            -zombieType.size.width * 0.15,
            -zombieType.size.width * 0.1,
            zombieType.size.width * 0.2
        );
        leftCheek.scale.set(1, 0.7, 0.7);
        head.add(leftCheek);
        
        const rightCheek = new THREE.Mesh(sunkenAreaGeometry, sunkenAreaMaterial);
        rightCheek.position.set(
            zombieType.size.width * 0.15,
            -zombieType.size.width * 0.1,
            zombieType.size.width * 0.2
        );
        rightCheek.scale.set(1, 0.7, 0.7);
        head.add(rightCheek);
    }
}

// Update all zombies (move, animate, etc.)
export function updateZombies(deltaTime) {
    const currentTime = Date.now();
    
    for (let i = zombies.length - 1; i >= 0; i--) {
        const zombie = zombies[i];
        const userData = zombie.userData;
        
        // Skip updates if zombie is dead and has completed death animation
        if (userData.isDead) {
            continue;
        }
        

        // Apply hit effect (flash red)
        const timeSinceHit = currentTime - userData.hitTime;
        if (timeSinceHit < 200) {
            // Flash red when hit
            zombie.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Check if this material type supports emissive properties
                    const supportsEmissive = 
                        child.material.type === 'MeshStandardMaterial' || 
                        child.material.type === 'MeshPhongMaterial' || 
                        child.material.type === 'MeshLambertMaterial';
                    
                    if (supportsEmissive) {
                        // Clone material to avoid affecting other instances
                        if (!child.userData.originalMaterial) {
                            child.userData.originalMaterial = child.material;
                            child.material = child.material.clone();
                        }
                        // Apply emissive glow
                        child.material.emissive.set(0x880000);
                        child.material.emissiveIntensity = 1 - (timeSinceHit / 200);
                    } else if (child.material.type === 'MeshBasicMaterial') {
                        // For basic materials, we can just adjust the color directly
                        if (!child.userData.originalColor) {
                            child.userData.originalColor = child.material.color.clone();
                            child.material = child.material.clone();
                        }
                        // Blend toward red
                        const blend = 1 - (timeSinceHit / 200);
                        child.material.color.set(
                            new THREE.Color().lerpColors(
                                child.userData.originalColor,
                                new THREE.Color(0xff0000),
                                blend
                            )
                        );
                    }
                }
            });
            
            // Add stagger effect when knocked back
            if (userData.knockback && userData.knockback.active) {
                // Get zombie parts to animate stagger
                let head = zombie.getObjectByName('head');
                let torso = zombie.getObjectByName('torso');
                
                // Calculate stagger amount based on knockback velocity
                const staggerAmount = userData.knockback.velocity.length() * 5;
                const staggerFactor = Math.min(staggerAmount, 0.5); // Limit max stagger
                
                // Apply stagger animation to body parts
                if (head) {
                    // Make the head tilt backwards when knocked back
                    head.rotation.x = -staggerFactor * 0.8;
                    // Add a slight tilt to the side
                    head.rotation.z = Math.sin(currentTime * 0.02) * staggerFactor * 0.3;
                }
                
                if (torso) {
                    // Make the torso lean backwards
                    torso.rotation.x = -staggerFactor * 0.5;
                    // Add a slight sway
                    torso.rotation.z = Math.sin(currentTime * 0.015) * staggerFactor * 0.2;
                }
                
                // Modify leg and arm positions to simulate stumbling
                let leftLeg = zombie.getObjectByName('leftLeg');
                let rightLeg = zombie.getObjectByName('rightLeg');
                let leftArm = zombie.getObjectByName('leftArm');
                let rightArm = zombie.getObjectByName('rightArm');
                
                if (leftLeg && rightLeg) {
                    leftLeg.rotation.x = Math.sin(currentTime * 0.01) * staggerFactor;
                    rightLeg.rotation.x = -Math.sin(currentTime * 0.01) * staggerFactor;
                }
                
                if (leftArm && rightArm) {
                    leftArm.rotation.x = -Math.PI * 0.1 + Math.sin(currentTime * 0.02) * staggerFactor;
                    rightArm.rotation.x = -Math.PI * 0.1 - Math.sin(currentTime * 0.02) * staggerFactor;
                    leftArm.rotation.z = 0.3 + staggerFactor * 0.5;
                    rightArm.rotation.z = -0.3 - staggerFactor * 0.5;
                }
            }
        } else if (timeSinceHit >= 200 && timeSinceHit < 400) {
            // Reset materials after flash
            zombie.traverse((child) => {
                if (child.isMesh && child.material) {
                    // Reset emissive effect if applicable
                    if (child.material.emissive) {
                        child.material.emissive.set(0x000000);
                        child.material.emissiveIntensity = 0;
                    }
                    
                    // Restore original material/color if we stored it
                    if (child.userData.originalMaterial) {
                        child.material.dispose(); // Dispose cloned material to prevent memory leaks
                        child.material = child.userData.originalMaterial;
                        delete child.userData.originalMaterial;
                    } else if (child.userData.originalColor) {
                        child.material.color.copy(child.userData.originalColor);
                        delete child.userData.originalColor;
                    }
                }
            });
            
            // Reset stagger animations if knockback has ended
            if (userData.knockback && !userData.knockback.active) {
                // Reset all body part rotations from stagger effect
                const head = zombie.getObjectByName('head');
                const torso = zombie.getObjectByName('torso');
                const leftLeg = zombie.getObjectByName('leftLeg');
                const rightLeg = zombie.getObjectByName('rightLeg');
                const leftArm = zombie.getObjectByName('leftArm');
                const rightArm = zombie.getObjectByName('rightArm');
                
                // Smoothly reset rotations to prevent jarring transitions
                if (head) {
                    head.rotation.x *= 0.8;
                    head.rotation.z *= 0.8;
                }
                
                if (torso) {
                    torso.rotation.x *= 0.8;
                    torso.rotation.z *= 0.8;
                }
                
                if (leftLeg && rightLeg) {
                    leftLeg.rotation.x *= 0.8;
                    rightLeg.rotation.x *= 0.8;
                }
                
                if (leftArm && rightArm) {
                    // Keep some arm rotation for zombie pose, but remove stagger effect
                    leftArm.rotation.x = leftArm.rotation.x * 0.8 + (-Math.PI * 0.1) * 0.2;
                    rightArm.rotation.x = rightArm.rotation.x * 0.8 + (-Math.PI * 0.1) * 0.2;
                    leftArm.rotation.z = leftArm.rotation.z * 0.8 + 0.3 * 0.2;
                    rightArm.rotation.z = rightArm.rotation.z * 0.8 + (-0.3) * 0.2;
                }
            }
        }

        // Update death animation
        if (userData.isDying) {
            userData.animationTime += deltaTime;
            
            // Play death animation for 1.5 seconds
            if (userData.animationTime <= 1.5) {
                animateZombieDying(zombie, userData.animationTime / 1.5);
            } else {
                // Mark as fully dead after animation completes
                userData.isDead = true;
                userData.isDying = false;
            }
            continue;
        }
        
        // Handle knockback effect
        if (userData.knockback && userData.knockback.active) {
            // Apply knockback velocity to zombie position
            zombie.position.x += userData.knockback.velocity.x * deltaTime * 60;
            zombie.position.z += userData.knockback.velocity.z * deltaTime * 60;
            
            // Decay knockback over time
            userData.knockback.velocity.multiplyScalar(userData.knockback.decayRate);
            
            // Deactivate knockback when it becomes negligible
            if (userData.knockback.velocity.length() < 0.001) {
                userData.knockback.active = false;
                userData.knockback.velocity.set(0, 0, 0);
            }
        }
                
        
        // Move towards player if one is assigned
        if (userData.targetPlayer && userData.isMoving) {
            const playerPosition = userData.targetPlayer.position.clone();
            const direction = new THREE.Vector3();
            
            // Calculate direction to player
            direction.subVectors(playerPosition, zombie.position).normalize();
            
            // Check distance to player
            const distanceToPlayer = zombie.position.distanceTo(playerPosition);
            
            // Rotate zombie to face player
            if (direction.x !== 0 || direction.z !== 0) {
                const angle = Math.atan2(direction.x, direction.z);
                zombie.rotation.y = angle;
            }
            
            // Move zombie towards player if not in attack range
            if (distanceToPlayer > userData.attackRange) {
                // Calculate base movement direction toward player
                let moveX = direction.x * userData.speed * deltaTime * 60;
                let moveZ = direction.z * userData.speed * deltaTime * 60;
                
                // Calculate separation force to avoid other zombies
                const separationForce = calculateZombieSeparation(zombie, i);
                
                // Apply separation force to movement (with strength based on zombie type)
                const separationStrength = userData.zombieType === 'BRUTE' ? 0.4 : 
                                          (userData.zombieType === 'RUNNER' ? 0.6 : 0.5);
                
                // Apply steering behaviors for more natural movement
                const steeringForce = calculateSteeringForce(zombie, direction, separationForce, separationStrength);
                
                moveX += steeringForce.x;
                moveZ += steeringForce.z;
                
                // If not under knockback effect, apply regular movement
                if (!userData.knockback || !userData.knockback.active) {
                    // Apply the combined movement
                    zombie.position.x += moveX;
                    zombie.position.z += moveZ;
                }
                
                // Update rotation to face movement direction (with some smoothing)
                if (moveX !== 0 || moveZ !== 0) {
                    // Get movement direction (either from normal movement or from knockback)
                    let targetAngle;
                    
                    if (userData.knockback && userData.knockback.active && userData.knockback.velocity.length() > 0.01) {
                        // During knockback, face the direction we're being pushed
                        targetAngle = Math.atan2(userData.knockback.velocity.x, userData.knockback.velocity.z);
                    } else {
                        // Normal movement direction
                        targetAngle = Math.atan2(moveX, moveZ);
                    }
                    
                    const currentAngle = zombie.rotation.y;
                    
                    // Smoothly interpolate rotation (faster for runners, slower for brutes)
                    const rotationSpeed = userData.zombieType === 'BRUTE' ? 0.05 : 
                                         (userData.zombieType === 'RUNNER' ? 0.15 : 0.1);
                                        
                    zombie.rotation.y = currentAngle + ((targetAngle - currentAngle + Math.PI) % (Math.PI * 2) - Math.PI) * rotationSpeed;
                }
                
                // Set animation state to walking
                if (userData.animationState !== 'walking') {
                    userData.animationState = 'walking';
                    userData.animationTime = 0;
                }
            } else {
                // In attack range, try to attack
                const timeSinceLastAttack = (currentTime - userData.lastAttackTime) / 1000;
                
                if (timeSinceLastAttack >= (1 / userData.attackSpeed)) {
                    // Perform attack
                    userData.lastAttackTime = currentTime;
                    userData.isAttacking = true;
                    userData.animationState = 'attacking';
                    userData.animationTime = 0;
                    
                    // Apply damage to player
                    damagePlayer(userData.targetPlayer, userData.damage);
                }
            }
        }
        
        // Update animations based on state
        userData.animationTime += deltaTime;
        
        if (userData.animationState === 'walking') {
            animateZombieWalking(zombie, userData.animationTime);
        } else if (userData.animationState === 'attacking') {
            // Attack animation lasts 1 second
            if (userData.animationTime <= 1.0) {
                animateZombieAttacking(zombie, userData.animationTime);
            } else {
                userData.isAttacking = false;
                userData.animationState = 'idle';
                userData.animationTime = 0;
            }
        } else if (userData.animationState === 'idle') {
            animateZombieIdle(zombie, userData.animationTime);
        }
    }
}

// Calculate separation force to avoid other zombies
function calculateZombieSeparation(zombie, currentIndex) {
    const separationForce = new THREE.Vector3(0, 0, 0);
    
    // Check collision with other zombies - higher priority than obstacles
    for (let i = 0; i < zombies.length; i++) {
        // Skip self and dead zombies
        if (i === currentIndex || zombies[i].userData.isDead || zombies[i].userData.isDying) {
            continue;
        }
        
        const otherZombie = zombies[i];
        const distance = zombie.position.distanceTo(otherZombie.position);
        
        // Calculate combined radius for both zombies for collision detection
        // Use larger radius to prevent any stacking - increase by 50%
        const combinedRadius = (zombie.userData.radius || 0.5) + (otherZombie.userData.radius || 0.5);
        const desiredDistance = combinedRadius * 1.5; // Increase buffer from 20% to 50%
        
        // Use exponential force as zombies get closer to each other
        if (distance < desiredDistance) {
            // Direction away from the other zombie
            const awayDirection = new THREE.Vector3().subVectors(
                zombie.position,
                otherZombie.position
            ).normalize();
            
            // Force is stronger the closer they are (exponential increase as they get closer)
            // Distance ratio squared for stronger avoidance at close distances
            const forceMagnitude = Math.pow((desiredDistance - distance) / desiredDistance, 2) * 2.0;
            
            // Scale by zombie speed with priority factor
            const forceStrength = zombie.userData.speed * 1.0 * forceMagnitude;
            
            // Add to total separation force
            separationForce.add(
                awayDirection.multiplyScalar(forceStrength)
            );
            
            // When zombies are extremely close (about to stack), apply emergency separation
            if (distance < combinedRadius * 0.8) {
                // Apply a much stronger force in the direction away from the other zombie
                const emergencyForce = awayDirection.clone().multiplyScalar(
                    zombie.userData.speed * 5.0 // Very strong push
                );
                separationForce.add(emergencyForce);
            }
        }
    }
    
    // Check collision with environment obstacles (secondary priority)
    if (window.environmentObstacles) {
        const obstacles = window.environmentObstacles;
        
        for (let i = 0; i < obstacles.length; i++) {
            const obstacle = obstacles[i];
            
            if (obstacle.userData && obstacle.userData.type === 'obstacle') {
                const distance = zombie.position.distanceTo(obstacle.position);
                
                // Get obstacle radius or use default
                const obstacleRadius = obstacle.userData.radius || 1.5;
                const zombieRadius = zombie.userData.radius || 0.5;
                
                // Calculate minimum distance to maintain
                const minDistance = obstacleRadius + zombieRadius + 0.8; // Increased buffer
                
                // If zombie is too close to obstacle
                if (distance < minDistance) {
                    // Direction away from the obstacle
                    const awayDirection = new THREE.Vector3().subVectors(
                        zombie.position,
                        obstacle.position
                    ).normalize();
                    
                    // Force is stronger the closer they are (exponential)
                    const forceMagnitude = Math.pow((minDistance - distance) / minDistance, 2) * 1.5;
                    
                    // Scale by zombie speed 
                    const forceStrength = zombie.userData.speed * 1.2 * forceMagnitude;
                    
                    // Add to total separation force
                    separationForce.add(
                        awayDirection.multiplyScalar(forceStrength)
                    );
                }
            }
        }
    }
    
    return separationForce;
}

// Calculate steering force for more natural movement
function calculateSteeringForce(zombie, targetDirection, separationForce, separationStrength) {
    const userData = zombie.userData;
    const steeringForce = new THREE.Vector3();
    
    // Check if separation force is significant - if so, prioritize it
    const separationMagnitude = separationForce.length();
    const isCollisionImminent = separationMagnitude > 0.01;
    
    // 1. Weighted Separation (avoid other zombies and obstacles)
    // Increase separation strength when collisions are imminent
    const adjustedSeparationStrength = isCollisionImminent ? 
                                      separationStrength * 3.0 : 
                                      separationStrength;
    
    const separationVector = separationForce.clone().multiplyScalar(adjustedSeparationStrength);
    steeringForce.add(separationVector);
    
    // If we're very close to a collision, make separation the dominant force
    if (separationMagnitude > 0.03) {
        // Prioritize separation over other behaviors
        return steeringForce.multiplyScalar(userData.speed * 1.5);
    }
    
    // 2. Seeking behavior (move toward target/player)
    // Reduce seeking strength when there are nearby obstacles or zombies
    const seekWeight = userData.zombieType === 'RUNNER' ? 0.8 : 
                      (userData.zombieType === 'BRUTE' ? 0.5 : 0.6);
    
    // Adjust seek weight based on collision proximity
    const adjustedSeekWeight = isCollisionImminent ? 
                               seekWeight * (1.0 - Math.min(separationMagnitude * 5, 0.9)) : 
                               seekWeight;
    
    const seekVector = targetDirection.clone().multiplyScalar(adjustedSeekWeight);
    
    // 3. Path following (avoid sharp turns)
    // Get the zombie's current forward direction
    const forwardDirection = new THREE.Vector3(0, 0, 1).applyQuaternion(zombie.quaternion);
    
    // Calculate how much the zombie's current direction aligns with the target direction
    // This creates more realistic movement by making zombies turn gradually
    const alignmentFactor = forwardDirection.dot(targetDirection);
    
    // If the zombie is already moving in a similar direction, maintain momentum
    // But reduce this when near obstacles
    const inertiaWeight = isCollisionImminent ? 
                         0.05 * (alignmentFactor > 0 ? alignmentFactor : 0) : 
                         0.2 * (alignmentFactor > 0 ? alignmentFactor : 0);
    
    const inertiaVector = forwardDirection.clone().multiplyScalar(inertiaWeight);
    
    // 4. Random movement (wander behavior) - adds unpredictability
    // Reduce randomness when avoiding obstacles
    const randomStrength = isCollisionImminent ? 
                          0.02 : 
                          (userData.zombieType === 'REGULAR' ? 0.1 : 0.05);
    
    const randomVector = new THREE.Vector3(
        (Math.random() - 0.5) * 2 * randomStrength,
        0,
        (Math.random() - 0.5) * 2 * randomStrength
    );
    
    // 5. Group cohesion - zombies tend to stay near each other, forming hordes
    // Completely ignore cohesion when collisions are imminent
    let cohesionVector = new THREE.Vector3(0, 0, 0);
    
    if (!isCollisionImminent) {
        // Find center of nearby zombies
        cohesionVector = calculateCohesionForce(zombie, 10); // Look for zombies within 10 units
        const cohesionWeight = userData.zombieType === 'REGULAR' ? 0.15 : 
                              (userData.zombieType === 'RUNNER' ? 0.05 : 0.2);
        cohesionVector.multiplyScalar(cohesionWeight);
    }
    
    // Combine all steering behaviors with appropriate weights
    steeringForce.add(seekVector);
    steeringForce.add(inertiaVector);
    steeringForce.add(randomVector);
    steeringForce.add(cohesionVector);
    
    // Apply character-specific adjustments
    if (userData.zombieType === 'BRUTE') {
        // Brutes move more purposefully with less randomness
        steeringForce.multiplyScalar(0.8); // Slow down overall movement
    } else if (userData.zombieType === 'RUNNER') {
        // Runners can make sharper turns and move more erratically
        steeringForce.multiplyScalar(1.2); // More responsive
    }
    
    // Scale force by the zombie's speed
    steeringForce.multiplyScalar(userData.speed);
    
    return steeringForce;
}

// Calculate cohesion force to keep zombies in loose groups
function calculateCohesionForce(zombie, radius) {
    const cohesionForce = new THREE.Vector3(0, 0, 0);
    let neighborCount = 0;
    
    // Find all zombies within the specified radius
    for (let i = 0; i < zombies.length; i++) {
        const otherZombie = zombies[i];
        
        // Skip self, dead zombies, and different types (for more distinct hordes)
        if (zombie === otherZombie || 
            otherZombie.userData.isDead || 
            otherZombie.userData.isDying ||
            otherZombie.userData.zombieType !== zombie.userData.zombieType) {
            continue;
        }
        
        const distance = zombie.position.distanceTo(otherZombie.position);
        
        // If in cohesion radius but not too close
        if (distance < radius && distance > 3) {
            cohesionForce.add(otherZombie.position);
            neighborCount++;
        }
    }
    
    // If there are neighbors, move slightly toward their center
    if (neighborCount > 0) {
        cohesionForce.divideScalar(neighborCount);
        cohesionForce.sub(zombie.position);
        cohesionForce.normalize();
    }
    
    return cohesionForce;
}

// Animate zombie idle state (subtle swaying)
function animateZombieIdle(zombie, time) {
    let head, leftArm, rightArm, torso;
    
    zombie.traverse((child) => {
        if (child.name === 'head') head = child;
        if (child.name === 'leftArm') leftArm = child;
        if (child.name === 'rightArm') rightArm = child;
        if (child.name === 'torso') torso = child;
    });
    
    if (head) {
        // Subtle head swaying
        head.rotation.z = Math.sin(time * 0.5) * 0.1;
        head.rotation.y = Math.sin(time * 0.3) * 0.1;
    }
    
    if (leftArm) {
        // Arm hanging
        leftArm.rotation.x = Math.sin(time * 0.5) * 0.05;
        leftArm.rotation.z = 0.2 + Math.sin(time * 0.7) * 0.05;
    }
    
    if (rightArm) {
        // Arm hanging
        rightArm.rotation.x = Math.sin(time * 0.5 + 0.5) * 0.05;
        rightArm.rotation.z = -0.2 + Math.sin(time * 0.7 + 0.5) * 0.05;
    }
    
    if (torso) {
        // Subtle body sway
        torso.rotation.y = Math.sin(time * 0.4) * 0.03;
    }
}

// Animate zombie walking
function animateZombieWalking(zombie, time) {
    let head, leftArm, rightArm, leftLeg, rightLeg, torso;
    
    zombie.traverse((child) => {
        if (child.name === 'head') head = child;
        if (child.name === 'leftArm') leftArm = child;
        if (child.name === 'rightArm') rightArm = child;
        if (child.name === 'leftLeg') leftLeg = child;
        if (child.name === 'rightLeg') rightLeg = child;
        if (child.name === 'torso') torso = child;
    });
    
    // Shambling animation frequency
    const frequency = 3;
    const t = time * frequency;
    
    if (head) {
        // Head bobbing and tilting
        head.rotation.z = Math.sin(t * 0.5) * 0.2;
        // Get the zombie's type to determine head height - fallback to 1.5 if not found
        const zombieType = zombie.userData.type === 'enemy' ? 
                          ZOMBIE_TYPES[zombie.userData.zombieType || 'REGULAR'] : 
                          ZOMBIE_TYPES.REGULAR;
        head.position.y = zombieType.size.height * 0.85 || 1.5;
        head.position.y += Math.sin(t) * 0.05;
    }
    
    if (leftArm) {
        // Shambling arms swinging opposite to legs
        leftArm.rotation.x = Math.sin(t) * 0.4;
        leftArm.rotation.z = 0.3 + Math.sin(t) * 0.1;
    }
    
    if (rightArm) {
        // Opposite phase to left arm
        rightArm.rotation.x = Math.sin(t + Math.PI) * 0.4;
        rightArm.rotation.z = -0.3 + Math.sin(t + Math.PI) * 0.1;
    }
    
    if (leftLeg) {
        // Leg movement
        leftLeg.rotation.x = Math.sin(t + Math.PI) * 0.4;
    }
    
    if (rightLeg) {
        // Opposite phase to left leg
        rightLeg.rotation.x = Math.sin(t) * 0.4;
    }
    
    if (torso) {
        // Torso shambling movement
        torso.rotation.z = Math.sin(t) * 0.05;
        torso.rotation.x = Math.sin(t * 0.5) * 0.03;
        torso.position.y = Math.sin(t) * 0.05 + 0.6;
    }
}

// Animate zombie attacking
function animateZombieAttacking(zombie, progress) {
    let head, leftArm, rightArm, torso;
    
    zombie.traverse((child) => {
        if (child.name === 'head') head = child;
        if (child.name === 'leftArm') leftArm = child;
        if (child.name === 'rightArm') rightArm = child;
        if (child.name === 'torso') torso = child;
    });
    
    // Attack animation phases
    // 0.0-0.4: Wind up
    // 0.4-0.6: Strike
    // 0.6-1.0: Return
    
    if (progress <= 0.4) {
        // Wind up phase - multiply progress to get 0-1 range for this phase
        const windupProgress = progress / 0.4;
        
        if (head) {
            head.rotation.x = -windupProgress * 0.5; // Look down as winding up
            head.rotation.z = -windupProgress * 0.3; // Tilt
        }
        
        if (leftArm && rightArm) {
            // Raise both arms
            leftArm.rotation.x = -windupProgress * Math.PI * 0.6;
            leftArm.rotation.z = 0.3 - windupProgress * 0.5;
            
            rightArm.rotation.x = -windupProgress * Math.PI * 0.6;
            rightArm.rotation.z = -0.3 + windupProgress * 0.5;
        }
        
        if (torso) {
            torso.rotation.x = -windupProgress * 0.3; // Lean back slightly
        }
    } else if (progress <= 0.6) {
        // Strike phase
        const strikeProgress = (progress - 0.4) / 0.2;
        
        if (head) {
            head.rotation.x = -0.5 + strikeProgress * 1.0; // Thrust forward
            head.rotation.z = -0.3 + strikeProgress * 0.3; // Straighten
        }
        
        if (leftArm && rightArm) {
            // Thrust arms forward
            leftArm.rotation.x = -Math.PI * 0.6 + strikeProgress * Math.PI * 0.8;
            leftArm.rotation.z = 0.3 - 0.5 + strikeProgress * 0.5;
            
            rightArm.rotation.x = -Math.PI * 0.6 + strikeProgress * Math.PI * 0.8;
            rightArm.rotation.z = -0.3 + 0.5 - strikeProgress * 0.5;
        }
        
        if (torso) {
            torso.rotation.x = -0.3 + strikeProgress * 0.5; // Lunge forward
        }
    } else {
        // Return phase
        const returnProgress = (progress - 0.6) / 0.4;
        
        if (head) {
            head.rotation.x = 0.5 - returnProgress * 0.5; // Return to normal
            head.rotation.z = returnProgress * 0.1; // Slight tilt
        }
        
        if (leftArm && rightArm) {
            // Return arms
            leftArm.rotation.x = Math.PI * 0.2 - returnProgress * Math.PI * 0.2;
            leftArm.rotation.z = 0.3 - returnProgress * 0.1;
            
            rightArm.rotation.x = Math.PI * 0.2 - returnProgress * Math.PI * 0.2;
            rightArm.rotation.z = -0.3 + returnProgress * 0.1;
        }
        
        if (torso) {
            torso.rotation.x = 0.2 - returnProgress * 0.2; // Return to normal
        }
    }
}

// Animate zombie dying
function animateZombieDying(zombie, progress) {
    // 0.0-0.3: Initial reaction
    // 0.3-0.7: Falling
    // 0.7-1.0: On ground
    
    let head, leftArm, rightArm, leftLeg, rightLeg, torso;
    
    zombie.traverse((child) => {
        if (child.name === 'head') head = child;
        if (child.name === 'leftArm') leftArm = child;
        if (child.name === 'rightArm') rightArm = child;
        if (child.name === 'leftLeg') leftLeg = child;
        if (child.name === 'rightLeg') rightLeg = child;
        if (child.name === 'torso') torso = child;
    });
    
    if (progress <= 0.3) {
        // Initial death reaction
        const reactionProgress = progress / 0.3;
        
        if (head) {
            head.rotation.z = reactionProgress * 0.5; // Head thrown back
            head.rotation.x = reactionProgress * 0.3; // Head looking up
        }
        
        if (leftArm && rightArm) {
            // Arms thrown outward
            leftArm.rotation.z = 0.3 + reactionProgress * 0.7;
            rightArm.rotation.z = -0.3 - reactionProgress * 0.7;
        }
        
        if (torso) {
            torso.rotation.x = -reactionProgress * 0.2; // Lean back
        }
    } else if (progress <= 0.7) {
        // Falling to ground
        const fallingProgress = (progress - 0.3) / 0.4;
        
        // Rotate entire zombie to fall
        zombie.rotation.x = fallingProgress * Math.PI / 2; // Fall forward
        
        if (head) {
            head.rotation.z = 0.5;
            head.rotation.x = 0.3 + fallingProgress * 0.4; // Head lolls more
        }
        
        if (leftArm && rightArm) {
            // Arms splay out
            leftArm.rotation.z = 1.0;
            rightArm.rotation.z = -1.0;
            leftArm.rotation.x = fallingProgress * 0.5;
            rightArm.rotation.x = fallingProgress * 0.5;
        }
        
        // Fall to ground
        zombie.position.y = Math.max(0, 1.0 - fallingProgress * 1.0);
    } else {
        // On ground
        const groundProgress = (progress - 0.7) / 0.3;
        
        // Keep zombie on ground
        zombie.rotation.x = Math.PI / 2;
        zombie.position.y = 0;
        
        // Final twitches
        if (leftArm) {
            leftArm.rotation.z = 1.0 + Math.sin(groundProgress * 10) * 0.1 * (1 - groundProgress);
        }
        
        if (rightLeg) {
            rightLeg.rotation.z = Math.sin(groundProgress * 8) * 0.15 * (1 - groundProgress);
        }
    }
}

// Create multiple zombies in a group/horde with wave-appropriate composition
export function spawnZombieHorde(scene, centerPosition, count, player) {
    const zombies = [];
    const spawnPositions = [];
    const radius = Math.sqrt(count) * 3; // Increased radius to give more initial space
    
    // First pass: Generate potential spawn positions
    for (let i = 0; i < count * 2; i++) { // Generate more positions than needed to allow for filtering
        // Use more structured distribution (circle with random offset)
        const angle = (i / (count * 2)) * Math.PI * 2;
        const distance = 1.5 + Math.random() * radius;
        const x = centerPosition.x + Math.cos(angle) * distance;
        const z = centerPosition.z + Math.sin(angle) * distance;
        
        spawnPositions.push(new THREE.Vector3(x, 0, z));
    }
    
    // Filter positions to ensure minimum spacing
    const finalPositions = [];
    const minSpacing = 2.5; // Minimum distance between spawn positions
    
    for (let pos of spawnPositions) {
        let tooClose = false;
        
        // Check distance to existing selected positions
        for (let existingPos of finalPositions) {
            if (pos.distanceTo(existingPos) < minSpacing) {
                tooClose = true;
                break;
            }
        }
        
        // Also check for obstacles nearby
        if (!tooClose && window.environmentObstacles) {
            for (let obstacle of window.environmentObstacles) {
                const obstacleRadius = obstacle.userData?.radius || 1.5;
                if (pos.distanceTo(obstacle.position) < obstacleRadius + 2.0) {
                    tooClose = true;
                    break;
                }
            }
        }
        
        // If position is valid, add it
        if (!tooClose) {
            finalPositions.push(pos);
            
            // Once we have enough positions, stop
            if (finalPositions.length >= count) {
                break;
            }
        }
    }
    
    // If we couldn't find enough valid positions, fill remaining with random ones
    while (finalPositions.length < count) {
        const randAngle = Math.random() * Math.PI * 2;
        const randDistance = 2.0 + Math.random() * radius * 1.5;
        const x = centerPosition.x + Math.cos(randAngle) * randDistance;
        const z = centerPosition.z + Math.sin(randAngle) * randDistance;
        
        finalPositions.push(new THREE.Vector3(x, 0, z));
    }
    
    // Get wave composition for zombie types
    const waveComposition = getWaveComposition();
    
    // Now spawn zombies at the final positions
    for (let i = 0; i < count; i++) {
        // Determine zombie type based on wave composition
        const typeRoll = Math.random();
        let type = 'REGULAR';
        let cumulativeProbability = 0;
        
        for (const [zombieType, probability] of Object.entries(waveComposition)) {
            cumulativeProbability += probability;
            if (typeRoll <= cumulativeProbability) {
                type = zombieType;
                break;
            }
        }
        
        // Create zombie at position
        const zombie = createZombie(scene, finalPositions[i], type, player);
        zombies.push(zombie);
    }
    
    return zombies;
}

// Generate random spawn points around the player at a safe distance
export function generateSpawnPointsAroundPlayer(player, minDistance, maxDistance, count) {
    const spawnPoints = [];
    const playerPos = player.position.clone();
    
    for (let i = 0; i < count; i++) {
        // Generate random angle
        const angle = Math.random() * Math.PI * 2;
        
        // Generate random distance between min and max
        const distance = minDistance + Math.random() * (maxDistance - minDistance);
        
        // Calculate position
        const x = playerPos.x + Math.cos(angle) * distance;
        const z = playerPos.z + Math.sin(angle) * distance;
        
        spawnPoints.push(new THREE.Vector3(x, 0, z));
    }
    
    return spawnPoints;
}

// Remove dead zombies (optionally with delay after death animation)
export function cleanupDeadZombies(scene, delay = 10000) {
    const currentTime = Date.now();
    
    for (let i = zombies.length - 1; i >= 0; i--) {
        const zombie = zombies[i];
        
        if (zombie.userData.isDead) {
            // Check if we should remove it (after delay)
            if (!zombie.userData.deathTime) {
                zombie.userData.deathTime = currentTime;
            }
            
            if (currentTime - zombie.userData.deathTime > delay) {
                // Remove from scene and array
                scene.remove(zombie);
                zombies.splice(i, 1);
            }
        }
    }
}

// Function to apply damage to the player
export function damagePlayer(player, damage) {
    // Check if player is currently invulnerable or if game is over
    if (isPlayerInvulnerable() || gameState.isGameOver) {
        return; // Skip damage if player is invulnerable or game is over
    }
    
    // Reduce player health by zombie damage amount
    gameState.health = Math.max(0, gameState.health - damage);
    
    // Make player invulnerable for a short time
    setPlayerInvulnerable();
    
    // Show damage flash effect
    showDamageFlash();
    
    // Play hit sound if available
    try {
        SoundManager.playerPlayerHit();
    } catch (error) {
        console.log('Sound effect not available');
    }
    
    // Check if player has died
    if (gameState.health <= 0) {
        // Trigger game over
        gameOver();
    }
} 