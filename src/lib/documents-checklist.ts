export type SituationLogement = 'locataire' | 'proprietaire' | 'heberge'
export type SituationProfessionnelle = 'salarie' | 'retraite' | 'tns'

export interface DocumentRequis {
  id: string
  label: string
  categorie: string
  obligatoire: boolean
  conditionLogement?: SituationLogement[]
  conditionProfessionnelle?: SituationProfessionnelle[]
}

export interface CategorieDocument {
  id: string
  label: string
  icon: string
  documents: DocumentRequis[]
}

export const SITUATION_LOGEMENT_LABELS: Record<SituationLogement, string> = {
  locataire: 'Locataire',
  proprietaire: 'Propriétaire',
  heberge: 'Hébergé',
}

export const SITUATION_PROFESSIONNELLE_LABELS: Record<SituationProfessionnelle, string> = {
  salarie: 'Salarié',
  retraite: 'Retraité / Invalide',
  tns: 'Travailleur non-salarié (TNS)',
}

export const CATEGORIES_DOCUMENTS: CategorieDocument[] = [
  {
    id: 'identite',
    label: 'Identité',
    icon: 'UserRound',
    documents: [
      {
        id: 'identite_cni',
        label: "Carte d'identité recto/verso (ou passeport) en cours de validité",
        categorie: 'identite',
        obligatoire: true,
      },
      {
        id: 'identite_livret_famille',
        label: 'Livret de famille complet',
        categorie: 'identite',
        obligatoire: true,
      },
      {
        id: 'identite_contrat_mariage',
        label: 'Contrat de mariage (si concerné)',
        categorie: 'identite',
        obligatoire: false,
      },
      {
        id: 'identite_jugement_divorce',
        label: 'Jugement et convention de divorce (si concerné)',
        categorie: 'identite',
        obligatoire: false,
      },
    ],
  },
  {
    id: 'logement',
    label: 'Logement',
    icon: 'Home',
    documents: [
      // Locataire
      {
        id: 'logement_quittance_loyer',
        label: 'Dernière quittance de loyer',
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['locataire'],
      },
      {
        id: 'logement_taxe_habitation_locataire',
        label: "Dernière taxe d'habitation (recto/verso)",
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['locataire'],
      },
      {
        id: 'logement_facture_telephone_locataire',
        label: 'Facture de téléphone de moins de trois mois (fixe ou portable)',
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['locataire'],
      },
      // Propriétaire
      {
        id: 'logement_taxe_fonciere',
        label: 'Dernière taxe foncière',
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['proprietaire'],
      },
      {
        id: 'logement_fiche_descriptive_bien',
        label: 'Fiche descriptive de votre bien dûment remplie et signée',
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['proprietaire'],
      },
      {
        id: 'logement_titre_propriete',
        label: 'Titre de propriété',
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['proprietaire'],
      },
      {
        id: 'logement_taxe_habitation_proprietaire',
        label: "Dernière taxe d'habitation (recto/verso)",
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['proprietaire'],
      },
      {
        id: 'logement_facture_telephone_proprietaire',
        label: 'Facture de téléphone de moins de trois mois (fixe ou portable)',
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['proprietaire'],
      },
      // Hébergé
      {
        id: 'logement_cni_hebergeur',
        label: "Carte d'identité recto/verso de l'hébergeur",
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['heberge'],
      },
      {
        id: 'logement_attestation_hebergement',
        label: "Attestation d'hébergement manuscrite",
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['heberge'],
      },
      {
        id: 'logement_facture_telephone_hebergeur',
        label: "Facture de téléphone de moins de trois mois au nom de l'hébergeur",
        categorie: 'logement',
        obligatoire: true,
        conditionLogement: ['heberge'],
      },
    ],
  },
  {
    id: 'comptes_bancaires',
    label: 'Comptes bancaires',
    icon: 'Landmark',
    documents: [
      {
        id: 'bancaire_rib',
        label: 'RIB',
        categorie: 'comptes_bancaires',
        obligatoire: true,
      },
      {
        id: 'bancaire_releves',
        label: 'Trois derniers relevés de tous vos comptes bancaires',
        categorie: 'comptes_bancaires',
        obligatoire: true,
      },
    ],
  },
  {
    id: 'credits',
    label: 'Crédits',
    icon: 'CreditCard',
    documents: [
      {
        id: 'credits_releves_renouvelables',
        label: "Derniers relevés d'opérations de vos crédits renouvelables",
        categorie: 'credits',
        obligatoire: true,
      },
      {
        id: 'credits_amortissements_consommation',
        label: "Tableaux d'amortissements de tous vos crédits à la consommation",
        categorie: 'credits',
        obligatoire: true,
      },
      {
        id: 'credits_offres_prets_immobiliers',
        label: "Offres de prêts et tableaux d'amortissements de tous vos crédits immobiliers",
        categorie: 'credits',
        obligatoire: true,
      },
    ],
  },
  {
    id: 'activite_professionnelle',
    label: 'Activité professionnelle',
    icon: 'Briefcase',
    documents: [
      // Salarié
      {
        id: 'pro_bulletin_decembre',
        label: "Bulletin de salaire du mois de décembre de l'année dernière",
        categorie: 'activite_professionnelle',
        obligatoire: true,
        conditionProfessionnelle: ['salarie'],
      },
      {
        id: 'pro_trois_derniers_bulletins',
        label: 'Trois derniers bulletins de salaire',
        categorie: 'activite_professionnelle',
        obligatoire: true,
        conditionProfessionnelle: ['salarie'],
      },
      {
        id: 'pro_avis_imposition_salarie',
        label: "Dernier avis d'imposition",
        categorie: 'activite_professionnelle',
        obligatoire: true,
        conditionProfessionnelle: ['salarie'],
      },
      // Retraité / Invalide
      {
        id: 'pro_bulletins_pensions',
        label: 'Derniers bulletins de toutes vos pensions',
        categorie: 'activite_professionnelle',
        obligatoire: true,
        conditionProfessionnelle: ['retraite'],
      },
      {
        id: 'pro_recapitulatif_pensions',
        label: 'Dernier récapitulatif annuel de toutes vos pensions',
        categorie: 'activite_professionnelle',
        obligatoire: true,
        conditionProfessionnelle: ['retraite'],
      },
      {
        id: 'pro_avis_imposition_retraite',
        label: "Dernier avis d'imposition",
        categorie: 'activite_professionnelle',
        obligatoire: true,
        conditionProfessionnelle: ['retraite'],
      },
      // TNS
      {
        id: 'pro_declarations_2035',
        label: 'Trois dernières déclarations 2035 ou trois dernières liasses fiscales',
        categorie: 'activite_professionnelle',
        obligatoire: true,
        conditionProfessionnelle: ['tns'],
      },
      {
        id: 'pro_avis_imposition_tns',
        label: "Trois derniers avis d'imposition",
        categorie: 'activite_professionnelle',
        obligatoire: true,
        conditionProfessionnelle: ['tns'],
      },
    ],
  },
]

export function getDocumentsRequis(
  situationLogement: SituationLogement,
  situationProfessionnelle: SituationProfessionnelle
): DocumentRequis[] {
  const documents: DocumentRequis[] = []

  for (const categorie of CATEGORIES_DOCUMENTS) {
    for (const doc of categorie.documents) {
      const matchLogement =
        !doc.conditionLogement || doc.conditionLogement.includes(situationLogement)
      const matchProfessionnelle =
        !doc.conditionProfessionnelle ||
        doc.conditionProfessionnelle.includes(situationProfessionnelle)

      if (matchLogement && matchProfessionnelle) {
        documents.push(doc)
      }
    }
  }

  return documents
}
