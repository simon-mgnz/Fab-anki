# Guide PWA - Fab'Anki

## 📱 Application Web Progressive (PWA)

Fab'Anki est maintenant une **Progressive Web App (PWA)** complète ! Cela signifie que vous pouvez l'installer sur votre appareil et l'utiliser comme une application native, même hors ligne.

## ✨ Fonctionnalités PWA

### 🔌 Mode Hors Ligne
- **Cache automatique** : Les assets (CSS, JS, images) et les decks sont mis en cache lors de la première visite
- **Stratégie cache-first** : Les fichiers statiques sont servis depuis le cache pour un chargement ultra-rapide
- **Données locales** : Toutes vos données utilisateur (progression, statistiques, crédits) sont stockées localement dans IndexedDB

### 🔄 Synchronisation Automatique
- **File d'attente offline** : Les actions effectuées hors ligne sont automatiquement mises en file d'attente
- **Sync automatique** : Dès que vous êtes de retour en ligne, toutes les actions en attente sont synchronisées
- **Indicateur visuel** : Un indicateur en haut à gauche vous montre votre statut (en ligne/hors ligne) et le nombre d'actions en attente

### 📥 Installation sur Différents Appareils

#### Android (Chrome/Edge)
1. Ouvrez Fab'Anki dans Chrome ou Edge
2. Appuyez sur le menu (⋮) en haut à droite
3. Sélectionnez **"Installer l'application"** ou **"Ajouter à l'écran d'accueil"**
4. Confirmez l'installation

#### iPhone/iPad (Safari)
1. Ouvrez Fab'Anki dans **Safari** (important !)
2. Appuyez sur le bouton **Partager** (□↑) en bas de l'écran
3. Faites défiler et appuyez sur **"Sur l'écran d'accueil"**
4. Appuyez sur **"Ajouter"** en haut à droite

⚠️ **Note importante pour iOS** : L'installation ne fonctionne que dans Safari, pas dans Chrome iOS ou d'autres navigateurs.

#### Ordinateur (Chrome/Edge/Opera)
1. Ouvrez Fab'Anki dans votre navigateur
2. Cliquez sur l'icône d'installation (⊕) dans la barre d'adresse
3. Ou : Menu (⋮) → **"Installer Fab'Anki"**
4. Confirmez l'installation

### 🔔 Notifications et Mises à Jour

#### Mises à jour automatiques
- Le Service Worker vérifie automatiquement les mises à jour toutes les heures
- Une notification apparaît quand une nouvelle version est disponible
- Vous pouvez choisir de mettre à jour immédiatement ou plus tard

#### Gestion du cache versionnée
- Le cache est versionné (`fabanki-v1.0.0`) pour éviter les conflits
- Les anciennes versions du cache sont automatiquement supprimées
- Pas besoin de vider manuellement le cache !

### 📊 Indicateur En Ligne/Hors Ligne

Un indicateur apparaît en haut à gauche de l'écran :
- **🟢 En ligne** : Vous êtes connecté à Internet
- **🔴 Hors ligne** : Pas de connexion Internet
- **X en attente** : Nombre d'actions en file d'attente pour synchronisation

### 💾 Stockage Local

#### IndexedDB
Toutes les données sont stockées localement :
- `offlineQueue` : File d'attente des actions hors ligne
- `userData` : Données utilisateur (progression, statistiques, etc.)

#### localStorage
- Progression FSRS
- Statistiques
- Crédits et XP
- Préférences utilisateur
- Mode de révision

### 🛠️ Stratégies de Cache

#### Cache-First (Assets statiques + Decks)
```
Cache → Réseau (si non trouvé)
```
Utilisé pour :
- HTML, CSS, JavaScript
- Images, icônes
- Fichiers de deck (.xml, .json)

#### Network-First (Sync et API)
```
Réseau → Cache (si échec)
```
Utilisé pour :
- Requêtes de synchronisation
- API externes (Firebase, etc.)

#### Stale-While-Revalidate (Autres ressources)
```
Cache (immédiat) + Mise à jour en arrière-plan
```
Utilisé pour le reste.

### 📱 Tutoriel d'Installation

Un tutoriel complet est disponible dans l'application :
1. Ouvrez le menu **Profile** (👤)
2. Cliquez sur le bouton **📱** (Installer l'app)
3. Suivez les instructions pour votre appareil

### 🔧 Fichiers Techniques

#### Manifest PWA : `/app-manifest.json`
Configuration de l'application :
- Nom : "Fab Anki"
- Mode d'affichage : standalone
- Thème : #0066ff
- Icônes : 192x192 et 512x512

#### Service Worker : `/service-worker.js`
- Gestion du cache versionné
- Stratégies de cache intelligentes
- File d'attente offline
- Synchronisation automatique

### 🚀 Avantages de la PWA

✅ **Installation facile** : Pas besoin de passer par un app store
✅ **Léger** : Pas de téléchargement volumineux
✅ **Toujours à jour** : Mises à jour automatiques
✅ **Hors ligne** : Fonctionne sans Internet
✅ **Multi-plateforme** : Un seul code pour tous les appareils
✅ **Sync automatique** : Pas de perte de données
✅ **Rapide** : Cache intelligent pour performances optimales

### 🐛 Dépannage

#### L'installation ne fonctionne pas sur iOS
- Vérifiez que vous utilisez **Safari** (pas Chrome)
- Assurez-vous d'être sur la dernière version d'iOS
- Si le bouton "Sur l'écran d'accueil" n'apparaît pas, réessayez avec le bouton Partager

#### Les données ne se synchronisent pas
- Vérifiez votre connexion Internet
- Regardez l'indicateur en haut à gauche pour voir le nombre d'actions en attente
- La synchronisation démarre automatiquement quand vous revenez en ligne

#### Le cache est trop ancien
- Le cache se met à jour automatiquement
- Si vous voulez forcer une mise à jour : rechargez la page quand la notification apparaît
- En dernier recours : videz le cache du navigateur et rechargez

### 📝 Remarques Importantes

1. **Première visite** : La première fois, tous les fichiers sont téléchargés et mis en cache
2. **Taille du cache** : Les decks sont mis en cache individuellement au fur et à mesure de leur utilisation
3. **Compatibilité** : Fonctionne sur tous les navigateurs modernes (Chrome, Edge, Safari, Firefox, Opera)
4. **Sécurité** : Nécessite HTTPS en production (fonctionne en localhost sans HTTPS)

### 🎓 Pour les Développeurs

#### Structure du projet
```
/
├── index.html              # Point d'entrée
├── app-manifest.json       # Manifest PWA
├── service-worker.js       # Service Worker
├── js/
│   └── app.js             # Application principale + PWA logic
├── css/
│   └── styles.css         # Styles
└── decks/
    ├── manifest.json      # Manifest des decks
    └── ...                # Fichiers de deck
```

#### Modifier la version
Dans `service-worker.js`, changez :
```javascript
const VERSION = '1.0.0'; // Incrémentez pour forcer une mise à jour
```

#### Tester localement
```bash
# Servir avec un serveur local
python -m http.server 8000
# Ou
npx serve
```

Puis ouvrez : `http://localhost:8000`

---

**Fait avec ❤️ pour l'apprentissage efficace !**
