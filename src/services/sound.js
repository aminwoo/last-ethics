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
  master: 0.5,
  [SOUND_CATEGORIES.WEAPONS]: 0.5,
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
    url: '/sounds/pistol_shot.mp3',
    volume: 0.2,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },
  SHOTGUN_SHOT: {
    url: '/sounds/shotgun_shot.mp3',
    volume: 0.3,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },
  AR_SHOT: {
    url: '/sounds/ak47_shot.mp3',
    volume: 0.5,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },
  RIFLE_SHOT: {
    url: '/sounds/rifle_shot.wav',
    volume: 0.5,
    category: SOUND_CATEGORIES.WEAPONS,
    loop: false
  },
  TURRET_SHOT: {
    url: '/sounds/pistol_shot.mp3',
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
    url: '/sounds/death.wav',
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
    volume: 0.1,
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
  
  // UI Sounds
  CLICK: {
    url: '/sounds/click.wav',
    volume: 0.5,
    category: SOUND_CATEGORIES.UI,
    loop: false
  },
};

// Storage for loaded sounds
const loadedSounds = {};
const activeLoops = {};
let isInitialized = false;
let initializationPromise = null;

/**
 * Initialize the sound system
 */
async function initSoundSystem() {
  // If already initializing, return the existing promise
  if (initializationPromise) {
    return initializationPromise;
  }
  
  // Create a new initialization promise
  initializationPromise = (async () => {
    try {
      // Resume audio context if it's suspended (needed for Chrome's autoplay policy)
      if (getAudioContext().state === 'suspended') {
        await getAudioContext().resume();
      }
      
      // Load all sounds
      const loadPromises = Object.entries(SOUNDS).map(([key, sound]) => {
        return loadSound(key, sound);
      });
      
      await Promise.all(loadPromises);
      console.log('Sound system initialized');
      isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize sound system:', error);
      throw error;
    }
  })();
  
  return initializationPromise;
}

/**
 * Load a sound into memory
 */
async function loadSound(soundId, soundDef) {
  try {
    if (soundDef.useWebAudio) {
      // Load using Web Audio API
      const response = await fetch(soundDef.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await getAudioContext().decodeAudioData(arrayBuffer);
      
      loadedSounds[soundId] = {
        buffer: audioBuffer,
        ...soundDef
      };
    } else {
      // Load using HTML5 Audio
      const audio = new Audio(soundDef.url);
      audio.volume = soundDef.volume * masterVolume[soundDef.category] * masterVolume.master;
      audio.loop = soundDef.loop;
      
      // Wait for the audio to be loaded
      await new Promise((resolve) => {
        audio.addEventListener('canplaythrough', resolve, { once: true });
        audio.load();
      });
      
      loadedSounds[soundId] = {
        audio,
        ...soundDef
      };
    }
    
    console.log(`Loaded sound: ${soundId}`);
  } catch (error) {
    console.error(`Failed to load sound ${soundId}:`, error);
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
      console.warn(`Error playing sound: ${error}`);
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
  playARShot: () => playSound('AR_SHOT', { resetTime: true }),
  playRifleShot: () => playSound('RIFLE_SHOT', { resetTime: true }),
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
  
  // UI sound shortcuts
  playSound: (soundId, volume = 1.0) => playSound(soundId, { volume }),

  // Categories for volume control
  categories: SOUND_CATEGORIES
};

// Export the sound manager
export default SoundManager;