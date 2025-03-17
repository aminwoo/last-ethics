/**
 * Sound Manager for the game
 * Handles loading, playing, and managing all game audio
 */

// Create audio context lazily to avoid automatic creation
let audioContext = null;

// Sound categories
const SOUND_CATEGORIES = {
  WEAPONS: 'weapons',
  AMBIENT: 'ambient',
  UI: 'ui',
  PLAYER: 'player',
  ENEMIES: 'enemies'
};

// Master volume controls
const masterVolume = {
  master: 1.0,
  [SOUND_CATEGORIES.WEAPONS]: 1.0,
  [SOUND_CATEGORIES.AMBIENT]: 0.8,
  [SOUND_CATEGORIES.UI]: 1.0,
  [SOUND_CATEGORIES.PLAYER]: 1.0,
  [SOUND_CATEGORIES.ENEMIES]: 1.0
};

// Function to safely create and initialize the AudioContext
function getAudioContext() {
  if (!audioContext) {
    // Create new AudioContext when it's first needed
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

// Sound definitions with metadata
const SOUNDS = {
  // Weapon sounds
  PISTOL_SHOT: {
    url: '/sounds/pistol.mp3',
    volume: 0.7,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },
  SHOTGUN_SHOT: {
    url: '/sounds/shotgun.mp3',
    volume: 0.8,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },
  SMG_SHOT: {
    url: '/sounds/smg.mp3',
    volume: 1.0,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },
  TURRET_SHOT: {
    url: '/sounds/smg.mp3',
    volume: 0.1,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },
  RELOAD: {
    url: '/sounds/reload.mp3',
    volume: 1.0,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },

  HURT: {
    url: '/sounds/hurt.mp3',
    volume: 1.0,
    category: SOUND_CATEGORIES.PLAYER,
    loop: false
  },
  PLAYER_DEATH: {
    url: '/sounds/731506__soundbitersfx__npcplayer-death-groans-male(1)-[AudioTrimmer.com].wav',
    volume: 1.0,
    category: SOUND_CATEGORIES.PLAYER,
    loop: false
  },
  EMPTY_CLIP: {
    url: '/sounds/empty_clip.wav',
    volume: 1.0,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },

  THUNDER: {
    url: '/sounds/thunder.mp3',
    volume: 0.3,
    category: SOUND_CATEGORIES.AMBIENT,
    loop: false
  },
  RAIN: {
    url: '/sounds/rain.wav',
    volume: 0.7,
    category: SOUND_CATEGORIES.AMBIENT,
    loop: true,
    useWebAudio: true,
    loopStart: 0.0,
    crossfadeDuration: 0.5
  },
};

// Storage for loaded sounds
const loadedSounds = {};
const activeLoops = {};
let isInitialized = false;
let isInitializing = false;
let initializationPromise = null;

/**
 * Initialize the sound system
 * @returns {Promise} A promise that resolves when the sound system is initialized
 */
async function initSoundSystem() {
  if (isInitializing) {
    return initializationPromise;
  }
  
  isInitializing = true;
  initializationPromise = new Promise(async (resolve, reject) => {
    try {
      // Create audio context if needed
      if (!audioContext) {
        getAudioContext();
      }
      
      // Resume audio context if needed
      if (audioContext.state !== 'running') {
        await audioContext.resume();
      }
      
      // Now load all the sounds
      await Promise.all(Object.keys(SOUNDS).map(soundId => loadSound(soundId)));
      
      isInitialized = true;
      isInitializing = false;
      resolve();
    } catch (error) {
      isInitializing = false;
      reject(error);
    }
  });
  
  return initializationPromise;
}

/**
 * Load a sound
 * @param {string} soundId - The ID of the sound to load
 * @returns {Promise} A promise that resolves when the sound is loaded
 */
async function loadSound(soundId) {
  // If sound is already loaded, return
  if (loadedSounds[soundId]) {
    return;
  }
  
  // Get sound definition
  const soundDef = SOUNDS[soundId];
  if (!soundDef) {
    throw new Error(`Sound definition not found for ${soundId}`);
  }
  
  try {
    let sound;
    
    // Load sound based on strategy
    if (soundDef.useWebAudio) {
      sound = await loadWebAudioSound(soundDef.url);
    } else {
      sound = await loadHtmlAudioSound(soundDef.url);
    }
    
    // Store loaded sound with its properties
    loadedSounds[soundId] = {
      ...sound,
      ...soundDef
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Play a sound
 * @param {string} soundId - The ID of the sound to play
 * @param {Object} options - Optional parameters
 * @returns {Object|Promise} - Control object for the sound or a Promise that resolves to one
 */
async function playSound(soundId, options = {}) {
  // Ensure the sound system is initialized
  if (!isInitialized) {
    await initSoundSystem();
  }
  
  const sound = loadedSounds[soundId];
  if (!sound) {
    return null;
  }
  
  // Calculate effective volume
  const effectiveVolume = (options.volume || sound.volume) * 
                          masterVolume[sound.category] * 
                          masterVolume.master;
  
  if (sound.useWebAudio) {
    // Play using Web Audio API
    return playWebAudioSound(sound, effectiveVolume, options);
  } else {
    // Play using HTML5 Audio
    return playHtmlAudioSound(sound, effectiveVolume, options);
  }
}

/**
 * Play a sound using HTML5 Audio
 */
function playHtmlAudioSound(sound, volume, options = {}) {
  // Clone the audio element for overlapping sounds
  const audioElement = sound.audio.cloneNode();
  audioElement.volume = volume;
  
  if (options.loop !== undefined) {
    audioElement.loop = options.loop;
  }
  
  // Reset to beginning if specified
  if (options.resetTime) {
    audioElement.currentTime = 0;
  }
  
  // Play the sound
  const playPromise = audioElement.play();
  
  // Handle play promise (required for Chrome)
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      // Handle error
    });
  }
  
  // Return control object
  return {
    stop: () => {
      audioElement.pause();
      audioElement.currentTime = 0;
    },
    pause: () => audioElement.pause(),
    resume: () => audioElement.play(),
    setVolume: (newVolume) => {
      audioElement.volume = newVolume * masterVolume[sound.category] * masterVolume.master;
    }
  };
}

/**
 * Play a sound using Web Audio API (for advanced features)
 */
function playWebAudioSound(sound, volume, options = {}) {
  const source = getAudioContext().createBufferSource();
  source.buffer = sound.buffer;
  source.loop = options.loop !== undefined ? options.loop : sound.loop;
  
  // Create gain node for volume control
  const gainNode = getAudioContext().createGain();
  gainNode.gain.value = volume;
  
  // Connect nodes
  source.connect(gainNode);
  gainNode.connect(getAudioContext().destination);
  
  // Start playback
  if (options.startTime !== undefined) {
    source.start(options.startTime, options.offset || 0);
  } else {
    source.start(0, options.offset || 0);
  }
  
  // For looping ambient sounds with crossfade
  if (sound.loop && sound.crossfadeDuration) {
    setupLoopWithCrossfade(sound, source, gainNode, volume);
  }
  
  // Return control object
  return {
    stop: () => {
      try {
        source.stop();
      } catch (e) {
        // Source might already be stopped
      }
    },
    setVolume: (newVolume) => {
      gainNode.gain.value = newVolume * masterVolume[sound.category] * masterVolume.master;
    }
  };
}

/**
 * Setup looping with crossfade for ambient sounds
 */
function setupLoopWithCrossfade(sound, source, gainNode, volume) {
  const loopEnd = sound.buffer.duration - 1.0;
  const loopLength = loopEnd - (sound.loopStart || 0);
  const nextTime = getAudioContext().currentTime + loopLength;
  
  // Store in active loops
  const loopId = Date.now().toString();
  activeLoops[loopId] = { sound, source, gainNode };
  
  // Schedule next loop
  setTimeout(() => {
    if (activeLoops[loopId]) { // Check if loop is still active
      scheduleNextLoop(sound, nextTime - sound.crossfadeDuration, volume, loopId);
    }
  }, (loopLength - sound.crossfadeDuration) * 1000);
  
  return loopId;
}

/**
 * Schedule the next loop iteration with crossfade
 */
function scheduleNextLoop(sound, startTime, volume, loopId) {
  const source = getAudioContext().createBufferSource();
  source.buffer = sound.buffer;
  
  const gainNode = getAudioContext().createGain();
  gainNode.gain.value = volume;
  
  source.connect(gainNode);
  gainNode.connect(getAudioContext().destination);
  
  source.start(startTime, sound.loopStart || 0);
  
  // Update active loop
  activeLoops[loopId] = { sound, source, gainNode };
  
  const loopLength = (sound.buffer.duration - 1.0) - (sound.loopStart || 0);
  
  // Schedule next loop
  setTimeout(() => {
    if (activeLoops[loopId]) { // Check if loop is still active
      scheduleNextLoop(sound, startTime + loopLength - sound.crossfadeDuration, volume, loopId);
    }
  }, (loopLength - sound.crossfadeDuration) * 1000);
}

/**
 * Stop a looping sound
 */
function stopLoop(loopId) {
  if (activeLoops[loopId]) {
    try {
      activeLoops[loopId].source.stop();
    } catch (e) {
      // Source might already be stopped
    }
    delete activeLoops[loopId];
  }
}

/**
 * Set volume for a category of sounds
 */
function setCategoryVolume(category, volume) {
  if (volume < 0) volume = 0;
  if (volume > 1) volume = 1;
  
  masterVolume[category] = volume;
}

/**
 * Set master volume
 */
function setMasterVolume(volume) {
  if (volume < 0) volume = 0;
  if (volume > 1) volume = 1;
  
  masterVolume.master = volume;
}

/**
 * Convenience methods for common sound actions
 */
const SoundManager = {
  // Core methods
  init: initSoundSystem,
  play: playSound,
  stopLoop,
  setCategoryVolume,
  setMasterVolume,
  
  // Weapon sound shortcuts
  playPistolShot: () => playSound('PISTOL_SHOT', { resetTime: true }),
  playShotgunShot: () => playSound('SHOTGUN_SHOT', { resetTime: true }),
  playSmgShot: () => playSound('SMG_SHOT', { resetTime: true }),
  stopSmgSound: () => {
    console.log('Directly stopping SMG sound from SoundManager');
    // Stop any SMG sound that might be playing
    // Traverse all active loops and stop any that are SMG_SHOT
    Object.keys(activeLoops).forEach(loopId => {
      if (activeLoops[loopId] && activeLoops[loopId].sound && 
          activeLoops[loopId].sound.url === SOUNDS.SMG_SHOT.url) {
        console.log('Found SMG sound to stop:', loopId);
        try {
          activeLoops[loopId].source.stop();
        } catch (e) {
          console.warn('Error stopping sound:', e);
        }
        delete activeLoops[loopId];
      }
    });
    
    // Try directly stopping the sound by ID as a fallback
    stopLoop('SMG_SHOT');
  },
  playTurretShot: () => playSound('TURRET_SHOT', { resetTime: true }),
  playReload: () => playSound('RELOAD', { resetTime: true }),
  playEmptyClip: () => playSound('EMPTY_CLIP', { resetTime: true }),
  
  // Player sound shortcuts
  playPlayerHit: () => playSound('HURT', { resetTime: true }),
  playPlayerDeath: () => playSound('PLAYER_DEATH', { resetTime: true }),
  
  // Ambient sound shortcuts
  playRainAmbience: async () => {
    // First ensure the sound system is initialized (creates AudioContext after user interaction)
    await initSoundSystem();
    return playSound('RAIN');
  },
  playThunder: () => playSound('THUNDER'),

  // Categories for volume control
  categories: SOUND_CATEGORIES
};

// Export the sound manager
export default SoundManager;