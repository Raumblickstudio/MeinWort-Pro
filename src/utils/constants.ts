// App Configuration
export const APP_CONFIG = {
  name: 'MeinWort Pro',
  version: '0.1.0',
  overlay: {
    width: 200,
    height: 100,
    defaultPosition: { x: 1720, y: 50 },
  },
} as const;

// Hotkey Constants
export const DEFAULT_HOTKEYS = {
  toggleRecording: 'F9',
  stopRecording: 'Escape',
} as const;

// Audio Configuration
export const AUDIO_CONFIG = {
  sampleRate: 44100,
  channels: 1,
  bitDepth: 16,
  maxDuration: 300, // 5 minutes max
} as const;

// API Configuration
export const API_CONFIG = {
  whisper: {
    model: 'whisper-1',
    language: 'de', // German by default
    maxFileSize: 25 * 1024 * 1024, // 25MB
  },
} as const;