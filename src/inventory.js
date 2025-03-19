// Inventory management for the game
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Initial items for the player's inventory
const INITIAL_ITEMS = [
    {
        id: 'pistol',
        name: 'Pistol',
        description: 'A powerful and elegant handgun with ornate engravings.',
        image: '/images/GUN_01_[square_frame]_01_V1.00.png',
        modelPath: '/models/drakefire_pistol.glb',
        type: 'weapon',
        slot: 0
    },
    {
        id: 'sniper',
        name: 'Sniper Rifle',
        description: 'A powerful and elegant handgun with ornate engravings.',
        image: '/images/[design]_Sniper_rifle_[KAR98]_V1.00.png',
        modelPath: '/models/sniper_rifle.glb',
        type: 'weapon',
        slot: 1
    },
    {
        id: 'shotgun',
        name: 'Shotgun',
        description: 'A powerful and elegant handgun with ornate engravings.',
        image: '/images/[design]Shotgun_V1.02.png',
        modelPath: '/models/m1014_tactical_automatic_shotgun.glb',
        type: 'weapon',
        slot: 2
    },
    {
        id: 'ramen',
        name: 'Ramen',
        description: 'A powerful and elegant handgun with ornate engravings.',
        image: '/images/ramen.webp',
        modelPath: '/models/ramen_bowl.glb',
        type: 'food',
        slot: 3
    }
];

// Initialize inventory system
function initializeInventory() {
    const inventoryElement = document.getElementById('inventory-overlay');
    const inventorySlots = document.querySelectorAll('.inventory-slot');
    const itemPreview = document.getElementById('item-preview');
    const itemName = document.getElementById('item-name');
    const itemDescription = document.getElementById('item-description');
    
    // Set up inventory data structure
    const inventory = {
        // UI elements
        element: inventoryElement,
        slots: inventorySlots,
        itemPreview,
        itemName,
        itemDescription,
        
        // Inventory state
        isOpen: false,
        items: [],
        selectedItemIndex: -1, // No item selected initially
        
        // Preview scene for 3D models
        previewScene: null,
        previewCamera: null,
        previewRenderer: null,
        previewObject: null,
        
        // Methods will be attached below
        toggle: null,
        addItem: null,
        selectItem: null,
        setupPreviewRenderer: null,
        showItemModel: null
    };
    
    // Setup 3D preview renderer
    setupPreviewRenderer(inventory);
    
    // Add initial items to inventory
    INITIAL_ITEMS.forEach(item => {
        addItem(inventory, item);
    });
    
    // Add click event listeners to slots
    inventorySlots.forEach(slot => {
        slot.addEventListener('click', () => {
            const slotIndex = parseInt(slot.getAttribute('data-slot'));
            selectItem(inventory, slotIndex);
        });
    });
    
    // Attach methods to the inventory object
    return attachMethods(inventory);
}

