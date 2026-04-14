# Bibliothèque des mémoires - École d'art-thérapie

Site **100 % statique** (HTML/CSS/JS/PDF) prêt pour **GitHub Pages**.

## Objectif
Créer une bibliothèque sensible et professionnelle des mémoires de promotion :
- accès protégé par mot de passe côté client (vérification par hash)
- consultation en ligne des PDF dans une visionneuse intégrée
- filtres par recherche, année, auteur/autrice, thème
- maintenance simple via un fichier de données local

## Avertissement sécurité
La protection par mot de passe est une **barrière d'accès légère** adaptée à un site statique.
Elle **ne remplace pas** une sécurité serveur forte (pas de backend, pas de contrôle d'accès côté serveur).

## Arborescence
```text
.
├── .github/workflows/deploy-pages.yml
├── .nojekyll
├── about.html
├── index.html
├── library.html
├── login.html
├── viewer.html
├── assets/
│   ├── covers/
│   │   ├── cartographie-emotions.svg
│   │   ├── corps-couleur.svg
│   │   └── traces-vivantes.svg
│   └── fonts/
│       ├── DejaVuSerif-Bold.ttf
│       ├── DejaVuSerif.ttf
│       ├── UbuntuSans-Italic-Variable.ttf
│       └── UbuntuSans-Variable.ttf
├── css/
│   └── main.css
├── data/
│   └── memoires.json
├── js/
│   ├── auth.js
│   ├── config.js
│   ├── data-store.js
│   ├── guard.js
│   ├── library.js
│   ├── login.js
│   ├── pdf-viewer.js
│   ├── site.js
│   └── viewer.js
├── pdfs/
│   ├── memoire-cartographie-emotions.pdf
│   ├── memoire-corps-couleur.pdf
│   └── memoire-traces-vivantes.pdf
└── vendor/
    └── pdfjs/
        ├── build/
        │   ├── pdf.min.mjs
        │   └── pdf.worker.min.mjs
```

## Lancer en local
Exécuter un serveur statique à la racine du projet.

### Option Python
```bash
python3 -m http.server 8000
```
Puis ouvrir : `http://localhost:8000`

## Mot de passe (démo)
Hash configuré dans `js/config.js` :
- `passwordHash` (SHA-256)

Mot de passe de démonstration actuel (à changer avant publication) :
- `demo-arthe-2026`

### Changer le hash du mot de passe
1. Générer un hash SHA-256 de votre nouveau mot de passe :
```bash
node -e "const c=require('crypto');console.log(c.createHash('sha256').update(process.argv[1]).digest('hex'))" "VOTRE_NOUVEAU_MOT_DE_PASSE"
```
2. Copier le résultat dans `js/config.js`, champ `auth.passwordHash`.
3. Commit + push.

## Ajouter un nouveau mémoire
1. Déposer le PDF dans `pdfs/`.
2. (Optionnel) Ajouter une couverture dans `assets/covers/`.
3. Ajouter une entrée dans `data/memoires.json`.

Exemple d'entrée :
```json
{
  "slug": "nouveau-memoire",
  "title": "Titre du mémoire",
  "author": "Prénom Nom",
  "year": 2026,
  "themes": ["Thème 1", "Thème 2"],
  "summary": "Résumé court...",
  "cover": "./assets/covers/ma-couverture.svg",
  "pdf": "./pdfs/mon-memoire.pdf"
}
```

Notes :
- `slug` doit être unique (utilisé dans `viewer.html?slug=...`).
- Si un champ manque, l'interface affiche un fallback propre.
- Si le PDF est absent, une erreur claire est affichée dans la visionneuse.

## Publication sur GitHub Pages
### Méthode recommandée (workflow inclus)
1. Pousser le projet sur la branche `main`.
2. Dans GitHub : `Settings > Pages`.
3. Source : `GitHub Actions`.
4. Le workflow `.github/workflows/deploy-pages.yml` déploie automatiquement.

### Alternative sans workflow
1. `Settings > Pages`.
2. Source : `Deploy from a branch`.
3. Branch : `main` + dossier `/ (root)`.

## Limites techniques (incontournables en statique)
- Les fichiers PDF restent accessibles à qui connaît leur URL.
- Le hash côté client peut être inspecté.
- La désactivation UI de téléchargement/impression réduit la facilité d'accès, sans blocage absolu.

## Stack
- HTML/CSS/JS vanilla
- PDF.js local (embarqué dans `vendor/pdfjs`)
- aucune API externe obligatoire
