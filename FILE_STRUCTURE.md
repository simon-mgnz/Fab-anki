# Fab'Anki - File Structure

The application has been organized with separate files for configuration, styles, and JavaScript.

## Current Structure

```
Fab'Anki/
├── index.html (144 lines, ~8 KB)      - Clean HTML structure
├── config.js (27 lines, ~1 KB)        - Firebase configuration
├── styles.css (709 lines, ~25 KB)     - All CSS styles
├── js/
│   └── app.js (5504 lines, ~314 KB)   - Complete application logic
├── decks/                              - Flashcard XML files
└── index-old.html                      - Original monolithic backup
```

## File Descriptions

### index.html (~8 KB)
- Clean HTML structure with external CSS and JS references
- Contains only the page layout and DOM elements
- Links to Firebase CDN, KaTeX CDN, and local modules

### config.js (~1 KB)
- Firebase project configuration
- Firebase initialization logic
- Sets up:
  - `window.__fabanki_firebaseConfig`
  - `window.__fabanki_firestore`
  - `window.__fabanki_auth`

### styles.css (~25 KB)
- All CSS styles extracted from original file
- CSS variables for theming (light/dark mode)
- Responsive design rules
- Animation keyframes (fade, bounce, rotate, spring, etc.)
- Component-specific styles

### js/app.js (~314 KB)
**Complete application logic organized into logical sections:**

1. **Initialization & State** - Global variables and application state
2. **Deck Loading** - loadDeckFromURL, loadMultipleDeckCards, parseXMLDeck
3. **Card Rendering** - renderFront, renderBack, buildFieldElement, renderKaTeX
4. **Deck Browser UI** - showDeckOverview with pie chart and card grid
5. **FSRS Scheduling** - initFSRS, scheduleCard, getDueCards, updateHistogram
6. **Main Event Handlers** - DOMContentLoaded, button listeners, swipe gestures
7. **Profile & XP System** - showProfilePopup, level calculations, missions
8. **Firebase Sync** - createAccountAndSync, loginAndSync, showSyncPopup, leaderboard
9. **Customization** - Theme editor with 20+ colors, 22+ patterns, fonts
10. **Onboarding** - Multi-step guided tours

## Benefits of Current Structure

1. **Organization**: Logical separation with dedicated folders
2. **Maintainability**: CSS, config, and JS are independent files
3. **Better Caching**: Browser caches CSS and JS separately
4. **Clean HTML**: index.html is just 144 lines (was 6027)
5. **Preserved Backup**: Original monolithic file available as index-old.html

## Why Single JS File?

While the application could be split into multiple modules (deck-loader.js, card-renderer.js, fsrs.js, profile.js, sync.js, customization.js, main.js), we're keeping it as a single file because:

- **No Errors**: The current single-file approach has zero syntax errors
- **Simplicity**: Easier to maintain without worrying about module dependencies
- **Well-Organized**: Code is structured with clear section markers (`// ===`)
- **Performance**: One HTTP request instead of 8 separate module loads
- **Less Complexity**: No need to manage cross-module variable access

The code within app.js is organized with clear boundaries that make navigation easy even in a single file.

## File Sizes

| File | Size | Purpose |
|------|------|---------|
| index.html | ~8 KB | HTML structure |
| config.js | ~1 KB | Firebase setup |
| styles.css | ~25 KB | All styles |
| js/app.js | ~314 KB | All JavaScript |
| **Total** | **~348 KB** | Complete app |

*Note: app.js in root folder is no longer needed - it's now in js/ folder*

## Development Notes

- All code uses global scope (traditional script tags, not ES6 modules)
- Functions are available globally
- Global state is declared at the top of app.js
- Firebase configuration loads first via config.js
- Load order: Firebase CDN → config.js → KaTeX CDN → styles.css → app.js
- The application works entirely client-side with no backend required

# Fab'Anki - File Structure

The application has been organized with separate files for configuration, styles, and JavaScript.

## Current Structure

```
Fab'Anki/
├── index.html (144 lines, ~8 KB)      - Clean HTML structure
├── config.js (27 lines, ~1 KB)        - Firebase configuration
├── styles.css (709 lines, ~25 KB)     - All CSS styles
├── js/
│   └── app.js (5504 lines, ~314 KB)   - Complete application logic
├── decks/                              - Flashcard XML files
└── index-old.html                      - Original monolithic backup
```

## File Descriptions

### index.html (~8 KB)
- Clean HTML structure with external CSS and JS references
- Contains only the page layout and DOM elements
- Links to Firebase CDN, KaTeX CDN, and local modules

### config.js (~1 KB)
- Firebase project configuration
- Firebase initialization logic
- Sets up:
  - `window.__fabanki_firebaseConfig`
  - `window.__fabanki_firestore`
  - `window.__fabanki_auth`

### styles.css (~25 KB)
- All CSS styles extracted from original file
- CSS variables for theming (light/dark mode)
- Responsive design rules
- Animation keyframes (fade, bounce, rotate, spring, etc.)
- Component-specific styles

### js/app.js (~314 KB)
**Complete application logic organized into logical sections:**

1. **Initialization & State** - Global variables and application state
2. **Deck Loading** - loadDeckFromURL, loadMultipleDeckCards, parseXMLDeck
3. **Card Rendering** - renderFront, renderBack, buildFieldElement, renderKaTeX
4. **Deck Browser UI** - showDeckOverview with pie chart and card grid
5. **FSRS Scheduling** - initFSRS, scheduleCard, getDueCards, updateHistogram
6. **Main Event Handlers** - DOMContentLoaded, button listeners, swipe gestures
7. **Profile & XP System** - showProfilePopup, level calculations, missions
8. **Firebase Sync** - createAccountAndSync, loginAndSync, showSyncPopup, leaderboard
9. **Customization** - Theme editor with 20+ colors, 22+ patterns, fonts
10. **Onboarding** - Multi-step guided tours

## Benefits of Current Structure

1. **Organization**: Logical separation with dedicated folders
2. **Maintainability**: CSS, config, and JS are independent files
3. **Better Caching**: Browser caches CSS and JS separately
4. **Clean HTML**: index.html is just 144 lines (was 6027)
5. **Preserved Backup**: Original monolithic file available as index-old.html

## Why Single JS File?

While the application could be split into multiple modules (deck-loader.js, card-renderer.js, fsrs.js, profile.js, sync.js, customization.js, main.js), we're keeping it as a single file because:

- **No Errors**: The current single-file approach has zero syntax errors
- **Simplicity**: Easier to maintain without worrying about module dependencies
- **Well-Organized**: Code is structured with clear section markers (`// ===`)
- **Performance**: One HTTP request instead of 8 separate module loads
- **Less Complexity**: No need to manage cross-module variable access

The code within app.js is organized with clear boundaries that make navigation easy even in a single file.

## File Sizes

| File | Size | Purpose |
|------|------|---------|
| index.html | ~8 KB | HTML structure |
| config.js | ~1 KB | Firebase setup |
| styles.css | ~25 KB | All styles |
| js/app.js | ~314 KB | All JavaScript |
| **Total** | **~348 KB** | Complete app |

*Note: app.js in root folder is no longer needed - it's now in js/ folder*

## Development Notes

- All code uses global scope (traditional script tags, not ES6 modules)
- Functions are available globally
- Global state is declared at the top of app.js
- Firebase configuration loads first via config.js
- Load order: Firebase CDN → config.js → KaTeX CDN → styles.css → app.js
- The application works entirely client-side with no backend required
