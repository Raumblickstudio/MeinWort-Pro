// App Modes
export type AppMode = 'normal' | 'text-processing';

// Core App Types
export interface AppState {
  isRecording: boolean;
  isTranscribing: boolean;
  lastTranscription: string | null;
  error: string | null;
  mode: AppMode;
  clipboardText?: string | null;
  isProcessingText?: boolean;
  lastProcessedResult?: string | null; // Tracking für verarbeitete Ergebnisse
  lastProcessedTimestamp?: number | null; // Timestamp der letzten Verarbeitung
  isDetecting?: boolean; // Flag für laufende Text-Detection
}

// Recording Types
export interface AudioConfig {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

// API Types
export interface WhisperResponse {
  text: string;
  confidence?: number;
  language?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

// Hotkey Types
export type HotkeyAction = 'toggle-recording' | 'stop-recording' | 'clear-text';

export interface HotkeyConfig {
  key: string;
  action: HotkeyAction;
  enabled: boolean;
}