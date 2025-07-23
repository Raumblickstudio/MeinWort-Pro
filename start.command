#!/bin/bash

# MeinWort Pro - Entwicklungsstart
clear
echo "🚀 MeinWort Pro Entwicklungsstart"
echo "================================="

# Zum Projektverzeichnis wechseln
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Laufende Prozesse beenden
pkill -f vite 2>/dev/null || true
pkill -f tauri 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

sleep 1

echo "📂 Arbeitsverzeichnis: $PWD"
echo ""

# Kurze System-Info
echo "🔧 Versionen:"
echo "   Node.js: $(node --version)"
echo "   Rust: $(rustc --version | cut -d' ' -f1-2)"
echo ""

echo "🎯 Starte MeinWort Pro Overlay..."
echo "   • Größe: 280x180px"
echo "   • Position: Links oben (x=50, y=50)"
echo "   • Modernes UI mit Transparenz"
echo "   • AlwaysOnTop aktiviert"
echo "   • Test-Modus: Klick auf 'Aufnahme' für Demo"
echo ""
echo "🔥 Neue Features in Phase 3:"
echo "   • 🎯 F9-Hotkey: Aufnahme starten/stoppen (GLOBAL)"
echo "   • 🛑 ESC-Hotkey: Aufnahme stoppen"
echo "   • 💥 MEGA-FEEDBACK: Spektakuläre Hotkey-Animation!"
echo "   • 🎨 Visuelles Feedback im UI"
echo "   • 💫 Animierte Status-Übergänge"
echo ""
echo "🎆 NEUES FEEDBACK-SYSTEM:"
echo "   • F9 drücken → RIESIGE Animation erscheint!"
echo "   • Blaue F9-Taste mit Partikeln und Rotation"
echo "   • 1,5 Sekunden spektakuläre Show"
echo "   • Funktioniert auch bei anderen Apps im Fokus!"
echo ""
echo "🧪 Teste das Feedback:"
echo "   1. Drücke F9 → BOOM! Mega-Animation!"
echo "   2. Auch bei ESC → ESC-Animation"  
echo "   3. Konsole zeigt: '🔥 F9 HOTKEY PRESSED!'"
echo "   4. Du siehst sofort ob F9 funktioniert!"
echo "💡 Zum Beenden: Cmd+C oder Fenster schließen"
echo ""

# Tauri Development starten
npm run tauri:dev

echo ""
echo "✅ MeinWort Pro beendet"
echo ""
read -p "Drücke Enter zum Schließen..."