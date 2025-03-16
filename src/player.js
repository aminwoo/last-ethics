import * as THREE from 'three';
import SoundManager from './sound.js';
import * as Weapons from './weapons.js';
import { sendPlayerUpdate } from './network.js';

// Player movement speed
const PLAYER_SPEED = 0.07;
const PLAYER_SPRINT_MULTIPLIER = 1.5;

function createPlayer() {
    const player = new THREE.Group();
    player.name = 'player'; // Set a name to easily find the player object
    
    // Body
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
    const playerModel = new THREE.Mesh(bodyGeometry, bodyMaterial);
    playerModel.position.y = 1.2;
    playerModel.castShadow = false;
    playerModel.receiveShadow = true;
    player.add(playerModel);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.0;
    head.castShadow = false;
    head.receiveShadow = true;
    player.add(head);
    
    // Create arms
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
    
    // Left arm (gun arm - pointing forward)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.5, 1.6, 0);
    // Rotate the entire arm group to point forward
    leftArmGroup.rotation.x = -Math.PI / 2;
    player.add(leftArmGroup);
    
    const leftUpperArmGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
    const leftUpperArm = new THREE.Mesh(leftUpperArmGeometry, armMaterial);
    leftUpperArm.position.y = -0.2;
    leftUpperArm.castShadow = false;
    leftUpperArm.receiveShadow = true;
    leftArmGroup.add(leftUpperArm);
    
    const leftForearmGroup = new THREE.Group();
    leftForearmGroup.position.y = -0.4;
    // Slight bend at the elbow for a more natural aiming pose
    leftForearmGroup.rotation.x = Math.PI / 12;
    leftArmGroup.add(leftForearmGroup);
    
    const leftForearmGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    const leftForearm = new THREE.Mesh(leftForearmGeometry, armMaterial);
    leftForearm.position.y = -0.2;
    leftForearm.castShadow = false;
    leftForearm.receiveShadow = true;
    leftForearmGroup.add(leftForearm);
    
    // Left hand
    const leftHandGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const leftHandMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const leftHand = new THREE.Mesh(leftHandGeometry, leftHandMaterial);
    leftHand.position.y = -0.4;
    leftHand.castShadow = false;
    leftForearmGroup.add(leftHand);
    
    // Right arm (hanging naturally)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.5, 1.6, 0);
    player.add(rightArmGroup);
    
    const rightUpperArmGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
    const rightUpperArm = new THREE.Mesh(rightUpperArmGeometry, armMaterial);
    rightUpperArm.position.y = -0.2;
    rightUpperArm.castShadow = false;
    rightUpperArm.receiveShadow = true;
    rightArmGroup.add(rightUpperArm);
    
    const rightForearmGroup = new THREE.Group();
    rightForearmGroup.position.y = -0.4;
    rightArmGroup.add(rightForearmGroup);
    
    const rightForearmGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    const rightForearm = new THREE.Mesh(rightForearmGeometry, armMaterial);
    rightForearm.position.y = -0.2;
    rightForearm.castShadow = false;
    rightForearm.receiveShadow = true;
    rightForearmGroup.add(rightForearm);
    
    // Right hand
    const rightHandGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const rightHandMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const rightHand = new THREE.Mesh(rightHandGeometry, rightHandMaterial);
    rightHand.position.y = -0.4;
    rightHand.castShadow = false;
    rightForearmGroup.add(rightHand);
    
    // Create weapon models and attach them to the player
    const weaponModels = Weapons.createWeaponModels(leftForearmGroup);
    
    // Create legs
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x2255dd });
    
    // Left leg
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.2, 0.6, 0);
    player.add(leftLegGroup);
    
    const leftThighGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8);
    const leftThigh = new THREE.Mesh(leftThighGeometry, legMaterial);
    leftThigh.position.y = -0.25;
    leftThigh.castShadow = false;
    leftThigh.receiveShadow = true;
    leftLegGroup.add(leftThigh);
    
    const leftCalfGroup = new THREE.Group();
    leftCalfGroup.position.y = -0.5;
    leftLegGroup.add(leftCalfGroup);
    
    const leftCalfGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8);
    const leftCalf = new THREE.Mesh(leftCalfGeometry, legMaterial);
    leftCalf.position.y = -0.25;
    leftCalf.castShadow = false;
    leftCalf.receiveShadow = true;
    leftCalfGroup.add(leftCalf);
    
    // Right leg
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.2, 0.6, 0);
    player.add(rightLegGroup);
    
    const rightThighGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8);
    const rightThigh = new THREE.Mesh(rightThighGeometry, legMaterial);
    rightThigh.position.y = -0.25;
    rightThigh.castShadow = false;
    rightThigh.receiveShadow = true;
    rightLegGroup.add(rightThigh);
    
    const rightCalfGroup = new THREE.Group();
    rightCalfGroup.position.y = -0.5;
    rightLegGroup.add(rightCalfGroup);
    
    const rightCalfGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8);
    const rightCalf = new THREE.Mesh(rightCalfGeometry, legMaterial);
    rightCalf.position.y = -0.25;
    rightCalf.castShadow = false;
    rightCalf.receiveShadow = true;
    rightCalfGroup.add(rightCalf);
    
    // Store references for animation
    player.userData = {
        leftLeg: {
            thigh: leftLegGroup,
            calf: leftCalfGroup
        },
        rightLeg: {
            thigh: rightLegGroup,
            calf: rightCalfGroup
        },
        leftArm: {
            upper: leftArmGroup,
            forearm: leftForearmGroup
        },
        rightArm: {
            upper: rightArmGroup,
            forearm: rightForearmGroup
        },
        weapons: weaponModels,
        animationTime: 0,
        isWalking: false,
        walkSpeed: 1.0,
        batSwingAnimation: {
            isSwinging: false,
            startPosition: { x: 0, y: 0, z: 0, rotX: 0, rotY: 0, rotZ: 0 },
            progress: 0,
            duration: 0.5  // in seconds
        }
    };
    
    return player; 
}

