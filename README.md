# MeinWort Pro

Ein modernes Desktop-Sprachtranskriptions-Overlay für Windows und macOS.

## Features (Geplant)

- 🎤 **Hotkey-Aufnahme**: F9 zum Starten/Stoppen der Audioaufnahme
- 🔊 **Whisper-Integration**: Hochwertige Spracherkennung via OpenAI Whisper
- 📋 **Auto-Clipboard**: Automatisches Kopieren in die Zwischenablage
- 🖼️ **Overlay-UI**: Kompaktes, schwebendes 200x100px Fenster
- 🎯 **Always-On-Top**: Bleibt immer sichtbar
- 🌍 **Cross-Platform**: Windows und macOS Support

## Technologie-Stack

- **Frontend**: React 18 + TypeScript
- **UI/Styling**: TailwindCSS + Framer Motion
- **Desktop**: Tauri 2.0 (Rust)
- **API**: OpenAI Whisper
- **Build**: Vite

## Phase 1: Setup ✅

Das Grundsetup ist abgeschlossen:

- ✅ Tauri 2.0 mit React + TypeScript
- ✅ TailwindCSS für Styling
- ✅ Overlay-Fenster konfiguriert (200x100px, AlwaysOnTop, transparent)
- ✅ Tauri Plugins (Global Shortcut, Clipboard Manager)
- ✅ Build-System funktionsfähig

## Nächste Phasen

- **Phase 2**: Overlay-UI Implementation
- **Phase 3**: F9-Hotkey Integration  
- **Phase 4**: Mikrofonaufnahme
- **Phase 5**: Whisper API Integration
- **Phase 6**: Zwischenablage-Funktionalität

## Development

```bash
# Development starten
npm run tauri:dev

# Build erstellen
npm run tauri:build

# Frontend build
npm run build
```