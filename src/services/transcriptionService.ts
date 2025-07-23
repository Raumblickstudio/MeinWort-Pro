import OpenAI from 'openai';
import { AudioRecording } from './audioService';

export interface TranscriptionOptions {
  language?: string;
  temperature?: number;
  response_format?: 'json' | 'text' | 'srt' | 'verbose_json' | 'vtt';
  prompt?: string;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
  confidence?: number;
}

export class TranscriptionService {
  private client: OpenAI;
  private isInitialized: boolean = false;

  constructor() {
    // Client wird lazy initialisiert um API Key Validierung zu ermöglichen
    this.client = this.initializeClient();
  }

  private initializeClient(): OpenAI {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey || apiKey === 'your-openai-api-key-here') {
      throw new Error(
        'OpenAI API Key nicht gefunden. ' +
        'Bitte setzen Sie VITE_OPENAI_API_KEY in der .env Datei.'
      );
    }

    if (!apiKey.startsWith('sk-')) {
      throw new Error('Ungültiger OpenAI API Key Format. Key sollte mit "sk-" beginnen.');
    }

    const client = new OpenAI({
      apiKey,
      organization: import.meta.env.VITE_OPENAI_ORGANIZATION,
      baseURL: import.meta.env.VITE_OPENAI_BASE_URL,
      dangerouslyAllowBrowser: true, // Erforderlich für Browser-Umgebung
    });

