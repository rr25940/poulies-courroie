# Google Play listing: texts and form answers

Copy each block into Play Console. Limits: name 30 characters, short description 80, full description 4 000.

## Files to upload

| Play Console field | File |
|---|---|
| App icon (512 × 512) | `android/store/icon-512.png` |
| Feature graphic (1024 × 500) | `android/store/feature-graphic-fr.png` (English listing: `feature-graphic-en.png`) |
| Phone screenshots (French) | `android/store/screenshots/fr-*.png` (4 images) |
| Phone screenshots (English) | `android/store/screenshots/en-*.png` (2 images, add 2 more if you want) |
| App bundle | `android/dist/poulies-courroies-1.0.0-1.aab` (built by `android/build-aab.ps1`) |

## Store listing — French (default language: fr-FR)

**App name**
```
Poulies-courroies
```

**Short description**
```
Dimensionnez vos courroies trapézoïdales et crantées pas à pas.
```

**Full description**
```
Poulies-courroies reprend la démarche de calcul du cours « Système poulies et courroies » et la rend interactive. Changez une donnée : chaque étape se recalcule et la transmission animée se redessine à l'échelle.

Courroies trapézoïdales (Z, A, B, C, D, E)
• Facteur de service Ks à choisir directement dans le tableau
• Choix de la section sur le graphe 1, avec votre point de fonctionnement
• Diamètres primitifs normalisés et vitesse de la courroie
• Entraxe, longueur primitive normalisée et entraxe réel
• Puissance de base Pb lue dans le tableau 4, cases d'interpolation surlignées
• Coefficients Kθ et KL sur les graphes 2 et 3
• Nombre de courroies, désignation (ex. 3 × B1668) et efforts dans les brins

Courroies crantées (XL, L, H, XH, XXH)
• Type de courroie sur le graphe 4
• Nombre de dents des poulies, vitesse et longueur
• Puissance de base sur le graphe 5, dents en prise et Kz
• Largeur et Kb, avec la désignation ISO 5296

Pour apprendre et vérifier
• Toutes les formules sont affichées avec vos valeurs
• Chaque choix automatique peut être remplacé par le vôtre
• Les vérifications du cours (entraxe, angle d'enroulement, vitesse…) sont signalées étape par étape
• Interface en français et en anglais

Aucun compte, aucune publicité, aucune donnée personnelle collectée.
```

## Store listing — English (add translation: en-US)

**Short description**
```
Size V-belts and timing belts step by step, with the course charts.
```

**Full description**
```
Poulies-courroies turns the sizing method of the course "Pulley and belt systems" into an interactive tool. Change any value: every step recomputes and the animated drive is redrawn to scale.

Classic V-belts (Z, A, B, C, D, E)
• Service factor Ks picked straight from the table
• Belt section chosen on chart 1, with your operating point
• Standard pitch diameters and belt speed
• Centre distance, standard pitch length and actual centre distance
• Basic power Pb from table 4, with the interpolation cells highlighted
• Kθ and KL factors on charts 2 and 3
• Number of belts, designation (e.g. 3 × B1668) and belt tensions

Timing belts (XL, L, H, XH, XXH)
• Belt type on chart 4
• Pulley tooth counts, belt speed and length
• Basic power on chart 5, teeth in mesh and Kz
• Width and Kb, with the ISO 5296 designation

Learn and check
• Every formula is shown with your values
• Every automatic choice can be replaced by your own
• The course checks (centre distance, wrap angle, speed…) are flagged step by step
• French and English interface

No account, no ads, no personal data collected.
```

## Store settings

| Field | Answer |
|---|---|
| App or game | App |
| Free or paid | Free |
| Category | Education |
| Tags | Education, Engineering / Science, Calculator |
| Contact email | *your email (shown publicly on the listing)* |
| Website | *your site, e.g. https://poulies-courroies.onrender.com* |
| Privacy policy | *your site* + `/privacy`, e.g. https://poulies-courroies.onrender.com/privacy |

## App content (Policy → App content)

| Section | Answer |
|---|---|
| Privacy policy | the `/privacy` URL above |
| Ads | No, the app does not contain ads |
| App access | All functionality is available without any special access |
| Content rating | Category **Reference, news or educational**; answer **No** to every question (violence, sexuality, language, drugs, gambling, user interaction, location sharing, purchases). Expected rating: Everyone / PEGI 3 |
| Target audience | 16–17 and 18 and over (do **not** tick ages under 13) |
| News app | No |
| Data safety | **No** data collected, **no** data shared. The app has no account system |
| Advertising ID | No, the app does not use an advertising ID |
| Government app | No |
| Financial features | My app doesn't provide any financial features |
| Health | My app does not have any health features |

The Data safety answer is accurate as long as access logs stay off (`ACCESS_LOG` unset), which is the default in `gunicorn.conf.py`.