// Toggle inventory visibility
function toggleInventory(inventory, inputState) {
    inventory.isOpen = !inventory.isOpen;
    
    // Set input disabled state if inputState is provided
    if (inputState) {
        // When inventory is open, disable shooting but allow movement
        inputState.mouseDown = false; // Reset mouse state to prevent continuous firing
        
        // Partially disable input - only disable shooting in inventory
        if (inventory.isOpen) {
            // Allow 'i' key to close inventory
            // But disable mouse button actions while inventory is open
            inputState.inventoryModifier = true; // Flag to indicate inventory mode
        } else {
            // Fully re-enable input when closing inventory
            inputState.inventoryModifier = false;
        }
    }
    
    if (inventory.isOpen) {
        // Show inventory
        inventory.element.style.display = 'flex';
        
        // Reset the model state to ensure it reloads properly
        if (inventory.previewObject) {
            // Properly dispose of the existing model
            if (inventory.previewObject.traverse) {
                inventory.previewObject.traverse(child => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(material => material.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                });
            }
            inventory.previewScene.remove(inventory.previewObject);
            inventory.previewObject = null;
        }
        
        // If there's a selected item, update the preview
        if (inventory.selectedItemIndex !== -1) {
            // Get the previously selected item and force reload it
            const selectedItem = inventory.items.find(i => i.slot === inventory.selectedItemIndex);
            if (selectedItem) {
                // Clear preview container before reloading
                if (inventory.itemPreview) {
                    inventory.itemPreview.innerHTML = '';
                }
                
                // Force a brief delay before loading the model to ensure clean state
                setTimeout(() => {
                    selectItem(inventory, inventory.selectedItemIndex);
                }, 50);
            } else {
                selectItem(inventory, inventory.selectedItemIndex);
            }
        }
        
        // Reset lastRenderTime to prevent frame skipping
        inventory.lastRenderTime = 0;
    } else {
        // Hide inventory
        inventory.element.style.display = 'none';
        
        // Cancel animations to free up resources
        if (inventory.previewAnimationFrame) {
            cancelAnimationFrame(inventory.previewAnimationFrame);
            inventory.previewAnimationFrame = null;
        }
        
        if (inventory.imageAnimationFrame) {
            cancelAnimationFrame(inventory.imageAnimationFrame);
            inventory.imageAnimationFrame = null;
        }
    }
}

// Add an item to the inventory
function addItem(inventory, item) {
    // Check if slot is already taken
    const existingItemIndex = inventory.items.findIndex(i => i.slot === item.slot);
    if (existingItemIndex !== -1) {
        // Remove existing item in this slot
        inventory.items.splice(existingItemIndex, 1);
    }
    
    // Add item to inventory
    inventory.items.push(item);
    
    // Update slot UI
    const slot = inventory.slots[item.slot];
    if (slot) {
        // Clear existing content
        slot.innerHTML = '';
        
        // Create image element
        const img = document.createElement('img');
        img.src = item.image;
        img.alt = item.name;
        slot.appendChild(img);
        
        // Add data attributes for easier access
        slot.setAttribute('data-item-id', item.id);
        slot.setAttribute('data-item-name', item.name);
    }
}

// Select an item in the inventory
function selectItem(inventory, slotIndex) {
    // Find item at this slot
    const item = inventory.items.find(i => i.slot === slotIndex);
    
    // Clear existing selection
    inventory.slots.forEach(slot => {
        slot.classList.remove('selected');
    });
    
    // Cancel any existing image animation
    if (inventory.imageAnimationFrame) {
        cancelAnimationFrame(inventory.imageAnimationFrame);
        inventory.imageAnimationFrame = null;
    }
    
    // If no item in this slot, clear selection
    if (!item) {
        inventory.selectedItemIndex = -1;
        inventory.itemName.textContent = 'No item selected';
        inventory.itemDescription.textContent = 'Select an item to view details';
        
        // Clear preview
        inventory.itemPreview.innerHTML = '';
        if (inventory.previewObject) {
            inventory.previewScene.remove(inventory.previewObject);
            inventory.previewObject = null;
        }
        return;
    }
    
    // Update selection
    inventory.selectedItemIndex = slotIndex;
    inventory.slots[slotIndex].classList.add('selected');
    
    // Update item details
    inventory.itemName.textContent = item.name;
    inventory.itemDescription.textContent = item.description;
    
    // Show item model
    showItemModel(inventory, item);
}

// Setup 3D preview renderer
function setupPreviewRenderer(inventory) {
    // Create scene, camera and renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1930);
    
    // Create a camera with better perspective for weapon models
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(0, 0.2, 2.5);
    camera.lookAt(0, 0, 0);
    
    // Simplified lighting for better performance
    // Single ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.8);
    scene.add(ambientLight);
    
    // Single directional light for highlights
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(1, 1, 2);
    scene.add(mainLight);
    
    // Store references
    inventory.previewScene = scene;
    inventory.previewCamera = camera;
    
    // Setup parameters for limiting framerate of inventory preview
    inventory.lastRenderTime = 0;
    inventory.targetFPS = 30; // Limit to 30 FPS for better performance
    inventory.renderInterval = 1000 / inventory.targetFPS;
}

