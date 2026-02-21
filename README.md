# Fab'Anki - Advanced Spaced Repetition Learning

A powerful, browser-based flashcard application with no account requirement. Features multiple study modes, XP system, marketplace, achievements, and comprehensive support for mathematical notation via KaTeX.

## Core Features

### Deck Management
- Load local XML deck files from your computer
- Browse hosted decks from `./decks/` directory
- Support for multiple concurrent decks
- Optimized manifest.json indexing system

### Study Modes
Fab'Anki features 13 distinct review modes to adapt to different learning styles and educational goals. Each mode offers unique mechanics and XP multipliers.

#### 1. **Anki Mode (Default)**
- Classic SM-2 spacing algorithm with four difficulty ratings
- Progressive answer reveal on demand
- No timer pressure, natural learning pace
- Best for: Traditional spaced repetition learning
- XP Multiplier: 1x

#### 2. **Fill-in-the-Blank (Texte à trou)**
- Premium mode (unlock via Marketplace)
- Complete missing words in sentences
- Real-time validation with letter-by-letter comparison
- Shows correct spelling of missing letters in green when revealed
- Best for: Vocabulary, spelling, and language learning
- XP Multiplier: 2x (highest reward for accuracy)

#### 3. **Timed Recall (Rappel sous pression)**
- Timer-based challenge mode with progressive visual feedback
- Face phase: colored timer (Green → Blue → Orange) with red particle effects at 75%+
- Back phase: solid blue timer (no pressure indicators)
- Shows button hints as time decreases
- Auto-advance to next card when timer expires
- Customizable time limits for front and back reveal
- Best for: Speed and under-pressure learning
- XP Multiplier: 1.2x

#### 4. **Active Memory (Mémoire active)**
- 3-second front card reveal with blue progress bar
- Front automatically hidden after 3 seconds
- Tap to reveal answer before completing the timer
- Forces memory engagement before showing hints
- Best for: Memory strength development
- XP Multiplier: 1.1x
- Free for all decks - always available

#### 5. **Step by Step (Étape par étape)**
- Guides you through each card with structured progression
- Clear sectioning of question and answer phases
- Enforces thoughtful review process
- Best for: Methodical, deliberate learning
- XP Multiplier: 1x

#### 6. **Reverse (Revers)**
- Flip the card orientation - answer appears first, question second
- Strengthens recall in both directions
- Ideal for bidirectional learning (translation pairs, definitions, etc.)
- Best for: Language learning and concept memorization
- XP Multiplier: 1x

#### 7. **Random (Aléatoire)**
- Randomizes card order in each session
- Different sequence every time you review
- Prevents sequence-dependent memorization
- Best for: Testing genuine knowledge retention
- XP Multiplier: 1.1x

#### 8. **Hold (Maintien)**
- Press and hold to reveal the answer
- Requires sustained focus to view content
- Tapping during reveal hides the answer again
- Best for: Maintaining concentration and active thinking
- XP Multiplier: 1x

#### 9. **Multiple (Mode Multiple)**
- Review multiple cards simultaneously on the same screen
- Compare multiple cards side-by-side
- Configurable number of cards to display (2-5)
- Best for: Comparative learning and differentiation
- XP Multiplier: 0.9x (challenging mode)

#### 10. **Match (Associer)**
- Pair matching exercises
- Connect related concepts, translations, or definitions
- Interactive matching interface
- Best for: Vocabulary, definitions, and concept associations
- XP Multiplier: 1x

#### 11. **Calculation (Calcul)**
- Build formulas using LaTeX syntax
- Type mathematical expressions as answers
- Automatic validation against correct formula
- Real-time feedback on formula syntax
- Best for: Mathematics and scientific notation learning
- XP Multiplier: 1x

#### 12. **Rush (Mode Rush)**
- Ultimate difficulty challenge mode (unlock via progression)
- Combination of timer pressure and difficulty scaling
- Time limits decrease as you succeed consecutively
- Fails reset difficulty back to easier times
- Configurable difficulty levels
- Best for: Extreme challenge and speed testing
- XP Multiplier: Varies with performance

#### 13. **Original (Mode Original)**
- Special mode with sequential question progression
- Multi-part questions within single cards
- Features: Fill-in-the-blank sections, sequential clarity, average scoring
- Best for: Complex cards with multiple learning objectives
- XP Multiplier: 1x

**How to Select a Study Mode:**
1. Open "Parcourir decks" to view deck list
2. Select your desired deck
3. Choose your preferred mode from the mode selector dropdown (only appears if mode is unlocked for that deck)
4. Click to start review session

Most modes are unlocked via progression and daily/weekly quests. Premium modes can be purchased from the Marketplace using in-game credits.

### Card Review System
- Minimal, distraction-free interface
- Four difficulty ratings: Easy (Facile), Good (Bon), Hard (Difficile), Again (Raté)
- Progressive answer reveal on demand
- Full Anki field support (front, back, always-show)

### XP & Leveling System
- Earn XP based on card difficulty and your answer quality
- XP multipliers vary by study mode (1x to 2x)
- Level progression with visual ring indicator
- Cumulative XP displayed in profile
- Daily and weekly XP tracking

### Leaderboard & Ranking
- Global rankings by total XP score
- Monthly leaderboard for recent activity
- Display player level, titles, and statistics
- Real-time synchronization with Firestore
- Filters by score and cards reviewed

