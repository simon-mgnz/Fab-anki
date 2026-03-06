# 🎨 Guide de Création de Deck - Fab'Anki

## Vue d'ensemble

Le système de création de deck permet aux utilisateurs de créer leurs propres decks directement dans l'application Fab'Anki avec une interface intuitive et des fonctionnalités avancées.

## 🚀 Accès au Créateur de Deck

1. Ouvrez le navigateur de decks (bouton "📚 Parcourir decks")
2. Le bouton **"+ Créer un deck"** apparaît uniquement quand vous êtes à la racine (./)
3. Cliquez sur ce bouton pour ouvrir l'éditeur

## 📋 Fonctionnalités Principales

### 1. **Import XML Rapide**
- Section dépliable en haut
- Collez votre XML existant
- Import automatique avec parsing intelligent
- Détection automatique des types de champs (texte, KaTeX, TTS, code)

### 2. **Métadonnées du Deck**
- **Titre** : Nom du deck (obligatoire)
- **Chemin/Dossier** : Organisation dans ./decks/ (ex: "Anglais/")
- **Coût** : Prix en crédits pour débloquer le deck (0 = gratuit)
- **Niveau requis** : Niveau minimum pour accéder au deck (0 = pas de restriction)

### 3. **Modes Disponibles**
Sélectionnez les modes de révision compatibles avec votre deck :
- 🃏 Mode Anki (par défaut)
- ✏️ Texte à trou
- ⏱️ Timer
- 🧠 Mémoire active
- 👣 Étape par étape
- 🔄 Revers
- 🎲 Aléatoire
- ⏸️ Maintien
- 🔢 Multiple
- 🔢 Calcul
- 🔗 Associer
- ⚡ Rush

### 4. **Gestion des Cartes**

#### Ajouter une Carte
- Cliquez sur **"+ Ajouter une carte"**
- L'éditeur de carte s'ouvre automatiquement

#### Éditer une Carte
- Cliquez sur **"✏️ Éditer"** sur n'importe quelle carte
- Interface d'édition complète avec prévisualisation

#### Supprimer une Carte
- Cliquez sur **"🗑️"** avec confirmation

### 5. **Éditeur de Champs** (4 types)

#### 📝 **Texte Riche**
Éditeur WYSIWYG avec barre d'outils :
- **B** : Gras
- **I** : Italique
- **U** : Souligné
- **S** : Barré
- **•** : Liste à puces
- **1.** : Liste numérotée
- **✕** : Effacer le formatage

**Utilisation :**
1. Sélectionnez le texte
2. Cliquez sur les boutons de formatage
3. Le HTML est généré automatiquement

#### ∑ **KaTeX (Formules Mathématiques)**
Éditeur avec prévisualisation en temps réel :
- Syntaxe LaTeX standard
- Aperçu instantané sous l'éditeur
- Affichage des erreurs de syntaxe

**Exemples :**
```latex
\frac{a}{b}           → fraction
\sum_{i=1}^{n} x_i    → somme
\int_{a}^{b} f(x)dx   → intégrale
x^2 + y^2 = r^2       → équation
```

#### 💻 **Code**
Éditeur de code avec coloration syntaxique :
- Spécification du langage (javascript, python, java, etc.)
- Police monospace
- Préservation de l'indentation

**Utilisation :**
1. Entrez le nom du langage
2. Collez/écrivez votre code
3. L'indentation est automatiquement préservée

#### 🔊 **TTS (Text-to-Speech)**
Synthèse vocale avec support multilingue :
- Sélection de la langue
- 10 langues disponibles (FR, EN-US, EN-GB, ES, DE, IT, PT, RU, JA, ZH)
- Bouton **"🔊 Tester"** pour écouter
- Parfait pour l'apprentissage des langues

**Langues supportées :**
- 🇫🇷 Français
- 🇺🇸 English (US)
- 🇬🇧 English (UK)
- 🇪🇸 Español
- 🇩🇪 Deutsch
- 🇮🇹 Italiano
- 🇵🇹 Português
- 🇷🇺 Русский
- 🇯🇵 日本語
- 🇨🇳 中文

### 6. **Système de Brouillon Automatique**

#### Sauvegarde Automatique
- Sauvegarde auto à chaque modification
- Protection contre les pertes de données
- Persistance pendant 7 jours

#### Boutons de Brouillon
- **💾 Brouillon** : Force la sauvegarde immédiate
- **📂 Charger** : Restaure le dernier brouillon
- Notification automatique si un brouillon existe

#### Restauration au Démarrage
- Détection automatique de brouillon au chargement
- Popup de confirmation pour restaurer
- Affiche la date de sauvegarde

### 7. **Aperçu et Export**

#### 👁️ Aperçu XML
- Génération XML en temps réel
- Vue complète du fichier généré
- Vérification avant publication

#### Fonctions d'Export
- **📋 Copier** : Copie le XML dans le presse-papier
- **⬇️ Télécharger** : Télécharge le fichier .xml
- Nom de fichier automatique basé sur le titre

### 8. **Publication du Deck**

#### 🚀 Publier le Deck
Processus de publication en 3 étapes :

1. **Validation**
   - Vérification du titre (obligatoire)
   - Vérification qu'au moins une carte existe
   - Validation des champs

2. **Upload Firebase**
   - Envoi vers la collection `deck_submissions`
   - Informations stockées :
     - Titre, chemin, coût, niveau
     - Modes disponibles
     - Contenu XML complet
     - Nombre de cartes
     - Pseudo du créateur
     - Date de soumission
     - Statut : "pending"

3. **Notification Développeur**
   - Le deck est ajouté à une file d'attente
   - Le développeur reçoit une notification
   - Révision et validation manuelle
   - Ajout au catalogue officiel

