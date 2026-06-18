# Application de satisfaction patient - Laboratoire AMANA

Application web interne pour collecter les avis patients de manière anonyme.

## Pages
- Enquête tablette : `/index.html?source=tablette`
- Enquête QR Code : `/index.html?source=qr`
- Espace admin : `/admin.html`

## Fichiers
- `index.html`, `style.css`, `app.js` : application patient
- `admin.html`, `admin.css`, `admin.js` : tableau de bord qualité
- `firebase.js` : configuration Firebase
- `firestore.rules` : règles de sécurité à copier dans Firebase
- `assets/logo-amana.png` : logo officiel

## Important avant utilisation finale
1. Activer Firebase Authentication avec Email/Password.
2. Créer l'utilisateur admin.
3. Remplacer `REMPLACER_PAR_TON_EMAIL` dans `firestore.rules` par l'email admin.
4. Copier les règles dans Firebase > Firestore > Rules.
5. Publier l'application sur Vercel.