### Titles & Achievements
Unlock mathematician-themed titles across 5 tiers:
- **Bronze Tier**: Lagrange, Laplace, Fourier, Cauchy, Riemann
- **Silver Tier**: Ramanujan, Cantor, Hilbert, Leibniz, Boole
- **Gold Tier**: Descartes, Bernoulli, Weierstrass, Dirichlet, Archimedes
- **Platinum Tier**: Euclid, Pythagoras, Al-Khwarizmi, Galois, Grothendieck
- **Diamond Tier**: Euler, Newton, Gauss, Fibonacci, Pascal

Titles are earned through specific achievements (e.g., "Gauss" for 100+ good answers). Display your selected title on the leaderboard.

### Marketplace
Purchase premium features with earned XP:
- **Fill-in-the-Blank Access**: Unlock by tier (Bronze, Silver, Gold, Platinum, Diamond)
- **XP Boosters**: Temporary multipliers for study sessions
- Purchase reflects your total XP spending; refunds adjust available balance

### Daily Missions & Streaks
- Track consecutive days of study
- Daily missions: Complete specific study objectives
- Earn bonuses for maintaining streaks and completing missions
- Progress automatically syncs when cards are reviewed

### Progress Tracking
- Visual histogram showing card distribution by due date
- Real-time progress bar during study sessions
- Detailed statistics: total cards and ready cards
- Due date categories: New, Now, <12h, Tomorrow, <1 week, Long-term
- Session stats: cards reviewed today, daily goals, streaks

### Mathematical Support
- Integrated KaTeX rendering for LaTeX formulas
- Support for inline `$...$` and display `$$...$$` notation
- Real-time formula rendering in cards and answers

### Cloud Synchronization
- Firebase integration for profile sync across devices
- Automatic progress backup to Firestore
- Leaderboard rankings automatically updated
- Anti-cheat validation to prevent suspicious activity

### Customization
- Dark mode for reduced eye strain
- Fully responsive design for all devices
- Mobile-optimized full-screen interface with enlarged touch targets
- Theme persistence across sessions

### Local Storage & Offline
- Browser-based localStorage persistence
- No server required, no account needed
- Automatic session retention across browser instances
- Works offline (sync when connection available)
- Local data reset capability

## Quick Start

### For New Users
1. Click **"Parcourir decks"** to browse available flashcard sets
2. Select a deck to begin review
3. Read the onboarding tips for your selected mode
4. Click **"Afficher la réponse"** to reveal the answer
5. Rate the difficulty: Easy, Good, Hard, or Again
6. Earn XP and progress through levels!

### Changing Study Modes
1. Open deck overview ("Parcourir decks")
2. Select your desired deck
3. Look for the mode selector dropdown
4. Choose a different mode (if available for that deck)
5. Your preference is saved per deck

### Accessing Premium Features
1. Click **"Marché"** (Marketplace) at top
2. Browse available premium features
3. Purchase Fill-in-the-Blank access for specific tiers using earned XP
4. Once purchased, the mode unlocks for decks tagged with that difficulty

## Levels & XP

Your XP earns you levels with increasing thresholds:
- Level 1-10: Novice explorer
- Level 11-20: Consistent learner
- Level 21-40: Advanced scholar
- Level 40+: Expert master

View your level, XP, and streaks in your **Profile**.

## Titles System

Unlock unique titles based on achievements:
- Study harder to increase specific metrics (good answers, cards mastered, etc.)
- Each achievement unlocks a mathematician title
- Select your favorite title from your profile
- Display it proudly on the leaderboard

## Included Decks (French)
- English Vocabulary & Idioms
- Mathematics (Chapters 1-12)
- Physics Formulas & Constants
- IT & Python
- Industrial Sciences
- French Literature

## Deployment (Self-Hosting)

### GitHub Pages Setup

1. Create a GitHub repository and push all project files (index.html and decks/ directory)
2. Enable GitHub Pages in repository settings: Settings → Pages → Source: main branch → / (root)
3. Your application will be available at `https://<username>.github.io/<repo>/`

### Firebase Setup (Optional - for leaderboards & cloud sync)

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database and Authentication
3. Add your Firebase config to `config.js`:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```
This cause a insecure leaderboard, so don't rely on it


### Important Notes

- Deck uploads via the UI load files client-side only. Server-side upload requires implementing a dedicated endpoint.
- GitHub Pages does not display directory listings by default. The `decks/manifest.json` file provides reliable deck discovery.
- Leaderboard features require Firebase configuration

## Architecture

- Single HTML file application with modular JavaScript functions
- Zero dependencies except KaTeX (served via CDN) and Firebase (optional)
- Client-side only, no server required (except optional Firebase backend)
- Persistent state via localStorage + optional Firestore sync
- Responsive CSS with theme support

## Recent Additions (Version 2.0+)

- Multi-mode study system with different mechanics per mode
- Marketplace system with purchasable content
- XP and leveling system with dynamic calculations
- Achievement-based title system
- Daily missions and streak tracking
- Cloud synchronization with Firebase
- Active Memory mode for spaced recall optimization
- Pressure Recall mode for timed challenge practice
- Fill-in-the-Blank for writing practice
- Fixed critical ReferenceError with translation system initialization
- Professional documentation without emoji decorators
- Cleaner, more enterprise-ready presentation

## License & Credits

© Fab'Anki - 2026 - MPSI1 → MPSI2

Built for efficient learning. Study hard, rank high!