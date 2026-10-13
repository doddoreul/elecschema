# Guide des Règles RGIE - Installation Électrique Résidentielle
*Dossier Technique & Spécifications Structurées pour Agent IA*  
*Basé sur le RGIE (Livre 1 - Installations à basse tension et à très basse tension pour les unités d'habitation)*

---

## 1. Périmètre & Paramètres Généraux
- **Champ d'application** : Unités d'habitation (maisons, appartements) - Installations domestiques à basse tension (BT) et très basse tension (TBT) [14, 15].
- **Tensions nominales admissibles** :
  - Basse Tension (BT) : $U_n \le 1000\text{ V AC}$ / $1500\text{ V DC}$ [1].
  - Très Basse Tension (TBT) : $U_n \le 50\text{ V AC}$ / $120\text{ V DC}$ [52].
  - Fréquence nominale : $\le 10\,000\text{ Hz}$ [15].
- **Régime de neutre standard** : Schéma TT (Neutre de la distribution relié à la terre, masses privées reliées à une prise de terre propre) [8, 59].

---

## 2. Prise de Terre & Liaisons Équipotentielles

### 2.1. Résistance de Dispersion ($R_E$)
- **Conformité optimale** : $R_E \le 30\ \Omega$ [62].
- **Conformité sous réserve** : $30\ \Omega < R_E \le 100\ \Omega$ [62].
  - *Condition impérative* : Protection différentielle à haute sensibilité ($30\text{ mA}$) étendue à tous les circuits d'éclairage et tous les circuits comportant des socles de prises de courant (groupes de max. 16 socles par $30\text{ mA}$) [62].
- **Non-conforme (refus de réception)** : $R_E > 100\ \Omega$ pour une installation domestique [62].

### 2.2. Éléments de la Prise de Terre
- **Constituants** : Boucle de terre sous fondations (cuivre nu $\ge 35\text{ mm}^2$ ou acier galvanisé) ou piquet(s) de terre [21, 109].
- **Sectionneur de terre** : Obligatoire pour isoler la prise de terre lors des mesures de résistance [21].
- **Borne principale de terre** : Reçoit le conducteur de terre et la liaison équipotentielle principale [21, 56].

### 2.3. Liaisons Équipotentielles Principales (LEP)
- **Raccordements obligatoires** : Canalisations métalliques principales d'eau, de gaz, de chauffage central et éléments métalliques de la structure du bâtiment [21, 56].
- **Section minimale du conducteur d'équipotentialité** : $6\text{ mm}^2$ en cuivre (au moins égale à la moitié du plus gros conducteur de protection, hors conducteur de terre) [111].

---

## 3. Dispositifs de Protection Différentielle (DDR)

### 3.1. Caractéristiques Générales
- **Type obligatoire** : Type A au minimum (les différentiels de type AC sont interdits en nouvelle installation) [100].
- **Sensibilité au court-circuit** : Tenue aux courants de court-circuit minimale de $3000\text{ A}$ / $22,5\text{ kA}^2\text{s}$ [106].
- **Incapacité de manoeuvre** : Dispositifs à sécurité positive [102].

### 3.2. Différentiel Général (À l'origine de l'installation)
- **Sensibilité maximale** : $300\text{ mA}$ [62].
- **Inaccessibilité & Plombage** : Les bornes d'entrée du différentiel général doivent être scellées/plombées par l'organisme agréé lors du contrôle de conformité [62, 121].
- **Intensité nominale minimale** : $40\text{ A}$ [97, 100].

### 3.3. Différentiel Haute Sensibilité ($30\text{ mA}$)
- **Obligation systématique** pour les circuits alimentant :
  1. Salles de bains et salles de douches [63].
  2. Lave-linge (lessiveuse) [63].
  3. Lave-vaisselle [63].
  4. Sèche-linge [63].
- **Raccordement** : Subordonné (en cascade) au différentiel général de $300\text{ mA}$ [63].

---

## 4. Circuits, Section des Conducteurs & Protections Contre les Surintensités

### 4.1. Calibre des Disjoncteurs & Sections de Câbles (Tableau 4.11)

| Usage / Circuit | Section Min. Cuivre | Disjoncteur Max. | Fusible Max. |
| :--- | :--- | :--- | :--- |
| **Circuit Éclairage pur** | $1,5\text{ mm}^2$ | $16\text{ A}$ | $10\text{ A}$ |
| **Circuit Prises / Circuit Mixte** | $2,5\text{ mm}^2$ | $20\text{ A}$ | $16\text{ A}$ |
| **Appareil dédié** (ex: four, machine) | $2,5\text{ mm}^2$ | $20\text{ A}$ | $16\text{ A}$ |
| **Gros appareil dédié** (ex: cuisinière) | $4\text{ mm}^2$ | $25\text{ A}$ | $20\text{ A}$ |
| **Ligne de puissance / Taque** | $6\text{ mm}^2$ | $40\text{ A}$ | $32\text{ A}$ |
| **Liaison Tableau principal** | $10\text{ mm}^2$ | $63\text{ A}$ | $50\text{ A}$ |

*Source : Section 4.4.1.5, Tableau 4.11 du RGIE Livre 1 [72].*

### 4.2. Circuits Dédies Obligatoires (Circuits Exclusifs)
Doivent être alimentés individuellement par un circuit dédié [82] :
- Lave-linge
- Lave-vaisselle
- Sèche-linge
- Cuisinière électrique / Taque de cuisson
- Four électrique
- Tout appareil fixe ou machine d'une puissance nominale $P \ge 2600\text{ W}$ (ex: chauffe-eau, grosse chaudière).
- Chauffage électrique fixe (un ou plusieurs circuits dédiés).

### 4.3. Règles de Composition des Circuits
- **Limitation des prises** : Maximum **8 socles de prises de courant** par circuit (un socle peut être simple ou multiple sous la même plaque de finition) [99].
- **Circuits mixtes** : Il est autorisé d'associer prises et éclairage sur un même circuit. Chaque point lumineux compte comme 1 socle de prise (limite totale de 8 points). Le circuit doit respecter les règles des prises ($2,5\text{ mm}^2$, disjoncteur max $20\text{ A}$) [99].
- **Circuit d'éclairage** : Au moins **2 circuits distincts** d'éclairage par unité d'habitation [99].

---

## 5. Mode de Pose, Appareillage & Code Couleurs

### 5.1. Code Couleurs des Conducteurs Isolés
- **Vert-Jaune** : Strictement réservé au conducteur de protection (terre - PE) [81]. Interdiction absolue d'y faire passer du courant actif [81].
- **Bleu** : Réservé au conducteur neutre (N) [81].
  - *Exception* : Si le neutre n'est pas distribué ou présent dans le câble, le fil bleu peut servir de conducteur actif (navette, phase), mais JAMAIS de conducteur de protection [81].

### 5.2. Pose Apparente (Sur la paroi)
- **Fils VOB simples** : Interdiction absolue de poser des fils VOB nus directement sur les parois [2].
- **Pose autorisée** : Câbles multipolaires (type XVB) ou fils VOB sous conduits (tube PVC) ou goulottes à couvercle démontable avec un outil [2].
- **Distance à la paroi** : Distance entre canalisation et paroi $\le 0,3 \times$ diamètre extérieur [1].
- **Rayons de courbure minimaux des conduits** :
  - Conduit thermoplastique rigide : $5 \times$ le diamètre extérieur.
  - Conduit thermoplastique souple : $8 \times$ le diamètre extérieur.
  - Conduit métallique : $10 \times$ le diamètre extérieur.

### 5.3. Hauteur de Pose des Prises de Courant
Hauteur mesurée de l'axe des alvéoles au sol fini :
- **Locaux secs (AD1)** : Minimum $0,15\text{ m}$ [98].
- **Locaux humides/mouillés (AD2 à AD8)** : Minimum $0,25\text{ m}$ [98].

---

## 6. Emplacements Spéciaux : Salles de Bains & Douches (Chapitre 7.1)

### 6.1. Zoning de Sécurité (Volumes de Protection)
- **Volume 0** : Intérieur de la baignoire ou du receveur de douche [131].
- **Volume 1** : Volume au-dessus du Volume 0 jusqu'à une hauteur de $2,25\text{ m}$ au-dessus du sol fini (ou rayon de $0,60\text{ m}$ autour de la pomme de douche si pas de receveur) [131].
- **Volume 1bis** : Espace situé sous la baignoire fermé par une structure pleine [132].
- **Volume 2** : Volume extérieur au Volume 1, d'une largeur de $0,60\text{ m}$ et jusqu'à une hauteur de $2,25\text{ m}$ [132].
- **Volume 3** : Volume extérieur au Volume 2, d'une largeur de $2,40\text{ m}$ et jusqu'à une hauteur de $2,25\text{ m}$ [132].

### 6.2. Matériel Admis & Indices de Protection (IP)

| Volume | Matériel Autorisé | Tension Max. | Indice IP Min. |
| :--- | :--- | :--- | :--- |
| **Volume 0** | Matériel spécifique sous eau uniquement | TBTS $12\text{ V AC} / 30\text{ V DC}$ | **IPX7** [140] |
| **Volume 1** | Chauffe-eau fixe BT, matériel TBTS | TBTS $12\text{ V AC} / 30\text{ V DC}$ | **IPX4** (*IPX5 si jets*) [140, 147] |
| **Volume 2** | Luminaires fixes ($\ge 1,60\text{ m}$), radiateur Classe II, prise rasoir ($\le 100\text{ W}$) | TBTS $25\text{ V AC} / 60\text{ V DC}$ ou BT sous $10\text{ mA}$ DDR | **IPX4** [140, 148] |
| **Volume 3** | Socles de prises classiques (sous $30\text{ mA}$ DDR), interrupteurs | Basse Tension (BT $230\text{ V}$) | **IPX1** [140] |

### 6.3. Liaison Équipotentielle Supplémentaire (LES)
- **Obligation** : Connexion obligatoire de toutes les masses électriques (Volumes 0, 1, 1bis, 2, 3) et de tous les éléments conducteurs étrangers (canalisations métalliques d'eau, de gaz, chauffage, baignoire métallique) [141].
- **Section minimale** : $2,5\text{ mm}^2$ (si protégée mécaniquement) ou $4\text{ mm}^2$ (si non protégée) [112]. Couleur : Vert-Jaune [112].

---

## 7. Documentation Obligatoire & Contrôle de Conformité

### 7.1. Dossier de l'Installation Électrique
Toute installation domestique doit disposer d'un dossier comprenant :
1. **Schéma Unifilaire** : Représentation avec symboles normalisés (Tableau 2.23) [29, 38].
   - Circuits désignés par des lettres majuscules (A, B, C...) [38].
   - Points/prises/interrupteurs numérotés par ordre d'apparition (A1, A2...) [38].
   - Mentions obligatoires : Tension, type de câble (ex: XVB 3G2.5), calibre disjoncteur, adresse, signatures [37, 38, 41].
2. **Plan de Position** : Plan à l'échelle indiquant la localisation géographique des éléments identifiés sur le schéma unifilaire (ex. A1, A2, B1...) [39, 41].
3. **Rapport de Conformité** : Établi par un organisme agréé certifiant la conformité initiale ou périodique (valable 25 ans) [119, 121, 124].

### 7.2. Contrôle de la Résistance d'Isolement (Mesure)
- **Tension d'essai** : $500\text{ V DC}$ (courant continu) [119].
- **Résistance minimale admise** : $R_{iso} \ge 0,5\text{ M}\Omega$ ($500\text{ k}\Omega$) pour une tension nominale $\le 500\text{ V}$ [119].
- **Conditions du test** : Effectué hors tension, récepteurs déconnectés [119].

### 7.3. Pouvoir de Coupure & Court-Circuit
- **Courant de court-circuit présumé** : Réputé $\le 3000\text{ A}$ aux bornes du tableau général domestique [104].
- **Pouvoir de coupure minimal des disjoncteurs** : $3000\text{ A}$ (marquage 3000 encadré) avec classe de limitation d'énergie 3 [105].

---

## 8. Matrice de Décision / Liste de Contrôle pour Agent IA (Validation Automatique)

```json
{
  "rules_engine": {
    "earth_resistance": {
      "optimal_max_ohms": 30.0,
      "conditional_max_ohms": 100.0,
      "condition_if_between_30_and_100_ohms": "Require_30mA_RCD_on_all_lighting_and_socket_circuits",
      "fail_threshold_ohms": 100.0
    },
    "main_differential": {
      "max_sensitivity_mA": 300,
      "min_nominal_current_A": 40,
      "type": "A",
      "sealable_terminals_required": true
    },
    "high_sensitivity_differential": {
      "sensitivity_mA": 30,
      "mandatory_circuits": [
        "bathroom_shower",
        "washing_machine",
        "dishwasher",
        "tumble_dryer"
      ]
    },
    "circuit_limits": {
      "max_sockets_per_circuit": 8,
      "min_lighting_circuits": 2,
      "mandatory_dedicated_circuits": [
        "washing_machine",
        "dishwasher",
        "tumble_dryer",
        "electric_cooker_hob",
        "electric_oven",
        "fixed_appliances_ge_2600W",
        "fixed_electric_heating"
      ]
    },
    "cable_and_mcb_ratings": {
      "1.5mm2": {"max_mcb_A": 16, "max_fuse_A": 10, "typical_use": "lighting"},
      "2.5mm2": {"max_mcb_A": 20, "max_fuse_A": 16, "typical_use": "sockets_mixed_dedicated"},
      "4.0mm2": {"max_mcb_A": 25, "max_fuse_A": 20, "typical_use": "heavy_appliances"},
      "6.0mm2": {"max_mcb_A": 40, "max_fuse_A": 32, "typical_use": "cooker_hob_main_feed"}
    },
    "bathroom_volumes_ip": {
      "volume_0": {"max_voltage_AC": 12, "max_voltage_DC": 30, "min_ip": "IPX7"},
      "volume_1": {"max_voltage_AC": 12, "max_voltage_DC": 30, "min_ip": "IPX4"},
      "volume_2": {"max_voltage_AC": 25, "max_voltage_DC": 60, "min_ip": "IPX4"},
      "volume_3": {"max_voltage_AC": 230, "min_ip": "IPX1"}
    },
    "isolation_test": {
      "test_voltage_VDC": 500,
      "min_resistance_kOhms": 500
    }
  }
}
```
