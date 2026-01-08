Fab'Anki — Hébergement sur GitHub Pages

Prérequis et instructions rapides pour publier `index.html` via GitHub Pages:

- Créer un dépôt GitHub et pousser le contenu du projet (tous les fichiers y compris `index.html` et le dossier `decks/`).
- Activer GitHub Pages dans les paramètres du dépôt: Settings → Pages → Source: `main` branch → `/ (root)` puis Enregistrer.
- Après publication, votre site sera accessible à `https://<votre-utilisateur>.github.io/<votre-repo>/`.

Notes importantes:
- Le navigateur côté client ne peut pas écrire directement dans le répertoire `./decks/` sur le serveur; l'interface "Charger" ouvre un sélecteur de fichiers local pour charger des decks côté client seulement. Pour permettre l'upload depuis l'interface, il faut implémenter un endpoint serveur (ex: simple upload POST) qui écrit les fichiers dans `./decks/`.
- La fonctionnalité "Parcourir decks" tente d'utiliser l'index de répertoire renvoyé par le serveur (listing HTML). GitHub Pages n'affiche généralement pas l'index des dossiers; pour une liste fiable, fournissez un fichier `decks/manifest.json` contenant la liste des decks et leurs chemins, et modifiez l'app pour charger ce manifest plutôt que d'analyser le listing HTML.

Recommandation pour production:
- Ajouter `decks/manifest.json` formaté ainsi:

  [
    "Chap8.xml",
    "subfolder/Chap9.xml"
  ]

- Puis adapter l'appel `fetchDirectory('./decks/')` dans `index.html` pour charger `./decks/manifest.json` si présent.

Si tu veux, je peux générer un exemple `decks/manifest.json` et patcher `index.html` pour l'utiliser automatiquement si présent.

© Fab'Anki
