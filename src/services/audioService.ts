export interface AudioRecordingOptions {
  sampleRate?: number;
  channelCount?: number;
  bitDepth?: number;
}

export interface AudioRecording {
  blob: Blob;
  duration: number;
  url: string;
}

export class AudioService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;

  constructor(private options: AudioRecordingOptions = {}) {
    this.options = {
      sampleRate: 16000, // Whisper arbeitet optimal mit 16kHz
      channelCount: 1,   // Mono für bessere Whisper-Performance
      bitDepth: 16,
      ...options
    };
  }

  async requestPermission(): Promise<boolean> {
    try {
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      return permission.state === 'granted' || permission.state === 'prompt';
    } catch (error) {
      console.warn('Permission query not supported, trying direct access');
      return true;
    }
  }

  async startRecording(): Promise<void> {
    // Verbesserte Prüfung auf bereits laufende Aufnahme
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      console.log('⚠️ MediaRecorder bereits aktiv, stoppe vorherige Aufnahme');
      await this.stopRecording();
      // Kurz warten damit der Stop verarbeitet wird
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      // Mikrofon-Stream anfordern
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: this.options.channelCount,
          echoCancellation: false, // 🔊 MAX EMPFINDLICHKEIT: Alle Filter deaktiviert
          noiseSuppression: false, // 🔊 MAX EMPFINDLICHKEIT: Kein Noise-Filter
          autoGainControl: false,  // 🔊 MAX EMPFINDLICHKEIT: Kein Auto-Gain um leise Signale zu bewahren
          // 🔊 ERWEITERTE EMPFINDLICHKEIT: Browser-spezifische Constraints
          ...(navigator.mediaDevices.getSupportedConstraints().latency && { latency: 0.01 }),
          ...(navigator.mediaDevices.getSupportedConstraints().volume && { volume: 1.0 }),
        },
        video: false,
      });

      // MediaRecorder konfigurieren
      const options: MediaRecorderOptions = {};
      
      // Beste verfügbare Audio-Codecs für Whisper
      const preferredMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/wav',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];

      for (const mimeType of preferredMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          options.mimeType = mimeType;
          // 🔊 MAXIMUM EMPFINDLICHKEIT: Höchste Bitrate für maximale Audio-Qualität
          options.audioBitsPerSecond = 320000; // Maximum für Web Audio
          console.log(`🎤 Using audio codec: ${mimeType} @ 320kbps (MAXIMUM sensitivity for whisper speech)`);
          break;
        }
      }

      // 🔊 AUDIO-VERSTÄRKUNG: Gain auf Audio-Track anwenden für leise Sprache
      const audioTracks = this.stream.getAudioTracks();
      if (audioTracks.length > 0) {
        try {
          // Versuche Audio-Constraints zu erweitern für maximale Empfindlichkeit
          const audioTrack = audioTracks[0];
          const capabilities = audioTrack.getCapabilities();
          
          if (capabilities.volume) {
            await audioTrack.applyConstraints({
              volume: capabilities.volume.max || 1.0
            });
            console.log('🔊 Audio-Verstärkung aktiviert: Volume =', capabilities.volume.max || 1.0);
          }
        } catch (error) {
          console.log('ℹ️ Audio-Verstärkung nicht verfügbar:', error);
        }
      }

      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.chunks = [];
      this.startTime = Date.now();

      // Event Listeners
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.onstart = () => {
        console.log('🎤 Audio recording started');
      };

      this.mediaRecorder.onstop = () => {
        console.log('⏹️ Audio recording stopped');
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('❌ MediaRecorder error:', event);
        throw new Error('Fehler bei der Audioaufnahme');
      };

      // Aufnahme starten
      this.mediaRecorder.start(100); // Alle 100ms Daten sammeln

    } catch (error) {
      await this.cleanup();
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          throw new Error('Mikrofon-Berechtigung verweigert. Bitte erlauben Sie den Zugriff auf das Mikrofon.');
        } else if (error.name === 'NotFoundError') {
          throw new Error('Kein Mikrofon gefunden. Bitte schließen Sie ein Mikrofon an.');
        } else if (error.name === 'NotSupportedError') {
          throw new Error('Audioaufnahme wird von diesem Browser nicht unterstützt.');
        }
      }
      throw new Error(`Fehler beim Starten der Aufnahme: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`);
    }
  }

  async stopRecording(): Promise<AudioRecording> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        reject(new Error('Keine aktive Aufnahme gefunden'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const duration = Date.now() - this.startTime;
          
          if (this.chunks.length === 0) {
            throw new Error('Keine Audiodaten aufgezeichnet');
          }

          // Audio-Blob erstellen
          const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type: mimeType });
          
          if (blob.size === 0) {
            throw new Error('Leere Audiodatei aufgezeichnet');
          }

          // URL für Preview/Download erstellen
          const url = URL.createObjectURL(blob);

          const recording: AudioRecording = {
            blob,
            duration,
            url,
          };

          await this.cleanup();
          resolve(recording);

          console.log(`✅ Audio recorded: ${blob.size} bytes, ${duration}ms, ${mimeType}`);

        } catch (error) {
          await this.cleanup();
          reject(error);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  async cleanup(): Promise<void> {
    try {
      // MediaRecorder stoppen
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }

      // Stream beenden
      if (this.stream) {
        this.stream.getTracks().forEach(track => {
          track.stop();
        });
        this.stream = null;
      }

      this.mediaRecorder = null;
      this.chunks = [];

    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  // Utility: Blob zu File konvertieren (für Upload)
  static blobToFile(blob: Blob, filename: string = 'recording.webm'): File {
    return new File([blob], filename, { type: blob.type });
  }

  // Utility: Audio-Info extrahieren
  static async getAudioInfo(blob: Blob): Promise<{ duration: number; size: number; type: string }> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      const url = URL.createObjectURL(blob);
      
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve({
          duration: audio.duration * 1000, // in ms
          size: blob.size,
          type: blob.type,
        });
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Fehler beim Laden der Audio-Metadaten'));
      };
      
      audio.src = url;
    });
  }
}

// Singleton Instance
export const audioService = new AudioService();