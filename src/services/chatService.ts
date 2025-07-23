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

    const client = new OpenAI({
      apiKey,
      organization: import.meta.env.VITE_OPENAI_ORGANIZATION,
      baseURL: import.meta.env.VITE_OPENAI_BASE_URL,
      dangerouslyAllowBrowser: true,
    });

    this.isInitialized = true;
    return client;
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

      // System-Prompt für Text-Verarbeitung
      const systemPrompt = this.createSystemPrompt();
      
      // User-Prompt erstellen
      const userPrompt = this.createUserPrompt(request.command, request.originalText);

      const startTime = Date.now();

      // OpenAI Chat API aufrufen
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini', // Kosteneffizient und schnell für Text-Processing
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1, // Performance optimiert - weniger "Nachdenken"
        max_tokens: 1200, // Performance optimiert - kürzere, fokussierte Antworten
      });

      const processingTime = Date.now() - startTime;

      if (!response.choices || response.choices.length === 0) {
        throw new Error('Keine Antwort von OpenAI erhalten');
      }

      const processedText = response.choices[0].message?.content?.trim();
      
      if (!processedText) {
        throw new Error('Leere Antwort von OpenAI erhalten');
      }

      console.log(`✅ Text-Verarbeitung abgeschlossen in ${processingTime}ms`);
      console.log(`📝 Ergebnis: ${processedText.length} Zeichen`);

      return {
        processedText,
        originalCommand: request.command,
        tokensUsed: response.usage?.total_tokens
      };

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
    return `Du bist ein intelligenter Text-Verarbeitungsassistent. Du hilfst dabei, Texte nach spezifischen Anweisungen zu bearbeiten.

WICHTIGE REGELN:
1. Antworte IMMER in der gleichen Sprache wie der Original-Text
2. Behalte den Sinn und wichtige Informationen bei
3. Sei präzise und folge der Anweisung genau
4. Gib NUR den verarbeiteten Text zurück, keine Erklärungen oder zusätzliche Kommentare
5. Falls die Anweisung unklar ist, interpretiere sie bestmöglich im Kontext der Textbearbeitung

HÄUFIGE BEFEHLE:
- "zusammenfassen" = Erstelle eine prägnante Zusammenfassung
- "übersetzen" = Übersetze in die angegebene Sprache
- "formeller machen" = Verwende formellere Sprache
- "vereinfachen" = Verwende einfachere Worte und Sätze
- "kürzer machen" = Reduziere auf die wichtigsten Punkte
- "korrigieren" = Korrigiere Rechtschreibung und Grammatik
- "Zähle die Anzahl der Wörter" = Zähle und nenne die genaue Anzahl der Wörter
- "Zähle die Anzahl der Zeichen" = Zähle und nenne die genaue Anzahl der Zeichen
- "Zähle die Anzahl der Sätze" = Zähle und nenne die genaue Anzahl der Sätze

SPEZIAL-ANWEISUNGEN FÜR ZÄHLEN:
- Bei Zähl-Befehlen antworte im Format: "Der Text enthält X Wörter/Zeichen/Sätze."
- Sei präzise und gebe die genaue Zahl an`;
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