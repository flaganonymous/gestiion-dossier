# Arts Martiaux — thème Shopify multi-marques

Thème Shopify (Online Store 2.0) du site principal **Arts Martiaux** (voir [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)) : une seule boutique, un seul panier, plusieurs marques (Fighter, Best Sport, Daedo…), chacune avec sa page, sa couleur, son logo et, en option, son propre nom de domaine.

Univers visuel : fond noir profond, rouge Fighter, typographie condensée géante, coupes en biais, animations au scroll.

## Ce que fait le thème

| Pour vendre plus | Où |
|---|---|
| Barre « livraison offerte » qui se remplit dans le panier | Panier latéral + page panier |
| « Complète ton équipement » (bandages, protège-dents…) dans le panier | Paramètres du thème › Panier |
| Ajout rapide au panier depuis les cartes produit (choix de taille au survol) | Toutes les grilles |
| Badges automatiques : -XX %, NOUVEAU, MADE IN EU, DERNIERS ARTICLES | Cartes produit (tags `__label:New`, `__label2:Made in EU`) |
| Stock en temps réel « Plus que 2 en stock » | Fiche produit |
| Barre d'achat collante au scroll, paiement express, guide des tailles | Fiche produit |
| Produits recommandés / complémentaires | Sous la fiche produit |
| Compte à rebours promo avec code copiable | Section « Compte à rebours » |
| Recherche instantanée (produits + collections) | Loupe de l'en-tête |
| Filtres de collection sans rechargement | Pages collection (app Search & Discovery) |
| Newsletter avec tag par marque | Section « Newsletter » |

## Sections disponibles

Héro cinématique (image/vidéo) · Bandeau défilant XXL · **Univers de marques** · **Héro de marque** · Collection en vedette (onglets) · Grille disciplines · Produit héros (points interactifs) · Chiffres clés animés · Compte à rebours · Ambassadeurs & avis · Réassurance · Image avec texte · Texte · Newsletter.

## Installation

1. Créer une archive : `zip -r fighter-arena.zip assets config layout locales sections snippets templates`
2. Shopify › Boutique en ligne › Thèmes › Ajouter un thème › Importer un fichier ZIP.
3. **Ne pas publier tout de suite** : cliquer « Personnaliser » pour configurer et prévisualiser.

Ou avec Shopify CLI : `shopify theme push --unpublished --store fighterfrance.myshopify.com`

## Configurer les marques (univers)

**Paramètres du thème › Univers & marques** — jusqu'à 4 marques :

| Champ | Exemple (Best Sport) |
|---|---|
| Nom | Best Sport |
| Identifiant | `best-sport` |
| Fournisseur(s) Shopify | `Best Sport` (le champ « Fournisseur » des produits) |
| Domaine dédié | `bestsport.fr` |
| Couleur | `#FF6A00` |
| Logo | version claire, fond transparent |
| Page d'atterrissage | `/pages/best-sport` |
| Collection | la collection de la marque |

Tous les produits dont le fournisseur correspond reçoivent automatiquement le badge et la couleur de leur marque.

### Créer la page d'une marque

1. Boutique en ligne › Pages › Ajouter une page « Best Sport » (URL `/pages/best-sport`).
2. Modèle de thème : **page.univers**.
3. Dans les paramètres de l'univers, renseigner cette page comme « Page d'atterrissage ».

Le modèle détecte la marque tout seul (héro, couleurs, produits de la collection). Même principe pour une collection avec le modèle **collection.univers**.

## Un domaine par marque (bestsport.fr → page Best Sport)

Le thème applique l'habillage d'une marque dans trois cas :

1. **Le visiteur arrive par le domaine de la marque** (`request.host` = domaine déclaré) : habillage de la marque, et la page d'accueil renvoie vers la page de la marque.
2. **Le visiteur arrive avec `?univers=best-sport`** dans l'URL.
3. **Le visiteur visite la page ou la collection d'une marque.**

Avec l'option « Garder l'habillage pendant toute la visite » activée, il garde le logo et les couleurs Best Sport sur tout le site, panier compris. `?univers=reset` revient à l'habillage Fighter Sport.

### Option A — simple et fiable (recommandée pour démarrer)

Redirection du domaine chez le registrar (OVH, Gandi, IONOS…), en 301 :

```
bestsport.fr  →  https://fightersport.fr/pages/best-sport?univers=best-sport
```

Le visiteur voit tout de suite l'univers Best Sport, et celui-ci le suit pendant toute sa visite. La barre d'adresse affiche fightersport.fr.

### Option B — le domaine reste affiché

1. Shopify › Paramètres › Domaines › Connecter un domaine existant : `bestsport.fr`.
2. Par défaut, Shopify redirige les domaines secondaires vers le domaine principal. Pour que `bestsport.fr` reste dans la barre d'adresse, il doit être servi sans redirection (dans Shopify, en l'associant à un marché dans Paramètres › Markets).
3. Le thème détecte alors le domaine et applique l'univers Best Sport.

⚠️ À valider sur votre configuration Markets avant la mise en ligne : les marchés Shopify sont pensés par pays et par langue, pas par marque. Si ça ne convient pas, gardez l'option A.

## Structure

```
layout/       theme.liquid (détection de marque), password.liquid
sections/     toutes les sections (+ groupes en-tête / pied de page)
snippets/     product-card, price, icon, universe-*, cart-*
templates/    index, product, collection(.univers), page(.univers), cart, search…
assets/       theme.css, theme.js (vanilla, sans dépendance)
locales/      fr (défaut), en
preview/      aperçu statique HTML (non envoyé à Shopify)
```

## Vérification

```
npx @shopify/theme-check-node   # 0 erreur, 0 avertissement
```
