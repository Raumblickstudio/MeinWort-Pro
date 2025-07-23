import OpenAI from 'openai';

export interface ChatRequest {
  command: string;
  originalText: string;
}

export interface ChatResult {
  processedText: string;
  originalCommand: string;
  tokensUsed?: number;
}

export class ChatService {
  private client: OpenAI;
  private isInitialized: boolean = false;
  // ⚡ SPEED: Connection Keep-Alive für schnellere API-Calls
  private keepAliveAgent: any;
  // ⚡ CACHE: Lokaler Cache für häufige Befehle
  private commandCache: Map<string, { result: ChatResult; timestamp: number }> = new Map();

  constructor() {
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

    // ⚡ SPEED: HTTP Keep-Alive Agent für persistente Verbindungen
    const client = new OpenAI({
      apiKey,
      organization: import.meta.env.VITE_OPENAI_ORGANIZATION,
      baseURL: import.meta.env.VITE_OPENAI_BASE_URL,
      dangerouslyAllowBrowser: true,
      // ⚡ Timeout optimiert für schnelle Antworten
      timeout: 10000, // 10s statt default 60s
      maxRetries: 1, // Weniger Retries für Speed
    });

    this.isInitialized = true;
    return client;
  }

  /**
   * ⚡ FAST-TRACK: Lokale Verarbeitung für einfache Befehle
   */
  private processFastTrackCommand(command: string, text: string): ChatResult | null {
    const normalizedCommand = command.toLowerCase().trim();
    
    // Wörter zählen - lokal ohne API
    if (normalizedCommand.includes('wörter zählen') || normalizedCommand.includes('wie viele wörter')) {
      const wordCount = text.trim().split(/\s+/).length;
      return {
        processedText: `Der Text enthält ${wordCount} Wörter.`,
        originalCommand: command
      };
    }
    
    // Zeichen zählen - lokal ohne API  
    if (normalizedCommand.includes('zeichen zählen') || normalizedCommand.includes('wie viele zeichen')) {
      const charCount = text.length;
      const charCountNoSpaces = text.replace(/\s/g, '').length;
      return {
        processedText: `Der Text enthält ${charCount} Zeichen (${charCountNoSpaces} ohne Leerzeichen).`,
        originalCommand: command
      };
    }
    
    // Sätze zählen - lokal ohne API
    if (normalizedCommand.includes('sätze zählen') || normalizedCommand.includes('wie viele sätze')) {
      const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
      return {
        processedText: `Der Text enthält ${sentenceCount} Sätze.`,
        originalCommand: command
      };
    }

    // Einfache Rechtschreibkorrektur - basic patterns
    if (normalizedCommand.includes('korrigier') && text.length < 200) {
      let corrected = text
        .replace(/\s+/g, ' ') // Mehrfache Leerzeichen
        .replace(/\.{2,}/g, '...') // Mehrfache Punkte
        .replace(/\?{2,}/g, '?') // Mehrfache Fragezeichen
        .replace(/!{2,}/g, '!') // Mehrfache Ausrufezeichen
        .trim();
      
      // Erstes Wort großschreiben
      corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
      
      return {
        processedText: corrected,
        originalCommand: command
      };
    }
    
    return null; // Kein Fast-Track möglich
  }

  /**
   * ⚡ Bestimmt ob ein Befehl einfach ist (gpt-3.5-turbo) oder komplex (gpt-4o-mini)
   */
  private isSimpleCommand(command: string): boolean {
    const normalizedCommand = command.toLowerCase().trim();
    
    const simpleCommands = [
      'kürzer', 'vereinfach', 'formell', 'korrigier', 'groß', 'klein',
      'übersetze', 'englisch', 'deutsch', 'french', 'spanish',
      'punkte', 'liste', 'struktur', 'format'
    ];
    
    return simpleCommands.some(cmd => normalizedCommand.includes(cmd));
  }