// Initialize player with the current weapon
function initializePlayer(scene, gameState) {
    const playerObj = createPlayer();
    // Set initial arm positions based on starting weapon
    Weapons.updatePlayerArmsForWeapon(playerObj, gameState);
    scene.add(playerObj);
    return playerObj;
}

// Update the animation function to animate only the right arm while keeping the left arm steady for aiming
function animatePlayerLegs(player, isMoving, deltaTime, isShiftPressed) {
    const userData = player.userData;
    const leftLeg = userData.leftLeg;
    const rightLeg = userData.rightLeg;
    const rightArm = userData.rightArm;
    
    // Update animation state
    userData.isWalking = isMoving;
    
    if (isMoving) {
        // Increment animation time when moving
        userData.animationTime += deltaTime * userData.walkSpeed * (isShiftPressed ? 1.8 : 1.0);
        
        // Calculate leg angles based on sine wave
        const leftLegAngle = Math.sin(userData.animationTime * 10) * 0.5;
        const rightLegAngle = Math.sin(userData.animationTime * 10 + Math.PI) * 0.5;
        
        // Apply rotation to thighs
        leftLeg.thigh.rotation.x = leftLegAngle;
        rightLeg.thigh.rotation.x = rightLegAngle;
        
        // Apply counter-rotation to calves for a more natural look
        leftLeg.calf.rotation.x = Math.max(0, -leftLegAngle * 0.5);
        rightLeg.calf.rotation.x = Math.max(0, -rightLegAngle * 0.5);
        
        // Animate only the right arm (hanging arm)
        // Arms swing front to back (rotation around Z axis)
        rightArm.upper.rotation.z = leftLegAngle * 0.5;
        
        // Slight forearm movement for right arm
        rightArm.forearm.rotation.x = Math.max(0, leftLegAngle * 0.2);
        
        // Add a slight shoulder rotation for more natural movement (right arm only)
        rightArm.upper.rotation.y = leftLegAngle * 0.1;
        
        // Left arm remains steady for aiming (no animation)
    } else {
        // Gradually return legs to neutral position when not moving
        leftLeg.thigh.rotation.x *= 0.8;
        rightLeg.thigh.rotation.x *= 0.8;
        leftLeg.calf.rotation.x *= 0.8;
        rightLeg.calf.rotation.x *= 0.8;
        
        // Gradually return right arm to neutral position
        rightArm.upper.rotation.z *= 0.8;
        rightArm.upper.rotation.y *= 0.8;
        rightArm.forearm.rotation.x *= 0.8;
        
        // Left arm remains in aiming position
    }
}

// Update player movement and animation
function updatePlayerMovement(player, input, gameState, deltaTime, raycaster, groundPlane, groundIntersectPoint, flashlight, isTyping = false) {
    // Calculate movement direction based on keys
    let moveX = 0;
    let moveZ = 0;
    
    // Don't move if typing in chat
    if (!isTyping) {
        if (input.keys.w) moveZ -= 1;
        if (input.keys.s) moveZ += 1;
        if (input.keys.a) moveX -= 1;
        if (input.keys.d) moveX += 1;
    }
    
    // Check if player is moving
    const isMoving = (moveX !== 0 || moveZ !== 0);
    
    // Animate player legs
    animatePlayerLegs(player, isMoving, deltaTime, input.keys.shift && !isTyping);
    
    // Normalize movement vector if moving diagonally
    if (moveX !== 0 && moveZ !== 0) {
        const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX /= length;
        moveZ /= length;
    }
    
    // Apply movement speed
    let speed = PLAYER_SPEED;
    // Only allow sprinting if there's stamina available and not typing
    if (input.keys.shift && gameState.stamina > 0 && !isTyping) {
        speed *= PLAYER_SPRINT_MULTIPLIER;
    }
    
    // Update player position
    player.position.x += moveX * speed;
    player.position.z += moveZ * speed;
    
    // Calculate direction from player to mouse position on ground
    raycaster.setFromCamera(input.mousePosition, flashlight.camera);
    raycaster.ray.intersectPlane(groundPlane, groundIntersectPoint);
    
    // Calculate direction vector
    const direction = new THREE.Vector3()
        .subVectors(groundIntersectPoint, player.position)
        .normalize();
    
    // Rotate player to face mouse direction (only on Y axis)
    if (direction.x !== 0 || direction.z !== 0) {
        player.rotation.y = Math.atan2(direction.x, direction.z);
    }

    sendPlayerUpdate(player);
    
    return direction;
}

export {
    PLAYER_SPEED,
    PLAYER_SPRINT_MULTIPLIER,
    createPlayer,
    initializePlayer,
    animatePlayerLegs,
    updatePlayerMovement
}; 