// Show item 3D model in the preview panel
function showItemModel(inventory, item) {
    // Clear existing preview
    if (inventory.previewObject) {
        // Properly dispose of geometry and materials to prevent memory leaks
        if (inventory.previewObject.traverse) {
            inventory.previewObject.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => material.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }
        inventory.previewScene.remove(inventory.previewObject);
        inventory.previewObject = null;
    }
    
    // Clear the preview container
    inventory.itemPreview.innerHTML = '';
    
    // If no renderer, create it
    if (!inventory.previewRenderer) {
        const renderer = new THREE.WebGLRenderer({ 
            antialias: false, 
            powerPreference: 'low-power',
            alpha: true 
        });
        renderer.setSize(inventory.itemPreview.clientWidth, inventory.itemPreview.clientHeight);
        renderer.setClearColor(0x000000, 0);
        inventory.itemPreview.appendChild(renderer.domElement);
        inventory.previewRenderer = renderer;
        
        // Add mouse control for rotation
        setupMouseRotation(inventory);
    } else {
        // Update renderer size for larger preview
        inventory.previewRenderer.setSize(inventory.itemPreview.clientWidth, inventory.itemPreview.clientHeight);
        // Re-append the renderer to the preview container
        inventory.itemPreview.appendChild(inventory.previewRenderer.domElement);
    }
    
    // Show loading indicator
    const loadingDiv = document.createElement('div');
    loadingDiv.style.position = 'absolute';
    loadingDiv.style.top = '50%';
    loadingDiv.style.left = '50%';
    loadingDiv.style.transform = 'translate(-50%, -50%)';
    loadingDiv.style.color = '#00ccff';
    loadingDiv.style.fontFamily = "'Orbitron', sans-serif";
    loadingDiv.style.fontSize = '14px';
    loadingDiv.style.textAlign = 'center';
    loadingDiv.style.zIndex = '10';
    loadingDiv.textContent = 'Loading model...';
    inventory.itemPreview.appendChild(loadingDiv);
    
    // If item has a model, load it
    if (item.modelPath) {
        // Create a new loader each time to ensure a fresh load
        const loader = new GLTFLoader();
        
        // Add a cache-busting parameter to force a fresh load
        const cacheBustUrl = item.modelPath + (item.modelPath.includes('?') ? '&' : '?') + 'ts=' + Date.now();
        
        // Load the GLTF/GLB model with reduced quality for performance
        loader.load(
            cacheBustUrl, 
            // On successful load
            (gltf) => {
                // Remove loading indicator
                if (loadingDiv.parentNode) {
                    loadingDiv.parentNode.removeChild(loadingDiv);
                }
                
                // Remove unnecessary animations or components that affect performance
                if (gltf.animations && gltf.animations.length > 0) {
                    gltf.animations = []; // We're doing our own animation, so remove these
                }
                
                const model = gltf.scene;
                
                // Simplify materials for better performance
                model.traverse(child => {
                    if (child.isMesh) {
                        // Use simple lambert material for better performance
                        const color = child.material.color ? child.material.color.clone() : new THREE.Color(0xcccccc);
                        const simpleMaterial = new THREE.MeshLambertMaterial({ 
                            color: color,
                            map: child.material.map || null
                        });
                        child.material = simpleMaterial;
                    }
                });
                
                // Center and scale the model
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                
                // Center the model
                model.position.x = -center.x;
                model.position.y = -center.y;
                model.position.z = -center.z;
                
                // Apply weapon-specific adjustments for optimal viewing
                const weaponAdjustments = {
                    // Default adjustments for all weapons if specific ones aren't defined
                    default: {
                        rotation: { x: 0, y: Math.PI / 4, z: 0 },
                        position: { x: 0.8, y: 1.5, z: 0 },
                        // Define a consistent target size for all weapons
                        targetLength: 1.75, // Fixed target length for all weapons
                        targetScale: 1.0    // Base scale factor (multiplier)
                    },
                    // Pistol-specific adjustments
                    pistol: {
                        rotation: { x: 0, y: Math.PI / 2, z: 0 },
                        position: { x: 0.1, y: 0, z: 0 },
                        targetLength: 1.75,
                        targetScale: 1.0  // Pistols need a larger scale factor since they're smaller
                    },
                    // Sniper rifle adjustments
                    sniper: {
                        rotation: { x: 0, y: Math.PI / 2, z: 0 },
                        position: { x: -0.1, y: 0, z: 0 },
                        targetLength: 1.75,
                        targetScale: 1.0  // Rifles need a smaller scale factor since they're longer
                    },
                    // Shotgun adjustments
                    shotgun: {
                        rotation: { x: 0, y: 0, z: 0 },
                        position: { x: -0.2, y: 0, z: 0 },
                        targetLength: 1.75,
                        targetScale: 1.0  // Shotguns sized in between pistols and rifles
                    },
                    // Ramen adjustments
                    ramen: {
                        rotation: { x: Math.PI / 8, y: Math.PI / 4, z: 0 },
                        position: { x: 0.8, y: 1.5, z: 0 },
                        targetLength: 1.75,
                        targetScale: 1.0  // Ramen needs a smaller scale factor since it's a bowl
                    }
                };
                
                // Determine which adjustment to use
                let adjustment;
                if (item.id === 'pistol' || item.id === 'drakefire_pistol') {
                    adjustment = weaponAdjustments.pistol;
                } else if (item.id === 'sniper') {
                    adjustment = weaponAdjustments.sniper;
                } else if (item.id === 'shotgun') {
                    adjustment = weaponAdjustments.shotgun;
                } else if (item.id === 'ramen') {
                    adjustment = weaponAdjustments.ramen;
                } else {
                    adjustment = weaponAdjustments.default;
                }
                
                // Apply rotation adjustments
                model.rotation.x = adjustment.rotation.x;
                model.rotation.y = adjustment.rotation.y;
                model.rotation.z = adjustment.rotation.z;
                
                // Store the initial rotation for the mouse rotation
                inventory.initialModelRotation = {
                    x: model.rotation.x,
                    y: model.rotation.y,
                    z: model.rotation.z
                };
                
                // Apply position adjustments
                model.position.x += adjustment.position.x;
                model.position.y += adjustment.position.y;
                model.position.z += adjustment.position.z;
                
                // Store the base position Y for the slight hover effect
                inventory.basePositionY = model.position.y;

                const modelLength = Math.max(size.x, size.z); // Typically this is the "length" of the weapon
                
                // Apply scale to reach target length, adjusted by the weapon-specific scale factor
                const scale = (adjustment.targetLength / modelLength) * adjustment.targetScale;
                model.scale.set(scale, scale, scale);
                
                // Debug - uncomment to log size information for each weapon
                console.log(`Weapon type: ${item.id}`);
                console.log(`Dimensions: width=${size.x.toFixed(2)}, height=${size.y.toFixed(2)}, depth=${size.z.toFixed(2)}`);
                console.log(`Scale factor: ${scale.toFixed(3)}`);
                
                // Add to scene
                inventory.previewScene.add(model);
                inventory.previewObject = model;
                
                // Reset animation start time for smooth animation
                inventory.animationStartTime = Date.now();
                inventory.lastRenderTime = 0; // Reset frame limiting
                
                // Start render loop (no longer for animation, just for rendering)
                renderPreview(inventory);
                
                // Add extended descriptions for weapons with more accurate details
                if (item.id === 'pistol' || item.id === 'drakefire_pistol') {
                    inventory.itemDescription.textContent = "Ornate handgun. High accuracy, medium damage.";
                } else if (item.id === 'sniper') {
                    inventory.itemDescription.textContent = "Long-range precision rifle. Maximum damage at distance.";
                } else if (item.id === 'shotgun') {
                    inventory.itemDescription.textContent = "Close-range spread weapon. Devastating against groups.";
                } else if (item.id === 'ramen') {
                    inventory.itemDescription.textContent = "Delicious noodle soup. Restores health and stamina.";
                }
            },
            
            // On progress
            (xhr) => {
                const percentComplete = xhr.loaded / xhr.total * 100;
                loadingDiv.textContent = `Loading: ${Math.round(percentComplete)}%`;
            }
        );
    }
}