#### Fallback Local
Si Firebase n'est pas disponible :
- Téléchargement automatique du fichier XML
- Possibilité de soumettre manuellement plus tard

## 📝 Format XML Généré

```xml
<?xml version="1.0" encoding="UTF-8"?>
<deck>
  <title>Titre du Deck</title>
  <tags>anki,fillblank,timer</tags>
  <cost>50</cost>
  <level>5</level>
  
  <card>
    <Face><![CDATA[Question en texte riche avec <b>format</b>]]></Face>
    <Revers katex="true"><![CDATA[\frac{a}{b}]]></Revers>
    <Note tts="fr-FR"><![CDATA[Texte à lire en français]]></Note>
    <Code lang="python"><![CDATA[
def hello():
    print("Hello World")
    ]]></Code>
  </card>
  
  <card>
    <!-- Plus de cartes... -->
  </card>
</deck>
```

## 🎯 Workflow Recommandé

### Création d'un Nouveau Deck

1. **Planification**
   - Définir le sujet et objectif
   - Choisir les modes appropriés
   - Décider du coût/niveau si marketplace

2. **Métadonnées**
   - Remplir titre et chemin
   - Configurer coût et niveau
   - Sélectionner les modes

3. **Création des Cartes**
   - Ajouter carte par carte
   - Utiliser les types de champs appropriés
   - Prévisualiser (KaTeX) ou tester (TTS)

4. **Révision**
   - Générer l'aperçu XML
   - Vérifier le formatage
   - Tester localement si possible

5. **Publication**
   - Publier vers Firebase
   - Ou télécharger pour validation manuelle

### Import d'un Deck Existant

1. **Préparation**
   - Avoir le XML valide prêt
   - Vérifier la structure

2. **Import**
   - Ouvrir le créateur
   - Déplier "🔄 Importer un fichier XML"
   - Coller le XML
   - Cliquer "Importer XML"

3. **Ajustements**
   - Modifier les métadonnées si besoin
   - Ajuster les cartes
   - Corriger les types de champs

4. **Publication**
   - Même processus que création nouvelle

## 🔒 Sécurité et Validation

### Validation Côté Client
- Titre obligatoire
- Au moins une carte requise
- Vérification des types de champs

### Validation Firebase (Serveur)
- Limitation de taille
- Vérification du format XML
- Statut "pending" par défaut
- Révision manuelle obligatoire

### Protection des Données
- Brouillon local seulement
- Pas de données sensibles dans Firebase
- Pseudo anonymisé si nécessaire

## 💡 Astuces et Bonnes Pratiques

### Nommage
- Utilisez des titres descriptifs
- Organisez par dossiers logiques (langue, matière)
- Évitez les caractères spéciaux dans les noms

### Champs
- **Face** et **Revers** sont les standards
- Ajoutez des champs additionnels pour contexte
- Utilisez TTS pour la prononciation
- KaTeX pour toutes les formules mathématiques

### Modes
- Activez plusieurs modes pour plus de flexibilité
- "anki" est le mode de base (toujours inclure)
- Modes spéciaux (Rush, Associer) nécessitent structure spécifique

### Performance
- Évitez trop d'images lourdes
- Préférez KaTeX aux images pour les formules
- TTS est léger et efficace

### Testabilité
- Testez le TTS avant publication
- Vérifiez le rendu KaTeX dans l'aperçu
- Utilisez le download pour tester localement

## 🐛 Dépannage

### Le bouton "Créer un deck" n'apparaît pas
- Vérifiez que vous êtes à la racine (pas dans un sous-dossier)
- Rafraîchissez le navigateur de decks
- Vérifiez la console (F12) pour erreurs

### L'import XML échoue
- Vérifiez la validité du XML
- Assurez-vous qu'il y a des balises `<card>`
- Regardez la console pour le message d'erreur exact

### Le brouillon ne se charge pas
- Vérifiez le localStorage (F12 > Application > Local Storage)
- Clé : `fabanki:deck_draft`
- Peut expirer après 7 jours

### KaTeX ne s'affiche pas
- KaTeX doit être chargé (vérifie ta connexion)
- Syntaxe LaTeX correcte ?
- Regardez l'erreur dans l'aperçu

### TTS ne fonctionne pas
- Nécessite un navigateur récent
- Vérifiez les permissions audio
- Certaines langues peuvent ne pas être disponibles

### Publication échoue
- Vérifiez la connexion Firebase
- Vérifiez la console pour erreurs
- Utilisez le téléchargement comme fallback

## 📊 Statistiques et Limites

### Limites Techniques
- **Taille max XML** : ~1MB recommandé
- **Nombre de cartes** : Illimité (mais ~500 max recommandé)
- **Champs par carte** : Illimité
- **Durée brouillon** : 7 jours

### Performance
- Import XML : < 1 seconde pour < 1000 cartes
- Génération XML : Instantané
- Upload Firebase : 2-5 secondes

## 🔮 Fonctionnalités Futures Possibles

- Éditeur markdown
- Support d'images avec upload
- Prévisualisation de carte complète
- Import depuis Anki (.apkg)
- Collaboration multi-utilisateurs
- Modèles de cartes prédéfinis
- Statistiques d'utilisation
- Système de notation des decks

## 📞 Support

En cas de problème :
1. Vérifiez la console (F12)
2. Sauvegardez votre brouillon
3. Téléchargez le XML en backup
4. Contactez le développeur avec :
   - Description du problème
   - Console logs
   - XML si pertinent

---

**Version** : 2.0.25
**Date** : Mars 2026
**Auteur** : Fab'Anki Development Team with Copilot
