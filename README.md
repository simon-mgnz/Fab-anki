# Fab'Anki

A lightweight, browser-based flashcard application with no account requirement. Built for efficient spaced-repetition study, with comprehensive support for mathematical notation via KaTeX.

## Features

### Deck Management
- Load local XML deck files from your computer
- Browse hosted decks from `./decks/` directory
- Support for multiple concurrent decks
- Optimized manifest.json indexing system

### Card Review System
- Minimal, distraction-free interface
- SM-2 spacing algorithm with four difficulty ratings (Again, Hard, Good, Easy)
- Progressive answer reveal on demand
- Full Anki field support (front, back, always-show)

### Progress Tracking
- Visual histogram showing card distribution by due date
- Real-time progress bar during study sessions
- Detailed statistics: total cards and ready cards
- Due date categories: New, Now, <12h, Tomorrow, <1 week, Long-term

### Mathematical Support
- Integrated KaTeX rendering for LaTeX formulas
- Support for inline `$...$` and display `$$...$$` notation

### Customization
- Dark mode for reduced eye strain
- Fully responsive design for all devices
- Mobile-optimized full-screen interface with enlarged touch targets

### Local Storage
- Browser-based localStorage persistence
- No server required, no account needed
- Automatic session retention across browser instances
- Local data reset capability

### Deployment
- URL parameter support via `?deck=` for direct deck loading
- GitHub Pages compatible
- Single-file deployment

## Included Decks (in French)
- English
- Mathematics
- Physics
- IT
- Industrial Engineering
- French Literature

## Deployment (if you want to fork it)

### GitHub Pages Setup

1. Create a GitHub repository and push all project files (index.html and decks/ directory)
2. Enable GitHub Pages in repository settings: Settings → Pages → Source: main branch → / (root)
3. Your application will be available at `https://<username>.github.io/<repo>/`

### Important Notes

- Deck uploads via the UI load files client-side only. Server-side upload requires implementing a dedicated endpoint.
- GitHub Pages does not display directory listings by default. The `decks/manifest.json` file provides reliable deck discovery.

## Architecture

- Single-file application contained in index.html
- Zero dependencies except KaTeX (served via CDN)
- Client-side only, no server required
- Persistent state via localStorage


© Fab'Anki - 2026 - MPSI1 >> MPSI2