    this.isInitialized = true;
    return client;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        this.client = this.initializeClient();
      }

      // Teste API-Verbindung mit einem kleinen Request
      const models = await this.client.models.list();
      const hasWhisperModel = models.data.some(model => 
        model.id.includes('whisper')
      );

      if (!hasWhisperModel) {
        console.warn('⚠️ Keine Whisper-Modelle gefunden, aber API-Key ist gültig');
      }

      console.log('✅ OpenAI API Key validiert');
      return true;

    } catch (error: any) {
      console.error('❌ API Key Validierung fehlgeschlagen:', error);
      
      if (error?.status === 401) {
        throw new Error('OpenAI API Key ungültig oder abgelaufen.');
      } else if (error?.status === 429) {
        throw new Error('OpenAI API Rate Limit erreicht. Bitte versuchen Sie es später erneut.');
      } else if (error?.status === 403) {
        throw new Error('OpenAI API Zugriff verweigert. Überprüfen Sie Ihre Berechtigung für Whisper.');
      }
      
      throw new Error(`API Verbindungsfehler: ${error?.message || 'Unbekannter Fehler'}`);
    }
  }

  async transcribeAudio(
    recording: AudioRecording,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    try {
      if (!this.isInitialized) {
        this.client = this.initializeClient();
      }

      // Validierungen
      if (!recording.blob || recording.blob.size === 0) {
        throw new Error('Keine gültige Audio-Datei vorhanden');
      }

      // OpenAI hat ein 25MB Limit
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (recording.blob.size > maxSize) {
        throw new Error(`Audio-Datei zu groß (${Math.round(recording.blob.size / 1024 / 1024)}MB). Maximum: 25MB`);
      }

      // 🔇 SILENCE DETECTION: Sehr kurze Aufnahmen als Stille filtern
      if (recording.duration < 300) {
        console.warn('⚠️ Audio-Aufnahme sehr kurz (wahrscheinlich Stille):', recording.duration, 'ms');
        return {
          text: '[Aufnahme zu kurz - bitte sprechen Sie länger]',
          duration: recording.duration,
          confidence: 0
        };
      }

      // 🔇 ADVANCED SILENCE DETECTION: Audio-Daten auf Stille prüfen
      const silenceThreshold = await this.detectSilence(recording.blob);
      if (silenceThreshold > 0.8) {
        console.warn('🔇 Audio-Aufnahme hauptsächlich Stille erkannt:', silenceThreshold * 100, '% Stille');
        return {
          text: '[Nur Stille erkannt - bitte lauter sprechen]',
          duration: recording.duration,
          confidence: 0
        };
      }
      
      // Warnung bei sehr kurzen Aufnahmen
      if (recording.duration < 500) {
        console.warn('⚠️ Audio-Aufnahme möglicherweise zu kurz für zuverlässige Erkennung:', recording.duration, 'ms');
      }

      console.log(`🔄 Starte Transkription: ${Math.round(recording.blob.size / 1024)}KB, ${recording.duration}ms`);
      console.log(`🎧 Audio-Details: Type=${recording.blob.type}, Size=${recording.blob.size} bytes`);

      // ⚡ SPEED OPTIMIZATION: Direkter Blob-Upload ohne File-Wrapper für bessere Performance
      const audioBlob = recording.blob;

      // Standard-Optionen
      const transcriptionOptions = {
        model: 'whisper-1',
        language: options.language || 'de', // Deutsch als Standard
        response_format: options.response_format || 'verbose_json' as const,
        temperature: options.temperature ?? 1.0, // 🔊 MAXIMUM EMPFINDLICHKEIT: Höchste Temperatur für aggressivste leise Sprache-Erkennung
        prompt: options.prompt || 'Dies ist deutsche Sprache. Bitte transkribiere ALLE Audio-Signale, auch extrem leise Flüstern oder undeutliche Laute. Nutze maximale Empfindlichkeit.',
        ...options,
      };

      const startTime = Date.now();
      console.log(`🌐 Sende an Whisper API mit Optionen:`, {
        model: transcriptionOptions.model,
        language: transcriptionOptions.language,
        temperature: transcriptionOptions.temperature,
        response_format: transcriptionOptions.response_format
      });

      // 🔄 SMART RETRY: Intelligente Wiederholung bei schlechter Qualität
      const response: any = await this.transcribeWithRetry(audioBlob, transcriptionOptions, 2);

      const processingTime = Date.now() - startTime;
      console.log(`⚡ Whisper API Response erhalten in ${processingTime}ms`);

      // Response verarbeiten
      let result: TranscriptionResult;

      if (typeof response === 'string') {
        // Einfacher Text-Response
        result = {
          text: response.trim(),
          duration: recording.duration,
        };
      } else if (response && typeof response === 'object' && 'text' in response) {
        // Verbose JSON Response
        result = {
          text: response.text.trim(),
          language: response.language,
          duration: recording.duration,
        };

        // Zusätzliche Metadaten aus verbose_json falls verfügbar
        if ('segments' in response && Array.isArray(response.segments)) {
          const avgConfidence = response.segments.reduce((sum: number, segment: any) => 
            sum + (segment.avg_logprob || 0), 0
          ) / response.segments.length;
          
          // Log-Wahrscheinlichkeit zu Confidence Score konvertieren (ungefähr)
          result.confidence = Math.max(0, Math.min(1, Math.exp(avgConfidence)));
        }
      } else {
        throw new Error('Unerwartetes Response-Format von OpenAI API');
      }

      // Validierung des Ergebnisses - Nur bei wirklich leerem Text Fallback
      if (!result.text) {
        console.warn('⚠️ Whisper hat null/undefined Text zurückgegeben');
        result.text = '[Keine Sprache erkannt - bitte sprechen Sie lauter oder länger]';
        result.confidence = 0;
      } else if (result.text.trim().length === 0) {
        console.warn('⚠️ Whisper hat nur Leerraum zurückgegeben');
        result.text = '[Keine Sprache erkannt - bitte sprechen Sie lauter oder länger]';
        result.confidence = 0;
      } else {
        // Erfolgreiche Transkription - keine Änderung nötig
        console.log('✅ Whisper hat Text erkannt:', result.text.substring(0, 50) + '...');
      }

      console.log(`✅ Transkription erfolgreich: ${result.text.length} Zeichen in ${processingTime}ms`);
      console.log(`📝 Ergebnis: "${result.text.substring(0, 100)}${result.text.length > 100 ? '...' : ''}"`);

      return result;

    } catch (error: any) {
      console.error('❌ Transkription fehlgeschlagen:', error);

      // OpenAI spezifische Fehler
      if (error?.status === 400) {
        throw new Error('Ungültiges Audio-Format oder -inhalt');
      } else if (error?.status === 413) {
        throw new Error('Audio-Datei zu groß (Maximum: 25MB)');
      } else if (error?.status === 429) {
        throw new Error('Zu viele Anfragen. Bitte warten Sie einen Moment.');
      } else if (error?.status === 500) {
        throw new Error('OpenAI Server-Fehler. Bitte versuchen Sie es später erneut.');
      }

      // Netzwerk-Fehler
      if (error?.code === 'NETWORK_ERROR' || !navigator.onLine) {
        throw new Error('Keine Internetverbindung verfügbar');
      }

      throw new Error(
        `Transkription fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`
      );
    }
  }

  // Utility: Unterstützte Audio-Formate prüfen
  static getSupportedFormats(): string[] {
    return [
      'audio/webm',
      'audio/wav',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/flac',
    ];
  }

  // Utility: Geschätzte Kosten berechnen (grobe Schätzung)
  static estimateCost(durationMs: number): number {
    const minutes = durationMs / 60000;
    return Math.max(0.006, minutes * 0.006); // $0.006 per Minute
  }

  // Cleanup für Browser-spezifische Ressourcen
  // 🔄 SMART RETRY: Intelligente Wiederholung mit verschiedenen Parametern
  private async transcribeWithRetry(
    audioBlob: Blob, 
    baseOptions: any, 
    maxRetries: number = 2
  ): Promise<any> {
    const retryConfigs = [
      // Versuch 1: Standard-Parameter
      { ...baseOptions },
      // Versuch 2: Höhere Temperatur für schwierige Audio
      { ...baseOptions, temperature: Math.min(1.0, baseOptions.temperature + 0.3) },
      // Versuch 3: Anderer Prompt für sehr schwierige Fälle
      { ...baseOptions, 
        temperature: 1.0, 
        prompt: 'Dies ist deutsche Sprache mit möglicherweise schlechter Audioqualität. Nutze maximale Empfindlichkeit und aggressive Erkennung.' 
      }
    ];

    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const config = retryConfigs[attempt] || retryConfigs[retryConfigs.length - 1];
        console.log(`🔄 Whisper Versuch ${attempt + 1}/${maxRetries + 1} mit Temperatur ${config.temperature}`);
        
        const response = await this.client.audio.transcriptions.create({
          file: new File([audioBlob], 'recording.webm', { type: audioBlob.type }),
          ...config,
        });

        // Erfolg validieren
        if (response && (typeof response === 'string' || (response.text && response.text.trim()))) {
          if (attempt > 0) {
            console.log(`✅ Whisper erfolgreich nach ${attempt + 1} Versuchen`);
          }
          return response;
        } else {
          throw new Error('Leere oder ungültige Antwort');
        }
        
      } catch (error: any) {
        lastError = error;
        console.warn(`⚠️ Whisper Versuch ${attempt + 1} fehlgeschlagen:`, error?.message);
        
        // Bei letztem Versuch: Fehler weiterwerfen
        if (attempt === maxRetries) {
          console.error(`❌ Alle ${maxRetries + 1} Whisper-Versuche fehlgeschlagen`);
          throw lastError;
        }
        
        // Kurze Pause vor nächstem Versuch
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    
    throw lastError;
  }

  // 🔇 SILENCE DETECTION: Audio-Blob auf Stille analysieren
  private async detectSilence(blob: Blob): Promise<number> {
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      const frameSize = Math.floor(sampleRate * 0.1); // 100ms Frames
      
      let silentFrames = 0;
      let totalFrames = 0;
      
      for (let i = 0; i < channelData.length; i += frameSize) {
        const frame = channelData.slice(i, i + frameSize);
        const rms = Math.sqrt(frame.reduce((sum, sample) => sum + sample * sample, 0) / frame.length);
        
        // Stille-Schwellwert: sehr niedrige RMS-Werte
        if (rms < 0.01) {
          silentFrames++;
        }
        totalFrames++;
      }
      
      const silenceRatio = totalFrames > 0 ? silentFrames / totalFrames : 1;
      console.log(`🔇 Silence Detection: ${(silenceRatio * 100).toFixed(1)}% stille Frames`);
      
      audioContext.close();
      return silenceRatio;
      
    } catch (error) {
      console.warn('🔇 Silence Detection fehlgeschlagen (nicht kritisch):', error);
      return 0; // Bei Fehler annehmen dass Audio vorhanden ist
    }
  }

  cleanup(): void {
    // Momentan keine spezielle Cleanup-Logik erforderlich
    this.isInitialized = false;
  }
}

// Singleton Instance
export const transcriptionService = new TranscriptionService();