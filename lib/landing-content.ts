/** Contenu éditorial de la landing (FAQ réutilisée dans le balisage FAQPage). */

export const PRICE_EUROS = 19;
export const TRIAL_DAYS = 14;

export const FAQ = [
  {
    q: "Quelle valeur a la preuve face à Uber Eats, Deliveroo ou Just Eat ?",
    a: "REMIS. produit une preuve horodatée et vérifiable : photos du sac fermé, heure fixée par le serveur (pas par le téléphone), livreur, signature et une empreinte SHA-256 qui change si une seule donnée est modifiée. C'est un élément factuel solide à joindre à votre contestation ; la décision finale reste celle de la plateforme.",
  },
  {
    q: "Combien de temps prend une remise en plein rush ?",
    a: "Moins de 30 secondes, d'une main : plateforme, n° de commande, une photo, un tap sur le livreur (les livreurs récents sont mémorisés), la case « sac fermé et complet », et on maintient le bouton pour sceller.",
  },
  {
    q: "Et le RGPD ?",
    a: "Le livreur est informé à l'écran avant la signature. On ne garde que le prénom et l'initiale, la signature et les photos du sac (conseil affiché : photographier le sac, pas le visage). Aucune reconnaissance faciale. Durée de conservation réglable, 90 jours par défaut, avec purge automatique chaque nuit.",
  },
  {
    q: "Le livreur doit-il installer quelque chose ?",
    a: "Non. Il scanne un QR code et ouvre son reçu dans le navigateur, sans compte. Il peut l'enregistrer en PDF et ajouter sa propre photo de prise en charge.",
  },
  {
    q: "Et si le Wi-Fi du restaurant tombe ?",
    a: "La remise est gardée sur le téléphone et scellée automatiquement au retour du réseau. L'heure de saisie est conservée, l'heure du serveur fait foi.",
  },
  {
    q: "De quel matériel ai-je besoin ?",
    a: "Un smartphone posé au comptoir suffit. REMIS. s'installe comme une application depuis le navigateur (iPhone et Android). Chaque équipier se connecte avec son code PIN à 4 chiffres.",
  },
];

/** Emplacements de preuve sociale : à remplir avec de vrais restaurants pilotes (jamais d'avis inventés). */
export const TESTIMONIALS: { quote: string; name: string; place: string }[] = [];
export const PARTNER_LOGOS: { name: string; src: string }[] = [];