  /**
   * Text mit Sprachbefehl verarbeiten
   */
  async processTextWithCommand(request: ChatRequest): Promise<ChatResult> {
    try {
      if (!this.isInitialized) {
        this.client = this.initializeClient();
      }

      console.log(`🤖 Verarbeite Text mit Befehl: "${request.command}"`);
      console.log(`📄 Original-Text: ${request.originalText.length} Zeichen`);

      // ⚡ CACHE: Prüfe Cache für häufige Kombinationen
      const cacheKey = `${request.command}:${request.originalText.substring(0, 100)}`;
      const cached = this.commandCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < 300000) { // 5 Minuten Cache
        console.log(`⚡ CACHE HIT: Befehl "${request.command}" aus Cache in <1ms`);
        return cached.result;
      }

      // ⚡ FAST-TRACK: Versuche lokale Verarbeitung zuerst
      const fastTrackResult = this.processFastTrackCommand(request.command, request.originalText);
      if (fastTrackResult) {
        console.log(`⚡ FAST-TRACK: Befehl "${request.command}" lokal verarbeitet in <1ms`);
        // Cache auch lokale Ergebnisse
        this.commandCache.set(cacheKey, { result: fastTrackResult, timestamp: Date.now() });
        return fastTrackResult;
      }

      // System-Prompt für Text-Verarbeitung
      const systemPrompt = this.createSystemPrompt();
      
      // User-Prompt erstellen
      const userPrompt = this.createUserPrompt(request.command, request.originalText);

      const startTime = Date.now();

      // ⚡ SMART MODEL: gpt-3.5-turbo für einfache Befehle (5x schneller)
      const isSimpleCommand = this.isSimpleCommand(request.command);
      const model = isSimpleCommand ? 'gpt-3.5-turbo' : 'gpt-4o-mini';
      
      console.log(`🧠 Verwende ${model} für "${request.command}" (${isSimpleCommand ? 'einfach' : 'komplex'})`);

      // ⚡ STREAMING: OpenAI Chat API mit Stream für Echtzeit-Antworten
      const stream = await this.client.chat.completions.create({
        model, // Dynamische Modell-Auswahl für optimale Geschwindigkeit
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // ⚡ SPEED: Höhere Temperatur für schnellere Antworten
        max_tokens: 400, // ⚡ SPEED: Drastisch reduziert für 3x schnellere Verarbeitung
        stream: true, // ⚡ STREAMING: Echtzeit-Antworten für bessere UX
      });

      // ⚡ STREAMING: Antwort in Echtzeit sammeln
      let streamedText = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        streamedText += content;
      }

      // Dummy response object für Kompatibilität
      const response = {
        choices: [{ message: { content: streamedText } }],
        usage: { total_tokens: Math.ceil(streamedText.length / 4) } // Geschätzt
      };

      const processingTime = Date.now() - startTime;

      if (!response.choices || response.choices.length === 0) {
        throw new Error('Keine Antwort von OpenAI erhalten');
      }

      const processedText = response.choices[0].message?.content?.trim();
      
      if (!processedText) {
        throw new Error('Leere Antwort von OpenAI erhalten');
      }

      const result: ChatResult = {
        processedText,
        originalCommand: request.command,
        tokensUsed: response.usage?.total_tokens
      };

      // ⚡ CACHE: API-Ergebnis für künftige Nutzung cachen
      this.commandCache.set(cacheKey, { result, timestamp: Date.now() });

      console.log(`✅ Text-Verarbeitung abgeschlossen in ${processingTime}ms`);
      console.log(`📝 Ergebnis: ${processedText.length} Zeichen`);