// Setup mouse rotation for the model
function setupMouseRotation(inventory) {
    // Store mouse interaction state
    inventory.mouseInteraction = {
        isDragging: false,
        previousMousePosition: { x: 0, y: 0 },
        rotationSpeed: 0.01
    };
    
    // Only attach these listeners once
    if (!inventory.mouseListenersAttached) {
        const renderer = inventory.previewRenderer;
        
        // Add pointer cursor to indicate it's interactive
        renderer.domElement.style.cursor = 'grab';
        
        // Add mouse event listener to start dragging (only on the preview element)
        renderer.domElement.addEventListener('mousedown', (event) => {
            if (inventory.previewObject) {
                inventory.mouseInteraction.isDragging = true;
                renderer.domElement.style.cursor = 'grabbing';
                inventory.mouseInteraction.previousMousePosition = {
                    x: event.clientX,
                    y: event.clientY
                };
                
                // Prevent text selection when dragging
                event.preventDefault();
            }
        });
        
        // Add mouse move listener to document so it captures movement outside the preview
        document.addEventListener('mousemove', (event) => {
            if (inventory.mouseInteraction.isDragging && inventory.previewObject) {
                const deltaMove = {
                    x: event.clientX - inventory.mouseInteraction.previousMousePosition.x,
                    y: event.clientY - inventory.mouseInteraction.previousMousePosition.y
                };
                
                // Update the rotation based on mouse movement
                inventory.previewObject.rotation.y += deltaMove.x * inventory.mouseInteraction.rotationSpeed;
                inventory.previewObject.rotation.x += deltaMove.y * inventory.mouseInteraction.rotationSpeed;
                
                // Limit vertical rotation to prevent flipping
                inventory.previewObject.rotation.x = Math.max(
                    -Math.PI / 2, 
                    Math.min(Math.PI / 2, inventory.previewObject.rotation.x)
                );
                
                // Store the new position
                inventory.mouseInteraction.previousMousePosition = {
                    x: event.clientX,
                    y: event.clientY
                };
                
                // Render the scene with the updated rotation
                inventory.previewRenderer.render(inventory.previewScene, inventory.previewCamera);
            }
        });
        
        // Handle mouse up on document level to catch release outside preview
        const endDrag = () => {
            if (inventory.mouseInteraction.isDragging) {
                inventory.mouseInteraction.isDragging = false;
                renderer.domElement.style.cursor = 'grab';
            }
        };
        
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('mouseleave', endDrag); // For when mouse leaves the window
        
        // Add touch support for mobile
        renderer.domElement.addEventListener('touchstart', (event) => {
            if (inventory.previewObject && event.touches.length === 1) {
                inventory.mouseInteraction.isDragging = true;
                inventory.mouseInteraction.previousMousePosition = {
                    x: event.touches[0].clientX,
                    y: event.touches[0].clientY
                };
                event.preventDefault(); // Prevent scrolling
            }
        });
        
        // Add touch move listener to document for the same reason
        document.addEventListener('touchmove', (event) => {
            if (inventory.mouseInteraction.isDragging && inventory.previewObject && event.touches.length === 1) {
                const deltaMove = {
                    x: event.touches[0].clientX - inventory.mouseInteraction.previousMousePosition.x,
                    y: event.touches[0].clientY - inventory.mouseInteraction.previousMousePosition.y
                };
                
                // Update rotation based on touch movement
                inventory.previewObject.rotation.y += deltaMove.x * inventory.mouseInteraction.rotationSpeed;
                inventory.previewObject.rotation.x += deltaMove.y * inventory.mouseInteraction.rotationSpeed;
                
                // Limit vertical rotation
                inventory.previewObject.rotation.x = Math.max(
                    -Math.PI / 2, 
                    Math.min(Math.PI / 2, inventory.previewObject.rotation.x)
                );
                
                // Store the new position
                inventory.mouseInteraction.previousMousePosition = {
                    x: event.touches[0].clientX,
                    y: event.touches[0].clientY
                };
                
                // Prevent scrolling
                event.preventDefault();
                
                // Render the scene
                inventory.previewRenderer.render(inventory.previewScene, inventory.previewCamera);
            }
        }, { passive: false });
        
        document.addEventListener('touchend', () => {
            inventory.mouseInteraction.isDragging = false;
        });
        
        inventory.mouseListenersAttached = true;
    }
}

