# Fab'Anki - Advanced Spaced Repetition Learning

A powerful, browser-based flashcard application with no account requirement. Features multiple study modes, XP system, marketplace, achievements, and comprehensive support for mathematical notation via KaTeX.

## 🎯 Core Features

### Deck Management
- Load local XML deck files from your computer
- Browse hosted decks from `./decks/` directory
- Support for multiple concurrent decks
- Optimized manifest.json indexing system

### Study Modes
Fab'Anki includes 4 distinct review modes to adapt to different learning goals:

#### 1. **Anki Mode (Default)**
- Classic SM-2 spacing algorithm with four difficulty ratings
- Progressive answer reveal on demand
- No timer pressure, natural learning pace
- 1x XP multiplier

#### 2. **Fill-in-the-Blank (Texte à trou)**
- Premium mode (available in Marketplace)
- Complete missing words in sentences
- Real-time validation with letter-by-letter comparison
- Shows correct spelling of missing letters in green when revealed
- 2x XP multiplier (highest reward for accuracy)
- Purchasable from Marketplace (varies by difficulty tier)

#### 3. **Pressure Recall (Rappel sous pression)**
- Timer-based challenge mode
- Progressive visual feedback: Green → Blue → Orange during countdown
- Shows only the most relevant difficulty button as time passes
- Face phase: colored timer with red particle effects at 75%+
- Revers phase: solid blue timer (no pressure indicators)
- Auto-advance to next card when timer expires
- 1.2x XP multiplier

#### 4. **Active Memory (Mémoire active)**
- 3-second front card reveal with blue progress bar
- Front hidden after 3 seconds until you reveal the answer
- Forces memory engagement before showing hints
- 1.1x XP multiplier
- **Free for all decks** - always available

**How to Select a Study Mode:**
1. Click "Parcourir decks" to open deck overview
2. Select your deck
3. Choose your preferred mode from the mode selector dropdown (only appears if mode is available for that deck)
4. Click to start review with selected mode

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

### Titles & Achievements (👑 Titres)
Unlock mathematician-themed titles across 5 tiers:
- **Bronze Tier**: Lagrange, Laplace, Fourier, Cauchy, Riemann
- **Silver Tier**: Ramanujan, Cantor, Hilbert, Leibniz, Boole
- **Gold Tier**: Descartes, Bernoulli, Weierstrass, Dirichlet, Archimedes
- **Platinum Tier**: Euclid, Pythagoras, Al-Khwarizmi, Galois, Grothendieck
- **Diamond Tier**: Euler, Newton, Gauss, Fibonacci, Pascal

Titles are earned through specific achievements (e.g., "Gauss" for 100+ good answers). Display your selected title on the leaderboard.

### Marketplace (🛍️ Marché)
Purchase premium features with earned XP:
- **Fill-in-the-Blank Access**: Unlock by tier (Bronze, Silver, Gold, Platinum, Diamond)
- **XP Boosters**: Temporary multipliers for study sessions
- Purchase reflects your total XP spending; refunds adjust available balance

### Daily Missions & Streaks
- 🔥 Track consecutive days of study
- 📋 Daily missions: Complete specific study objectives
- 🎯 Earn bonuses for maintaining streaks and completing missions
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

## 🚀 Quick Start

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
1. Click **"Marché"** (🛍️ Marketplace) at top
2. Browse available premium features
3. Purchase Fill-in-the-Blank access for specific tiers using earned XP
4. Once purchased, the mode unlocks for decks tagged with that difficulty

## 📊 Levels & XP

Your XP earns you levels with increasing thresholds:
- Level 1-10: Novice explorer
- Level 11-20: Consistent learner
- Level 21-40: Advanced scholar
- Level 40+: Expert master

View your level, XP, and streaks in your **Profile** (👤).

## 🏆 Titles System

Unlock unique titles based on achievements:
- Study harder to increase specific metrics (good answers, cards mastered, etc.)
- Each achievement unlocks a mathematician title
- Select your favorite title from your profile
- Display it proudly on the leaderboard

## 📦 Included Decks (French)
- English Vocabulary & Idioms
- Mathematics (Chapters 1-12)
- Physics Formulas & Constants
- IT & Python
- Industrial Sciences
- French Literature

## 🔧 Deployment (Self-Hosting)

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

### Important Notes

- Deck uploads via the UI load files client-side only. Server-side upload requires implementing a dedicated endpoint.
- GitHub Pages does not display directory listings by default. The `decks/manifest.json` file provides reliable deck discovery.
- Leaderboard features require Firebase configuration

## 🛠 Architecture

- Single HTML file application with modular JavaScript functions
- Zero dependencies except KaTeX (served via CDN) and Firebase (optional)
- Client-side only, no server required (except optional Firebase backend)
- Persistent state via localStorage + optional Firestore sync
- Responsive CSS with theme support

## 📈 Recent Additions (Version 2.0+)

- ✨ Multi-mode study system with different mechanics per mode
- 💰 Marketplace system with purchasable content
- 📊 XP and leveling system with dynamic calculations
- 🏆 Achievement-based title system
- 🎯 Daily missions and streak tracking
- 🔄 Cloud synchronization with Firebase
- 🎨 Active Memory mode for spaced recall optimization
- ⏱️ Pressure Recall mode for timed challenge practice
- ✍️ Fill-in-the-Blank for writing practice

## 📝 License & Credits

© Fab'Anki - 2026 - MPSI1 >> MPSI2

Built for efficient learning. Study hard, rank high!