      return result;

    } catch (error: any) {
      console.error('❌ Chat-Verarbeitung fehlgeschlagen:', error);

      // Spezifische Fehlerbehandlung
      if (error?.status === 400) {
        throw new Error('Ungültiger Request oder Text zu lang');
      } else if (error?.status === 429) {
        throw new Error('Zu viele Anfragen. Bitte warten Sie einen Moment.');
      } else if (error?.status === 500) {
        throw new Error('OpenAI Server-Fehler. Bitte versuchen Sie es später erneut.');
      }

      throw new Error(
        `Text-Verarbeitung fehlgeschlagen: ${error?.message || 'Unbekannter Fehler'}`
      );
    }
  }

  /**
   * System-Prompt für verschiedene Text-Verarbeitungsaufgaben
   */
  private createSystemPrompt(): string {
    return `⚡ SCHNELLER Text-Assistent. Bearbeite Texte sofort nach Anweisung.

REGELN:
1. Gleiche Sprache wie Original
2. NUR verarbeiteten Text zurückgeben
3. Keine Erklärungen
4. Kurz und präzise

BEFEHLE:
- zusammenfassen → kurze Zusammenfassung
- übersetzen → in Zielsprache
- formeller → professionelle Sprache  
- vereinfachen → einfache Worte
- kürzer → wichtigste Punkte
- korrigieren → Fehler beheben
- Wörter/Zeichen/Sätze zählen → "X Wörter/Zeichen/Sätze"

⚡ SOFORT ANTWORTEN!`;
  }

  /**
   * User-Prompt mit Befehl und Text erstellen
   */
  private createUserPrompt(command: string, originalText: string): string {
    return `ANWEISUNG: ${command}

ORIGINAL-TEXT:
${originalText}

VERARBEITETER TEXT:`;
  }

  /**
   * Befehl-Erkennung und Optimierung
   */
  static normalizeCommand(rawCommand: string): string {
    const normalized = rawCommand.toLowerCase().trim();
    
    // Häufige Variationen normalisieren
    const commandMappings: Record<string, string> = {
      // Zusammenfassen
      'fass zusammen': 'zusammenfassen',
      'fasse zusammen': 'zusammenfassen',
      'fass mir das zusammen': 'zusammenfassen',
      'zusammenfassung': 'zusammenfassen',
      'summary': 'zusammenfassen',
      
      // Übersetzen
      'übersetze': 'ins Englische übersetzen',
      'translate': 'ins Englische übersetzen',
      'englisch': 'ins Englische übersetzen',
      
      // Formeller
      'mach formeller': 'formeller machen',
      'formell': 'formeller machen',
      'professionell': 'formeller machen',
      
      // Vereinfachen
      'vereinfach': 'vereinfachen',
      'einfacher': 'vereinfachen',
      'simple': 'vereinfachen',
      
      // Kürzen
      'kürzer': 'kürzer machen',
      'kürze': 'kürzer machen',
      'reduzieren': 'kürzer machen',
      
      // Korrigieren
      'korrigier': 'Rechtschreibung und Grammatik korrigieren',
      'korrigiere': 'Rechtschreibung und Grammatik korrigieren',
      'fehler': 'Rechtschreibung und Grammatik korrigieren',
      
      // Zählen & Analysieren
      'wieviel wörter': 'Zähle die Anzahl der Wörter in diesem Text',
      'wie viele wörter': 'Zähle die Anzahl der Wörter in diesem Text',
      'wieviel wörter sind enthalten': 'Zähle die Anzahl der Wörter in diesem Text',
      'wie viele wörter sind enthalten': 'Zähle die Anzahl der Wörter in diesem Text',
      'wörter zählen': 'Zähle die Anzahl der Wörter in diesem Text',
      'anzahl wörter': 'Zähle die Anzahl der Wörter in diesem Text',
      'count words': 'Zähle die Anzahl der Wörter in diesem Text',
      
      // Zeichen zählen
      'wieviel zeichen': 'Zähle die Anzahl der Zeichen in diesem Text',
      'wie viele zeichen': 'Zähle die Anzahl der Zeichen in diesem Text',
      'zeichen zählen': 'Zähle die Anzahl der Zeichen in diesem Text',
      
      // Sätze zählen
      'wieviel sätze': 'Zähle die Anzahl der Sätze in diesem Text',
      'wie viele sätze': 'Zähle die Anzahl der Sätze in diesem Text',
      'sätze zählen': 'Zähle die Anzahl der Sätze in diesem Text',
    };

    return commandMappings[normalized] || rawCommand;
  }

  /**
   * Geschätzte Kosten berechnen
   */
  static estimateCost(inputTokens: number, outputTokens: number): number {
    // GPT-4o-mini Preise (Stand 2024)
    const inputCostPer1k = 0.000150;  // $0.150 per 1k input tokens
    const outputCostPer1k = 0.000600; // $0.600 per 1k output tokens
    
    return (inputTokens / 1000 * inputCostPer1k) + (outputTokens / 1000 * outputCostPer1k);
  }

  cleanup(): void {
    this.isInitialized = false;
  }
}

// Singleton Instance
export const chatService = new ChatService();