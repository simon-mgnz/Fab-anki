# Fab'Anki - File Structure

## Current Structure

```
Fab'Anki/
├── index.html              - App shell and layout
├── config.js               - Firebase configuration
├── styles.css              - All CSS styles
├── service-worker.js       - PWA cache and offline support
├── app-manifest.json       - PWA manifest
├── assets/
│   └── icons/
│       ├── fabankiapp.png      - PWA / home-screen icon
│       ├── fabankifavicon.png  - Browser favicon
│       └── nav/                - Sidebar navigation SVGs
├── js/
│   ├── app.js              - Main application logic
│   └── schoolCalendar.js   - School week / programme calendar
├── decks/                  - Flashcard XML files + manifest.json
├── functions/              - Firebase Cloud Functions
├── docs/                   - Project guides and documentation
├── firebase.json           - Firebase hosting / functions config
├── firestore.rules         - Firestore security rules
└── README.md               - Project overview
```

## Branding

- **In-app UI** (splash, sidebar, top bar): Unicode mark `𝓕` (no image background)
- **Favicon**: `assets/icons/fabankifavicon.png`
- **PWA / notifications**: `assets/icons/fabankiapp.png`

## Root folder policy

Keep only deploy/runtime files at the project root. Guides live in `docs/`, static assets in `assets/`, and application code in `js/`.
