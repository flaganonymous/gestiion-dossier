# Architecture cible — décision du 1er octobre 2026

## Décision

- **Une seule boutique Shopify** (catalogue, stock, commandes, clients, paiement), renommée **Arts Martiaux**.
- **Site principal multi-marques** : la boutique en ligne Shopify avec ce thème. Toutes les marques, un seul panier.
- **Un site par marque** (Fighter, Best Sport, Daedo…) en **Shopify Hydrogen**, chacun sur son propre domaine qui reste affiché.
- **Toutes les ventes passent par Shopify** : mêmes commandes, même stock, même back-office.

```
                 ┌──────────────────────────────┐
                 │   Boutique Shopify unique     │
                 │ catalogue · stock · commandes │
                 │      paiement (checkout)      │
                 └──────────────┬───────────────┘
        Storefront API          │          Online Store
   ┌───────────────┬────────────┼───────────────┐
   ▼               ▼            ▼               ▼
 fighter        bestsport     daedo        arts-martiaux
 (Hydrogen)     (Hydrogen)   (Hydrogen)    (thème Liquid,
 produits       produits     produits       toutes marques)
 Fighter        Best Sport   Daedo
```

## Ce que Shopify fournit

- Le canal **Hydrogen** permet de créer **plusieurs sites** reliés à la même boutique. Chaque site correspond à son propre dépôt GitHub, et Shopify peut le créer lui-même.
- L'hébergement **Oxygen** est inclus sans surcoût dans les abonnements payants. Chaque site y a son propre domaine.
- Chaque site de marque n'affiche que ses produits (filtre par fournisseur ou par collection).

## Points à trancher

1. **Achat sur les sites de marque** :
   - (a) panier sur le site de marque, puis paiement Shopify. Meilleure conversion, recommandé.
   - (b) site vitrine avec un bouton « Acheter » qui renvoie vers la fiche produit sur arts-martiaux.
2. **Nom de domaine exact** du site principal (arts-martiaux.fr ? .com ?) et des sites de marque.
3. **Avenir de fightersport.fr** : site Hydrogen de Fighter, ou redirection vers arts-martiaux.

## Étapes

1. Renommer la boutique en « Arts Martiaux », connecter le domaine principal et publier ce thème.
2. Vérifier le champ « Fournisseur » de tous les produits : c'est lui qui répartit les produits entre les sites de marque.
3. Créer le premier site Hydrogen (Fighter) depuis Shopify › Hydrogen › Créer une vitrine. C'est le gabarit des autres.
4. Décliner Best Sport et Daedo (mêmes composants, autre charte et autre filtre de marque).
