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
  // ⚡ SPEED OPTIMIZATION: Pre-warmed stream für sofortigen Start
  private preWarmedStream: MediaStream | null = null;
  private isPreWarming: boolean = false;

  constructor(private options: AudioRecordingOptions = {}) {
    this.options = {
      sampleRate: 24000, // 🎧 QUALITÄT: 24kHz für bessere Sprachqualität (upgraded von 16kHz)
      channelCount: 1,   // Mono für bessere Whisper-Performance
      bitDepth: 16,
      ...options
    };
    
    // ⚡ SPEED OPTIMIZATION: Stream pre-warming im Hintergrund starten
    this.preWarmStream();
  }

  // ⚡ SPEED OPTIMIZATION: Stream im Hintergrund vorbereiten
  private async preWarmStream(): Promise<void> {
    if (this.isPreWarming || this.preWarmedStream) return;
    
    try {
      this.isPreWarming = true;
      console.log('🔥 Pre-warming audio stream für schnelleren Start...');
      
      this.preWarmedStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: this.options.channelCount,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          ...(navigator.mediaDevices.getSupportedConstraints().latency && { latency: 0.01 }),
          ...(navigator.mediaDevices.getSupportedConstraints().volume && { volume: 1.0 }),
        },
        video: false,
      });
      
      console.log('✅ Audio stream pre-warmed und bereit für sofortige Nutzung');
    } catch (error) {
      console.log('ℹ️ Pre-warming fehlgeschlagen (nicht kritisch):', error);
    } finally {
      this.isPreWarming = false;
    }
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
      // ⚡ SPEED OPTIMIZATION: Pre-warmed stream verwenden wenn verfügbar
      if (this.preWarmedStream && this.preWarmedStream.active) {
        console.log('🚀 Verwende pre-warmed stream für sofortigen Start');
        this.stream = this.preWarmedStream;
        this.preWarmedStream = null; // Stream ist jetzt in Verwendung
        
        // Neuen Stream für nächstes Mal pre-warmen
        setTimeout(() => this.preWarmStream(), 100);
      } else {
        console.log('🔄 Erstelle neuen audio stream (pre-warmed nicht verfügbar)');
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
      }

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

      // 🎧 AUDIO-NORMALISIERUNG: Web Audio API für bessere Audio-Qualität
      const audioContext = new AudioContext({ sampleRate: this.options.sampleRate });
      const source = audioContext.createMediaStreamSource(this.stream);
      
      // Gain-Normalisierung für konsistente Lautstärke
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(2.0, audioContext.currentTime); // 2x Verstärkung für leise Sprache
      
      // Compressor für gleichmäßige Lautstärke
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-24, audioContext.currentTime);
      compressor.knee.setValueAtTime(30, audioContext.currentTime);
      compressor.ratio.setValueAtTime(12, audioContext.currentTime);
      compressor.attack.setValueAtTime(0.003, audioContext.currentTime);
      compressor.release.setValueAtTime(0.25, audioContext.currentTime);
      
      // Audio-Pipeline: Source → Gain → Compressor (KEIN Destination = kein Feedback)
      source.connect(gainNode);
      gainNode.connect(compressor);
      // ❌ FEEDBACK FIX: NICHT an destination connecten um Echo zu vermeiden
      
      console.log('🎧 Audio-Normalisierung aktiviert: 2x Gain + Dynamic Compression');

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

      // ⚡ SPEED OPTIMIZATION: Häufigere Datensammlung für schnellere Übertragung
      this.mediaRecorder.start(50); // Alle 50ms Daten sammeln - 2x schneller

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

      // Pre-warmed stream auch bereinigen falls vorhanden
      if (this.preWarmedStream) {
        this.preWarmedStream.getTracks().forEach(track => {
          track.stop();
        });
        this.preWarmedStream = null;
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