// Render the preview with a subtle floating effect (replaces animatePreview)
function renderPreview(inventory) {
    // Cancel any existing animation frame to prevent duplicates
    if (inventory.previewAnimationFrame) {
        cancelAnimationFrame(inventory.previewAnimationFrame);
        inventory.previewAnimationFrame = null;
    }
    
    // For tracking time
    if (!inventory.animationStartTime) {
        inventory.animationStartTime = Date.now();
    }
    
    const currentTime = Date.now();
    
    // Only render if sufficient time has passed (frame limiting)
    if (currentTime - inventory.lastRenderTime < inventory.renderInterval) {
        // Schedule next frame without rendering
        inventory.previewAnimationFrame = requestAnimationFrame(() => {
            renderPreview(inventory);
        });
        return;
    }
    
    // Update last render time
    inventory.lastRenderTime = currentTime;
    
    // Calculate elapsed time for smooth animation
    const elapsedTime = (currentTime - inventory.animationStartTime) / 1000;
    
    // Set up next animation frame
    inventory.previewAnimationFrame = requestAnimationFrame(() => {
        // Only continue animation if inventory is still open
        if (inventory.isOpen) {
            renderPreview(inventory);
        }
    });
    
    // Skip if object doesn't exist yet
    if (!inventory.previewObject) {
        return;
    }
    
    // Only apply subtle floating effect (no rotation)
    if (inventory.previewObject && inventory.basePositionY !== undefined) {
        // Just a slight up and down floating effect
        const yOffset = Math.sin(elapsedTime * 0.5) * 0.03;
        inventory.previewObject.position.y = inventory.basePositionY + yOffset;
    }
    
    // Render the scene
    if (inventory.previewRenderer) {
        try {
            inventory.previewRenderer.render(inventory.previewScene, inventory.previewCamera);
        } catch (e) {
            console.error('Error rendering inventory preview:', e);
        }
    }
}

// Attach methods to inventory object
function attachMethods(inventory) {
    // Store inputState reference to use in toggle method
    inventory.inputState = null;
    
    // Methods
    inventory.toggle = (inputState) => {
        // Update the stored inputState reference if provided
        if (inputState) {
            inventory.inputState = inputState;
        }
        toggleInventory(inventory, inventory.inputState);
    };
    inventory.addItem = (item) => addItem(inventory, item);
    inventory.selectItem = (slotIndex) => selectItem(inventory, slotIndex);
    inventory.setupPreviewRenderer = () => setupPreviewRenderer(inventory);
    inventory.showItemModel = (item) => showItemModel(inventory, item);
    return inventory;
}

// Export inventory functions
export {
    initializeInventory,
    toggleInventory,
    addItem,
    selectItem
}; 