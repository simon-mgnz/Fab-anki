# -*- coding: utf-8 -*-
"""Génère les decks MP* 2026-2027 au format Fab'Anki XML."""
from pathlib import Path
import json
import re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "decks" / "Physique" / "MP star 2026-2027"
MANIFEST = ROOT / "decks" / "manifest.json"
COUNTS = ROOT / "decks" / "card-counts.json"


def esc(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def card(front, back="", tex=""):
    f = f"<p>{esc(front)}</p>" if front else ""
    b = f"<p>{esc(back)}</p>" if back else ""
    return (
        "<card>"
        f"<rich-text name='Front'>{f}</rich-text>"
        f"<rich-text name='Back'>{b}</rich-text>"
        f"<tex name='TeX'>{esc(tex) if tex else ''}</tex>"
        "</card>"
    )


def write_deck(filename, name, cards):
    xml = (
        f"<deck name=\"{esc(name)}\" tags='Physique::MP star'>"
        "<fields>"
        "<rich-text name='Front' sides='11'></rich-text>"
        "<rich-text name='Back' sides='01'></rich-text>"
        "<tex name='TeX' sides='01'></tex>"
        "</fields>"
        f"<cards>{''.join(card(*c) if not isinstance(c, str) else c for c in cards)}</cards>"
        "</deck>"
    )
    path = OUT / filename
    path.write_text(xml, encoding="utf-8")
    return filename, name, xml.count("<card>")


# (filename, display name, time, description, cards)
DECKS = []

DECKS.append((
    "L1 - Homogénéité et expression d'une grandeur.xml",
    "MP* L1 - Homogénéité et expression d'une grandeur",
    "2.01",
    "Chiffres significatifs, homogénéité et écriture d'une grandeur (Fabert MP* 2026-2027).",
    [
        ("Qu'est-ce qu'un chiffre significatif ?", "Chiffre dans lequel on peut avoir confiance : une unité de ce chiffre est supérieure à l'incertitude, sauf le dernier chiffre, qui porte l'incertitude.", ""),
        ("Convention si rien n'est précisé sur l'incertitude", "L'incertitude vaut une unité sur le dernier chiffre écrit. Ex. ℓ = 1,42 m signifie 1,41 m ≤ ℓ ≤ 1,43 m.", ""),
        ("Règle d'écriture des zéros et C.S.", "Tous les chiffres écrits sont significatifs, et tous les C.S. sont écrits. Les zéros à gauche ne comptent pas ; les zéros à droite comptent.", ""),
        ("Combien de C.S. dans 0,12 m, 0,00001 s, 7,010 s ?", "0,12 m → 2 ; 0,00001 s → 1 ; 7,010 s → 4.", ""),
        ("Quelles constantes ont une infinité de C.S. ?", "Les constantes mathématiques (π, e, j) et les entiers. Cinq constantes SI fixées depuis 2018 : c, h, k_B, e, N_A.", ""),
        ("Règle C.S. pour une addition / soustraction", "Aligner sur le dernier chiffre qui porte une incertitude (le moins précis en position décimale).", ""),
        ("Règle C.S. pour une multiplication / division", "Le résultat a autant de C.S. que la valeur qui en a le moins.", ""),
        ("Règle C.S. pour une fonction mathématique (cos, ln, …)", "Le résultat a le même nombre de C.S. que son argument.", ""),
        ("Que faire des valeurs intermédiaires dans un calcul ?", "Les écrire arrondies, mais reprendre la valeur brute de la calculatrice pour la suite, sinon les arrondis s'accumulent.", ""),
        ("Homogénéité d'une équation", "Tous les termes d'une somme doivent avoir la même dimension. On ne peut additionner que des grandeurs de même nature.", ""),
        ("Équation aux dimensions : que représente [X] ?", "La dimension de la grandeur X, exprimée avec M, L, T, I, Θ, N, J.", ""),
        ("Dimension d'une énergie, d'une force, d'une puissance", "Énergie : M L² T⁻². Force : M L T⁻². Puissance : M L² T⁻³.", r"[E]=\mathrm{M}\,\mathrm{L}^{2}\,\mathrm{T}^{-2}"),
        ("Unités SI de base à connaître", "s, m, kg, A, K, mol, cd. Les autres unités (N, J, W, V, Ω, F, H, C, Pa) s'en déduisent.", ""),
        ("Écriture scientifique recommandée", "a × 10^n avec 1 ≤ |a| < 10, unité SI, C.S. cohérents. Séparer la valeur et l'unité (ex. 1,42 m).", ""),
    ],
))

DECKS.append((
    "L3 - Équations différentielles.xml",
    "MP* L3 - Équations différentielles",
    "2.01",
    "ED d'ordre 1 et 2 usuelles en physique (Fabert MP* 2026-2027).",
    [
        ("Forme canonique d'une ED d'ordre 1 sans second membre", "τ (ou H) est une durée (hauteur) caractéristique positive. Solution : exponentielle décroissante.", r"\dfrac{\mathrm{d}u}{\mathrm{d}t}+\dfrac{1}{\tau}u=0\qquad u(t)=u(0)\,e^{-t/\tau}"),
        ("ED d'ordre 1 avec second membre constant Λ", "Sommer solution libre + particulière constante. La constante se lit aux conditions initiales.", r"u(t)=\bigl(u(0)-\tau\Lambda\bigr)e^{-t/\tau}+\tau\Lambda"),
        ("La solution en régime forcé dépend-elle des CI ?", "Non. Les conditions initiales ne fixent que le transitoire (terme libre).", ""),
        ("Second membre sinusoïdal : méthode", "Passer en notation complexe : cos(ωt) → e^{jωt}, d/dt → × jω, puis extraire l'amplitude complexe.", r"U_m=\dfrac{E}{1+j\omega\tau}"),
        ("ED divergente du/dt − u/τ = 0", "Solution en e^{+t/τ}. Vérifier si la divergence est physiquement cohérente (sinon erreur de calcul).", r"u(t)=u(0)\,e^{+t/\tau}"),
        ("Oscillateur harmonique (forme canonique)", "ω₀ pulsation propre. Deux écritures équivalentes de la solution.", r"\ddot x+\omega_0^2 x=0\qquad x=A\cos(\omega_0 t)+B\sin(\omega_0 t)=C\cos(\omega_0 t+\varphi)"),
        ("ED spatiale du type d²ξ/dx² + k² ξ = 0", "k est une pulsation spatiale (nombre d'onde). Solutions sinusoïdales en x.", r"\dfrac{\mathrm{d}^{2}\xi}{\mathrm{d}x^{2}}+k^{2}\xi=0"),
        ("Ne pas confondre ẍ + ω₀²x = 0 et ẍ − ω₀²x = 0", "La première oscille (harmonique). La seconde diverge (exponentielles réelles, instabilité).", r"\ddot x-\omega_0^2 x=0"),
        ("Oscillateur amorti : forme canonique", "ω₀ pulsation propre, Q facteur de qualité. Le régime (pseudo-périodique / critique / apériodique) dépend de Q.", r"\ddot u+\dfrac{\omega_0}{Q}\dot u+\omega_0^2 u=\omega_0^2 e(t)"),
        ("Combien de CI pour un ordre 1 ? Pour un ordre 2 ?", "Ordre 1 : une condition initiale. Ordre 2 : deux conditions initiales.", ""),
        ("Condition pour qu'il y ait des oscillations", "Il faut un échange d'énergie sous (au moins) deux formes différentes (ex. C et L, ou k et m).", ""),
    ],
))

DECKS.append((
    "SA1 - Circuits linéaires.xml",
    "MP* SA1 - Circuits linéaires",
    "2.01",
    "Lois de Kirchhoff, dipôles RLC et régimes transitoires (révision 1A, Fabert MP*).",
    [
        ("Définition d'un nœud, d'une branche, d'une maille", "Nœud : jonction d'au moins 3 fils, caractérisé par V. Branche : entre deux nœuds, un seul courant. Maille : boucle de branches.", ""),
        ("Tension U_AB", "Différence de potentiels. Convention : U_AB = V_A − V_B.", r"U_{AB}=V_A-V_B"),
        ("Loi des mailles / loi des nœuds", "Somme des tensions dans une maille nulle. Somme des courants entrants dans un nœud nulle (conservation de la charge).", ""),
        ("Loi constitutive du résistor (conv. récepteur)", "R en ohm, G = 1/R en siemens.", r"u_R(t)=R\,i_R(t)"),
        ("Loi constitutive du condensateur (conv. récepteur)", "C en farad. u_C est continue.", r"i_C(t)=C\,\dfrac{\mathrm{d}u_C}{\mathrm{d}t}"),
        ("Loi constitutive de la bobine (conv. récepteur)", "L en henry. i_L est continue.", r"u_L(t)=L\,\dfrac{\mathrm{d}i_L}{\mathrm{d}t}"),
        ("Puissance reçue (récepteur) / fournie (générateur)", "Même formule udipôle × idipôle, l'algébrisation change avec la convention.", r"P=u(t)\,i(t)"),
        ("Effet Joule dans un résistor", "Puissance toujours reçue et dissipée (R > 0).", r"P_J=R i^2=u^2/R"),
        ("Énergie stockée dans C et dans L", "", r"E_C=\dfrac12 C u_C^2\qquad E_L=\dfrac12 L i_L^2"),
        ("Association de résistors série / parallèle", "Série : résistances s'ajoutent. Parallèle : conductances s'ajoutent.", r"R_\mathrm{éq,série}=\sum R_k\qquad R_\mathrm{\parallel}=\dfrac{R_1 R_2}{R_1+R_2}"),
        ("Pont diviseur de tension / de courant", "", r"U_k=\dfrac{R_k}{\sum R}\,U_\mathrm{tot}\qquad I_k=\dfrac{G_k}{\sum G}\,I_\mathrm{tot}"),
        ("Régime libre vs régime forcé", "Libre : pas d'apport extérieur d'énergie. Forcé : avec source. Le régime forcé ne dépend pas des CI.", ""),
        ("Constante de temps RC et RL", "Ordre de grandeur de la durée du transitoire : quelques τ.", r"\tau_{RC}=RC\qquad \tau_{RL}=L/R"),
        ("Continuités à t = 0⁺", "u_C est continue. i_L est continue.", ""),
        ("Facteur de qualité et pulsation propre (RLC)", "Forme canonique de l'équation du 2e ordre.", r"\ddot u_C+\dfrac{\omega_0}{Q}\dot u_C+\omega_0^2 u_C=\omega_0^2 e(t)"),
        ("Condition ARQS", "Taille du circuit ≪ c/f (longueur d'onde). On peut alors parler de tension/intensité uniques sur un fil.", ""),
        ("Modèle de Thévenin d'une source", "Source idéale de tension en série avec une résistance interne (résistance de sortie).", ""),
    ],
))

DECKS.append((
    "SA2 - Filtrage.xml",
    "MP* SA2 - Filtrage",
    "2.01",
    "Notation complexe, impédances, Bode et filtres passifs (Fabert MP*).",
    [
        ("Notation complexe d'une sinusoïde", "Amplitude complexe Ũ_m = U_m e^{jφ}. Seule la partie réelle a un sens physique.", r"u(t)=U_m\cos(\omega t+\varphi)\;\longleftrightarrow\;\underline{u}=\underline{U}_m e^{j\omega t}"),
        ("Valeur efficace d'une tension périodique", "Moyenne quadratique. Pour une sinusoïde de moyenne nulle : U_eff = U_m / √2.", r"U_\mathrm{eff}=\sqrt{\langle u^2\rangle}"),
        ("Impédances R, L, C (conv. récepteur)", "Admittance Y = 1/Z. Kirchhoff reste valable en remplaçant R par Z.", r"Z_R=R\qquad Z_L=jL\omega\qquad Z_C=\dfrac{1}{jC\omega}"),
        ("Dérivation / intégration en complexe", "× jω ↔ dérivée temporelle. ÷ jω ↔ intégration.", ""),
        ("Pseudo-dérivateur / pseudo-intégrateur", "Un RC se comporte en dérivateur à BF et en intégrateur à HF, seulement dans une plage de fréquences.", ""),
        ("Fonction de transfert d'un filtre", "Quadripôle. Ordre = degré le plus élevé de N ou D dans H = N/D.", r"H(j\omega)=\dfrac{\underline{U}_s}{\underline{U}_e}"),
        ("Gain et gain en décibels", "G = |H|. GdB = 20 log G. +20 dB = ×10 en amplitude ; +3 dB = ×2 en puissance.", r"G_\mathrm{dB}=20\log|H(j\omega)|"),
        ("Pulsation de coupure d'un filtre réel", "H(ω_c) = H_max / √2, soit GdB(ω_c) = GdB,max − 3 dB.", ""),
        ("Passe-bas / passe-haut / passe-bande / coupe-bande", "PB : transmet les BF. PH : les HF. Passe-bande : une bande autour de ω₀. Coupe-bande : atténue autour de ω₀.", ""),
        ("Diagramme de Bode", "Représentation en échelle log de GdB(ω) et de arg H(ω).", ""),
        ("Passe-bas d'ordre 1 (RC, sortie sur C)", "H ~ H₀ / (1 + jω/ω_c). Pente HF : −20 dB/dec.", ""),
        ("Passe-haut d'ordre 1 (CR, sortie sur R)", "H ~ jω/ω_c / (1 + jω/ω_c). Pente BF : +20 dB/dec.", ""),
        ("Résonance utile ou néfaste selon le filtre", "Passe-bas/haut d'ordre 2 : résonance néfaste (surtension). Passe-bande et coupe-bande : résonance souhaitable.", ""),
        ("Mise en cascade de filtres", "Il faut Z_s faible et Z_e forte pour que le 2e étage ne charge pas le 1er.", ""),
        ("Action d'un filtre sur un signal périodique", "Chaque harmonique est multipliée par H(j n ω). Un système non linéaire crée de nouvelles fréquences.", ""),
        ("Intégrateur / dérivateur : conditions", "Dérivateur : |H| ∝ ω sur la bande utile. Intégrateur : |H| ∝ 1/ω. Moyenneur : passe-bas qui tue les harmoniques.", ""),
    ],
))

DECKS.append((
    "SB1 - Traitement du signal.xml",
    "MP* SB1 - Traitement du signal (ALI)",
    "2.02",
    "ALI idéal, montages linéaires, Fourier et Shannon (Fabert MP*).",
    [
        ("Rôle d'un ALI / AOP", "Amplifier sa tension d'entrée ε = V+ − V−. Bornes : + non inverseuse, − inverseuse, sortie.", r"\varepsilon=V_+-V_-"),
        ("ALI idéal : deux régimes", "Linéaire : ε = 0 et |V_s| < V_sat. Saturation : ε > 0 → +V_sat, ε < 0 → −V_sat.", ""),
        ("Courants de polarisation (ALI idéal)", "i+ = i− = 0. La masse est indispensable au fonctionnement.", ""),
        ("Rétroaction négative vs positive", "Négative (vers l'entrée −) : tend à stabiliser (souvent linéaire). Positive (vers +) : tend à déstabiliser.", ""),
        ("Critère de régime (ALI idéal)", "Pas de rétroaction sur − → saturation. Rétroaction sur − seulement → linéaire. Les deux → indéterminé a priori.", ""),
        ("Amplificateur inverseur", "", r"u_s=-\dfrac{R_2}{R_1}u_e"),
        ("Amplificateur non inverseur", "", r"u_s=\left(1+\dfrac{R_2}{R_1}\right)u_e"),
        ("Montage suiveur", "Impédance d'entrée infinie, Z_s nulle : isolation. u_s = u_e.", r"u_s=u_e"),
        ("Montage intégrateur (ALI)", "", r"\dfrac{\mathrm{d}u_s}{\mathrm{d}t}=-\dfrac{1}{RC}u_e"),
        ("Série de Fourier d'un signal périodique", "Fondamental : pulsation ω = 2π/T. Harmoniques : nω, n ≠ 1.", r"u(t)=c_0+\sum_{n=1}^\infty c_n\cos(n\omega t+\varphi_n)"),
        ("Spectre d'un signal", "Amplitude de chaque composante sinusoïdale en fonction de ω. Sinusoïde : un seul pic.", ""),
        ("Triangle / rectangle symétriques", "Uniquement harmoniques impaires. Triangle : c_n ∝ 1/n². Rectangle : c_n ∝ 1/n.", ""),
        ("Discontinuités et harmoniques élevés", "Rupture de pente → harmoniques élevés. Discontinuité → harmoniques très élevés.", ""),
        ("Inégalité durée × bande", "δt × δf ≳ 1. Un signal bref a un spectre large.", r"\delta t\times\delta f\geqslant 1"),
        ("Critère de Nyquist–Shannon", "Fréquence d'échantillonnage ≥ 2 × fréquence maximale du signal, sinon repliement de spectre.", ""),
        ("Valeur efficace et Parseval", "U_eff² = somme des U_eff² des harmoniques (y compris la composante continue).", ""),
    ],
))

DECKS.append((
    "SB2 - Association de modules.xml",
    "MP* SB2 - Association de modules ALI",
    "2.02",
    "ALI non linéaire, saturation et hystérésis (Fabert MP*).",
    [
        ("ALI idéal en régime non linéaire : que vaut ε ?", "ε est obligatoirement non nulle (contrairement au régime linéaire).", ""),
        ("Hypothèse / vérification en saturation haute", "À poser : V_s = +V_sat. À vérifier : ε > 0 soit V+ > V−.", ""),
        ("Hypothèse / vérification en saturation basse", "À poser : V_s = −V_sat. À vérifier : ε < 0 soit V+ < V−.", ""),
        ("Qu'est-ce qu'un hystérésis ?", "Le dispositif peut prendre deux valeurs de sortie différentes selon le passé de l'entrée. Cycle dans le plan (e, s).", ""),
        ("Qui peut créer un cycle d'hystérésis ?", "Uniquement un dispositif non linéaire.", ""),
        ("Comparateur simple (sans hystérésis)", "Compare u_e à un seuil. Sortie ±V_sat. Sensible au bruit près du seuil.", ""),
        ("Comparateur à hystérésis (trigger de Schmitt)", "Deux seuils (haut et bas). Immunise contre le bruit. Base des astables / monostables.", ""),
        ("Montage astable à ALI", "Oscillateur à relaxation : pas d'entrée, sortie périodique (créneaux). Utilise C en charge/décharge et un trigger.", ""),
        ("Association linéaire + non linéaire", "On enchaîne des modules (filtre, ALI linéaire, comparateur) en respectant Z_e ≫ Z_s entre étages.", ""),
        ("Pourquoi isoler les étages avec un suiveur ?", "Le suiveur a Z_e très grande et Z_s nulle : il évite que l'étage suivant charge le précédent.", ""),
    ],
))

DECKS.append((
    "MA0 - Cinématique.xml",
    "MP* MA0 - Cinématique",
    "2.02",
    "Coordonnées, vitesse/accélération et mouvements particuliers (Fabert MP*).",
    [
        ("Déplacement élémentaire cartésien", "", r"\mathrm{d}\vec{r}=\mathrm{d}x\,\vec{u}_x+\mathrm{d}y\,\vec{u}_y+\mathrm{d}z\,\vec{u}_z"),
        ("Volume et surfaces élémentaires cartésiens", "", r"\mathrm{d}\tau=\mathrm{d}x\,\mathrm{d}y\,\mathrm{d}z"),
        ("Vitesse et accélération cartésiennes", "", r"\vec{v}=\dot x\vec{u}_x+\dot y\vec{u}_y+\dot z\vec{u}_z\qquad\vec{a}=\ddot x\vec{u}_x+\ddot y\vec{u}_y+\ddot z\vec{u}_z"),
        ("Coordonnées cylindro-polaires d'un point", "M(r, θ, z) avec base locale (u_r, u_θ, u_z).", ""),
        ("Déplacement élémentaire cylindro-polaire", "", r"\mathrm{d}\vec{r}=\mathrm{d}r\,\vec{u}_r+r\,\mathrm{d}\theta\,\vec{u}_\theta+\mathrm{d}z\,\vec{u}_z"),
        ("Volume élémentaire cylindro-polaire", "", r"\mathrm{d}\tau=r\,\mathrm{d}r\,\mathrm{d}\theta\,\mathrm{d}z"),
        ("Vitesse cylindro-polaire", "", r"\vec{v}=\dot r\vec{u}_r+r\dot\theta\vec{u}_\theta+\dot z\vec{u}_z"),
        ("Accélération cylindro-polaire", "Terme −r θ̇² u_r : centripète. Terme 2 ṙ θ̇ u_θ : Coriolis de la base mobile.", r"\vec{a}=(\ddot r-r\dot\theta^2)\vec{u}_r+(2\dot r\dot\theta+r\ddot\theta)\vec{u}_\theta+\ddot z\vec{u}_z"),
        ("Moment cinétique d'un mouvement plan (par rapport à O)", "", r"\vec{\sigma}_O=m r^2\dot\theta\,\vec{u}_z"),
        ("Déplacement élémentaire sphérique", "", r"\mathrm{d}\vec{r}=\mathrm{d}r\,\vec{u}_r+r\mathrm{d}\theta\,\vec{u}_\theta+r\sin\theta\,\mathrm{d}\varphi\,\vec{u}_\varphi"),
        ("Volume élémentaire sphérique", "", r"\mathrm{d}\tau=r^2\sin\theta\,\mathrm{d}r\,\mathrm{d}\theta\,\mathrm{d}\varphi"),
        ("Point matériel, quantité de mouvement", "La masse est scalaire, réelle, positive. p est extensive.", r"\vec{p}=m\vec{v}"),
        ("Moment cinétique par rapport à A", "Mesure la « quantité de rotation » autour de A. Grandeur extensive.", r"\vec{\sigma}_A=\overrightarrow{AM}\wedge m\vec{v}"),
        ("Énergie cinétique d'un point", "Extensive.", r"E_c=\dfrac{p^2}{2m}=\dfrac12 m v^2"),
        ("Quantité de mouvement d'un système", "G centre de masse.", r"\vec{p}(S)=m_\mathrm{tot}\vec{v}(G)"),
        ("Grandeurs absolues en relativité galiléenne", "Masse, temps, accélération, charge, longueur. Relatives : position, vitesse.", ""),
        ("Loi de composition des vitesses (galiléenne)", "", r"\vec{v}(\mathrm{H/sol})=\vec{v}(\mathrm{H/train})+\vec{v}(\mathrm{train/sol})"),
        ("Mouvement uniformément accéléré", "a⃗ constant. Trajectoire parabolique ou rectiligne selon les CI. Chute de h sans v₀ : v = √(2gh).", ""),
        ("Vitesse d'un mouvement circulaire de rayon R", "", r"\vec{v}=R\dot\theta\,\vec{u}_\theta=\vec{\Omega}\wedge\overrightarrow{OM}"),
        ("Accélération d'un mouvement circulaire", "", r"\vec{a}=-R\dot\theta^2\vec{u}_r+R\ddot\theta\vec{u}_\theta=-\dfrac{v^2}{R}\vec{u}_r+\dot v\vec{u}_\theta"),
    ],
))

DECKS.append((
    "MA1 - Dynamique galiléenne.xml",
    "MP* MA1 - Dynamique galiléenne",
    "2.02",
    "Forces, lois de Newton et théorèmes énergétiques (Fabert MP*).",
    [
        ("Force de gravitation (Newton)", "G = 6,67×10⁻¹¹ m³·kg⁻¹·s⁻². Attractive.", r"\vec{f}_{1\to 2}=-G\dfrac{m_1 m_2}{r^2}\vec{u}_{12}"),
        ("Champ gravitationnel d'une masse ponctuelle", "Un astre à symétrie sphérique ≡ masse au centre.", r"\vec{\mathcal{G}}(M)=-G\dfrac{m}{r^2}\vec{u}_r"),
        ("Énergie potentielle gravitationnelle", "", r"E_{p,\mathrm{grav}}=-G\dfrac{m_1 m_2}{r}"),
        ("Poids au voisinage de la Terre", "g⃗ vertical vers le bas, g ≃ 9,81 m·s⁻². Constant à l'échelle « locale ».", r"\vec{P}=m\vec{g}"),
        ("Énergie potentielle de pesanteur", "h depuis une référence arbitraire.", r"E_{p,\mathrm{pes}}=mgh"),
        ("Force de Lorentz", "Toujours prédominante face au poids pour une particule chargée.", r"\vec{f}=q(\vec{E}+\vec{v}\wedge\vec{B})"),
        ("Force de Coulomb / champ d'une charge", "ε₀ ≃ 8,85×10⁻¹² F·m⁻¹.", r"\vec{f}_{1\to 2}=\dfrac{q_1 q_2}{4\pi\varepsilon_0 r^2}\vec{u}_{1\to 2}"),
        ("Force de Laplace (fil)", "", r"\mathrm{d}\vec{F}_L=i\,\mathrm{d}\vec{\ell}\wedge\vec{B}"),
        ("Force d'un ressort / Ep élastique", "u⃗_sortant sortant du ressort. Élastique : force seulement à l'étirement.", r"\vec{f}=-k(\ell-\ell_0)\vec{u}_\mathrm{sortant}\qquad E_p=\dfrac12 k(\ell-\ell_0)^2"),
        ("Poussée d'Archimède", "Verticale, de bas en haut, norme = poids du fluide déplacé (objet entièrement immergé, fluide au repos).", ""),
        ("Frottement fluide linéaire / quadratique", "Faible vitesse : −λ v⃗. Grande vitesse : −h ||v⃗|| v⃗.", r"\vec{f}=-\lambda\vec{v}\quad\text{ou}\quad\vec{f}=-h\|\vec{v}\|\vec{v}"),
        ("Réaction normale", "Normale au plan de tangence, du support vers l'objet, norme inconnue. Contact ⇔ ||R_N|| ≠ 0.", ""),
        ("Fil idéal / poulie idéale", "Fil : sans masse, inextensible, infiniment souple. Poulie : masse nulle, pas de frottement d'axe, pas de glissement du fil.", ""),
        ("Principe d'inertie (1re loi)", "Il existe des référentiels galiléens où v⃗ est constante ssi la résultante des forces est nulle.", ""),
        ("PFD / théorème du centre d'inertie", "Référentiel galiléen.", r"\sum\vec{f}_\mathrm{ext}=\dfrac{\mathrm{d}\vec{p}}{\mathrm{d}t}\qquad\vec{p}(S)=m\vec{v}(G)"),
        ("Principe des actions réciproques (3e loi)", "", r"\vec{f}_{A/B}=-\vec{f}_{B/A}\quad\text{et colinéaires à }\overrightarrow{AB}"),
        ("TEC (théorème de l'énergie cinétique)", "Référentiel galiléen, entre deux états.", r"\Delta E_c=\sum W(\vec{f}_\mathrm{ext})+\sum W(\vec{f}_\mathrm{int})"),
        ("Force conservative et énergie potentielle", "W_AB ne dépend que de A et B. f⃗ = −grad E_p et W_AB = −ΔE_p.", r"\vec{f}=-\overrightarrow{\mathrm{grad}}E_p"),
        ("Gradient en cartésien / cylindrique", "", r"\overrightarrow{\mathrm{grad}}E_p=\partial_x E_p\,\vec{u}_x+\partial_y E_p\,\vec{u}_y+\partial_z E_p\,\vec{u}_z"),
        ("Équilibre énergétique", "Équilibre ⇔ E_p stationnaire. Stable ⇔ minimum local de E_p.", ""),
        ("TEM (théorème de l'énergie mécanique)", "E_m = E_c + E_p,ext + E_p,int. Seules les forces non conservatives travaillent dans ΔE_m.", r"\Delta E_m=\sum W(f_\mathrm{nc})"),
        ("Pendule simple : isochronisme", "Isochronisme des petites oscillations seulement (approximation linéaire). Ce n'est pas une loi générale.", ""),
    ],
))

DECKS.append((
    "Constantes MP.xml",
    "MP* - Constantes et ordres de grandeur",
    "2.01",
    "Valeurs à connaître (fiche Rigaut, Fabert MP* 2026-2027).",
    [
        ("Constante de gravitation G", "À connaître par cœur.", r"G=6,67\cdot 10^{-11}\,\mathrm{m}^{3}\cdot\mathrm{kg}^{-1}\cdot\mathrm{s}^{-2}"),
        ("Pesanteur normalisée g", "", r"g=9,81\,\mathrm{m}\cdot\mathrm{s}^{-2}"),
        ("Jour solaire / jour sidéral", "Le sidéral sert à Ω terrestre.", r"T_\mathrm{sol}=86400\,\mathrm{s}\qquad T_\mathrm{sid}=86164\,\mathrm{s}"),
        ("Vitesse de rotation de la Terre", "", r"\Omega=2\pi/T_\mathrm{sid}=7,3\cdot 10^{-5}\,\mathrm{rad}\cdot\mathrm{s}^{-1}"),
        ("Rayon et masse de la Terre", "Périmètre ≃ 40 000 km.", r"R_T=6,4\cdot 10^3\,\mathrm{km}\qquad M_T=6,0\cdot 10^{24}\,\mathrm{kg}"),
        ("Vitesse de satellisation / de libération", "Au sol, champ g₀.", r"v_\mathrm{sat}=\sqrt{g_0 R_T}\simeq 7{,}9\,\mathrm{km}\cdot\mathrm{s}^{-1}\qquad v_\mathrm{lib}=\sqrt{2}\,v_\mathrm{sat}=11{,}2\,\mathrm{km}\cdot\mathrm{s}^{-1}"),
        ("Unité astronomique et période d'un an", "Vitesse orbitale moyenne ≃ 30 km/s.", r"1\,\mathrm{UA}=150\cdot 10^6\,\mathrm{km}\qquad 1\,\mathrm{an}\simeq\pi\cdot 10^7\,\mathrm{s}"),
        ("Distance Terre–Lune / masse de la Lune", "Une grosse seconde-lumière. g_Lune / g_Terre = 1/6.", r"d_{TL}=3{,}8\cdot 10^5\,\mathrm{km}\qquad M_L\simeq M_T/81"),
        ("Masse du Soleil et constante solaire", "8 min 20 s pour la lumière Terre–Soleil.", r"M_\odot=2\cdot 10^{30}\,\mathrm{kg}\qquad \mathcal{P}\simeq 1{,}5\,\mathrm{kW}\cdot\mathrm{m}^{-2}"),
        ("Célérité de la lumière (exacte / usuelle)", "Valeur exacte SI 2018.", r"c=299\,792\,458\,\mathrm{m}\cdot\mathrm{s}^{-1}=3{,}00\cdot 10^8\,\mathrm{m}\cdot\mathrm{s}^{-1}"),
        ("Constantes de Planck h et ℏ", "", r"h=6{,}62\cdot 10^{-34}\,\mathrm{J}\cdot\mathrm{s}\qquad\hbar=1{,}05\cdot 10^{-34}\,\mathrm{J}\cdot\mathrm{s}"),
        ("Visible, IR, UV (ordres de λ)", "Visible 0,4–0,8 µm. IR jusqu'à 1 mm. UV jusqu'à 1 nm.", r"0{,}4\,\mu\mathrm{m}\lesssim\lambda_\mathrm{vis}\lesssim 0{,}8\,\mu\mathrm{m}"),
        ("Indices air / eau / verre / diamant", "", r"n_\mathrm{air}\simeq 1\qquad n_\mathrm{eau}=1{,}33\qquad n_\mathrm{verre}\simeq 1{,}5\qquad n_\mathrm{diamant}=2{,}4"),
        ("Laser He-Ne de TP", "Longueur de cohérence ≫ lumière blanche (ℓ_c ≃ 1 µm).", r"\lambda=632{,}8\,\mathrm{nm}\qquad L_c\gtrsim 1\,\mathrm{m}"),
        ("Doublet du sodium", "Classique au goniomètre / Michelson.", r"\lambda=589{,}0\,\mathrm{nm}\ \mathrm{et}\ 589{,}6\,\mathrm{nm}"),
        ("R, N_A, k_B", "k_B = R / N_A. N_A et k_B sont exactes SI 2018 ; on retient les valeurs usuelles.", r"R=8{,}314\,\mathrm{J}\cdot\mathrm{K}^{-1}\cdot\mathrm{mol}^{-1}\qquad N_A=6{,}02\cdot 10^{23}\,\mathrm{mol}^{-1}\qquad k_B=1{,}38\cdot 10^{-23}\,\mathrm{J}\cdot\mathrm{K}^{-1}"),
        ("Air comme gaz parfait (20 °C, 1 bar)", "M = 29 g/mol. γ_diatomique = 7/5.", r"\rho=1{,}2\,\mathrm{kg}\cdot\mathrm{m}^{-3}\qquad V_m=24\,\mathrm{L}\cdot\mathrm{mol}^{-1}"),
        ("Pression atmosphérique et échelle de hauteur", "Atmosphère isotherme : H = RT/(Mg) ≃ 8,6 km.", r"P_0=1{,}013\cdot 10^5\,\mathrm{Pa}=1\,\mathrm{atm}"),
        ("Eau liquide : ρ, c, ℓ_f, ℓ_v", "Glace : ρ = 0,92×10³ kg/m³, c = 2,1 kJ/K/kg.", r"\rho=1{,}0\cdot 10^3\,\mathrm{kg}\cdot\mathrm{m}^{-3}\qquad c=4{,}18\,\mathrm{kJ}\cdot\mathrm{K}^{-1}\cdot\mathrm{kg}^{-1}"),
        ("μ₀, ε₀, e, m_e, m_p", "ε₀ = 1/(c² μ₀).", r"\mu_0=4\pi\cdot 10^{-7}\,\mathrm{H}\cdot\mathrm{m}^{-1}\qquad\varepsilon_0=8{,}85\cdot 10^{-12}\,\mathrm{F}\cdot\mathrm{m}^{-1}"),
        ("Charge et masses e, m_e, m_p", "", r"e=1{,}6\cdot 10^{-19}\,\mathrm{C}\qquad m_e=9{,}11\cdot 10^{-31}\,\mathrm{kg}\qquad m_p=1{,}67\cdot 10^{-27}\,\mathrm{kg}"),
        ("Champ B terrestre (composante horizontale)", "Sous nos latitudes. Magnet de TP ≃ 10⁻³ T.", r"B_H\simeq 2\cdot 10^{-5}\,\mathrm{T}"),
        ("Cuivre : n, γ, épaisseur de peau", "δ ≃ 1 cm à 50 Hz ; 10 µm à 50 MHz.", r"n\simeq 10^{29}\,\mathrm{m}^{-3}\qquad\gamma\simeq 6\cdot 10^7\,\mathrm{S}\cdot\mathrm{m}^{-1}"),
        ("Secteur et GBF de TP", "GBF : R_s = 50 Ω. Oscillo : 1 MΩ // 12 pF.", r"f=50\,\mathrm{Hz}\qquad U_\mathrm{eff}=230\,\mathrm{V}"),
        ("k_B T à 300 K", "Échelle d'énergie thermique ambiante.", r"k_B T\simeq 25\,\mathrm{meV}\simeq 1/40\,\mathrm{eV}"),
        ("Photon visible / X / γ (ordres)", "", r"E_\mathrm{vis}\simeq 1\,\mathrm{eV}\qquad E_X\simeq 1\,\mathrm{keV}\qquad E_\gamma\simeq 1\,\mathrm{MeV}"),
        ("Intensité dangereuse / mortelle", "Corps humide : R ≃ 1 kΩ (norme). Sec : ≃ 1 MΩ.", r"I_\mathrm{dangereux}=30\,\mathrm{mA}\qquad I_\mathrm{mortel}=50\,\mathrm{mA}"),
        ("PP / PR d'un œil emmétrope", "Pouvoir séparateur ≃ 1′ ≃ 3×10⁻⁴ rad.", r"PR=\infty\qquad PP=25\,\mathrm{cm}"),
    ],
))

# --- Chapitres suivants (programme officiel MP*, progression Fabert 2026-2027) ---

DECKS.append((
    "MA2 - Théorème du moment cinétique.xml",
    "MP* MA2 - Théorème du moment cinétique",
    "2.03",
    "TMC, conservation du moment cinétique et champ central.",
    [
        ("Moment d'une force par rapport à A", "", r"\overrightarrow{\mathcal{M}}_A(\vec{f})=\overrightarrow{AM}\wedge\vec{f}"),
        ("TMC pour un point (réf. galiléen)", "", r"\dfrac{\mathrm{d}\vec{\sigma}_A}{\mathrm{d}t}=\overrightarrow{\mathcal{M}}_A(\vec{f})\quad\text{(A fixe ou = G)}"),
        ("Quand le moment cinétique se conserve-t-il ?", "Si le moment des forces extérieures (par rapport au point/axe) est nul : force centrale, ou levier nul.", ""),
        ("Force centrale : conséquences", "σ⃗_O conservé ⇒ mouvement plan, loi des aires (Kepler 2).", ""),
        ("Paramètre d'impact et bras de levier", "σ_Δ = ± b_ℓ × p. Le signe suit l'orientation de l'axe.", ""),
        ("TMC d'un système", "dσ⃗_A/dt = somme des moments des forces extérieures (A fixe galiléen ou centre de masse).", ""),
        ("Lien énergie – force centrale conservative", "E_m conservée. Potentiel effectif E_p,eff = E_p(r) + L²/(2m r²).", ""),
    ],
))

DECKS.append((
    "MA3 - Autour des solides.xml",
    "MP* MA3 - Autour des solides",
    "2.03",
    "Solide en rotation autour d'un axe fixe, moment d'inertie.",
    [
        ("Solide indéformable", "Distance entre deux points du solide constante. Puissance des liaisons intérieures nulle.", ""),
        ("Rotation autour d'un axe fixe Δ", "Un degré de liberté θ. v = r_⊥ ω.", r"\vec{v}=\vec{\omega}\wedge\vec{r}"),
        ("Moment d'inertie par rapport à Δ", "", r"J_\Delta=\int r_\perp^2\,\mathrm{d}m"),
        ("Moment cinétique scalaire d'un solide / Δ", "", r"\sigma_\Delta=J_\Delta\omega"),
        ("Énergie cinétique d'un solide en rotation / Δ", "", r"E_c=\dfrac12 J_\Delta\omega^2"),
        ("TMC scalaire / axe fixe", "", r"J_\Delta\dot\omega=\mathcal{M}_\Delta(\vec{f}_\mathrm{ext})"),
        ("Pendule pesant : petites oscillations", "Analogie oscillateur harmonique. ω₀² = mgd / J_Δ (d = AG).", ""),
        ("Théorème de Huygens (rappel d'usage)", "J_Δ = J_G + m d² si Δ // axe par G, d distance.", r"J_\Delta=J_G+md^2"),
    ],
))

DECKS.append((
    "MB1 - Vers l'équation d'onde.xml",
    "MP* MB1 - Vers l'équation d'onde",
    "2.04",
    "Célérité, équation de d'Alembert à une dimension.",
    [
        ("Onde progressive unidimensionnelle", "Forme f(x − c t) vers +x, g(x + c t) vers −x, c célérité.", r"s(x,t)=f(x-ct)+g(x+ct)"),
        ("Équation de d'Alembert 1D", "", r"\dfrac{\partial^2 s}{\partial x^2}-\dfrac{1}{c^2}\dfrac{\partial^2 s}{\partial t^2}=0"),
        ("Célérité sur une corde", "T₀ tension, μ masse linéique.", r"c=\sqrt{T_0/\mu}"),
        ("Onde plane progressive harmonique", "", r"s=s_m\cos(\omega t-kx+\varphi)\qquad k=\omega/c=2\pi/\lambda"),
        ("Relation de dispersion non dispersive", "c indépendant de ω. Tous les harmoniques voyagent à la même vitesse.", r"\omega=ck"),
        ("Impédance caractéristique d'une corde", "Lien f_y / v_y pour une OPP vers +x.", r"Z=\mu c=\sqrt{\mu T_0}"),
        ("Réflexion / transmission (corde)", "Discontinuité de μ : coefficients en amplitude liés à Z. Nœud si extrémité fixe.", ""),
    ],
))

DECKS.append((
    "MB2 - Ondes.xml",
    "MP* MB2 - Plus d'ondes",
    "2.04",
    "Ondes stationnaires, modes propres, énergie d'une onde.",
    [
        ("Onde stationnaire", "Produit f(x) g(t). Nœuds et ventres fixes. Pas de transport net d'énergie.", r"s=2s_m\cos(kx)\cos(\omega t)"),
        ("Corde de Melde : modes propres", "Deux extrémités fixes : λ_n = 2L/n, f_n = n c /(2L).", r"f_n=n\dfrac{c}{2L}"),
        ("Vecteur de Poynting analogique (corde)", "Puissance linéique transportée ~ T₀ (−∂y/∂x) ∂y/∂t.", ""),
        ("Intensité d'une onde", "Puissance moyenne surfacique (ou linéique) transportée.", ""),
        ("Dispersion", "c(ω) non constant. Un paquet d'ondes se déforme. v_φ = ω/k, v_g = dω/dk.", ""),
        ("Atténuation", "Amplitude qui décroît avec x (frottements, viscosité, effet Joule…).", ""),
        ("Célérité du son dans un fluide", "K module de compressibilité, ρ masse volumique.", r"c=\sqrt{K/\rho}"),
    ],
))

DECKS.append((
    "OA1 - Rappel optique 1A.xml",
    "MP* OA1 - Rappel d'optique géométrique",
    "2.05",
    "Lois de Snell-Descartes, lentilles, stigmatisme.",
    [
        ("Lois de Snell-Descartes", "Réflexion : i_r = i₁. Réfraction : n₁ sin i₁ = n₂ sin i₂, rayon dans le plan d'incidence.", r"n_1\sin i_1=n_2\sin i_2"),
        ("Indice et célérité", "", r"n=c/v\qquad v=c/n"),
        ("Réflexion totale", "Seulement si n₁ > n₂ et i₁ ≥ i_lim avec sin i_lim = n₂/n₁.", ""),
        ("Approximation de Gauss", "Rayons paraxiaux (proches de l'axe, petits angles). Images stigmatiques approchées.", ""),
        ("Lentille mince convergente : conjugaison / grandissement", "Origine au centre optique, f' > 0.", r"\dfrac{1}{\overline{OA}'}-\dfrac{1}{\overline{OA}}=\dfrac{1}{f'}\qquad\gamma=\dfrac{\overline{OA}'}{\overline{OA}}"),
        ("Foyers objet / image", "F : objet dont l'image est à l'infini. F' : image d'un objet à l'infini. OF' = f'.", ""),
        ("Vergence", "V = 1/f' en δ (m⁻¹). Associations de lentilles accolées : vergence additive.", ""),
        ("Stigmatisme / aplanétisme", "Stigmatisme : un point → un point. Aplanétisme : un objet plan ⊥ axe → image plane.", ""),
    ],
))

DECKS.append((
    "OA2 - Modèle scalaire des ondes lumineuses.xml",
    "MP* OA2 - Modèle scalaire",
    "2.05",
    "Chemin optique, vibration lumineuse, théorème de Malus.",
    [
        ("Modèle scalaire de la lumière", "On décrit le champ par un scalaire s(M,t) (une composante de E⃗). Valable hors polarisation.", ""),
        ("Chemin optique", "n indice, ds abscisse curviligne.", r"\delta=\int n\,\mathrm{d}s"),
        ("Retard de phase lié au chemin optique", "", r"\varphi=\dfrac{2\pi}{\lambda_0}\delta=k_0\delta"),
        ("Surface d'onde / théorème de Malus", "Surface d'onde = ensemble des points de même phase. Les rayons sont orthogonaux aux surfaces d'onde.", ""),
        ("Principe de Fermat (énoncé utile)", "Le rayon suit un chemin optique stationnaire entre deux points.", ""),
        ("Onde plane / onde sphérique", "Plane : phase k·r − ωt. Sphérique : amplitude ∝ 1/r, phase k r.", ""),
        ("Intensité lumineuse (modèle scalaire)", "I ∝ ⟨s²⟩ ∝ |a|² pour une amplitude complexe a.", ""),
        ("Indice et longueur d'onde", "λ = λ₀ / n. La fréquence est invariante au changement de milieu.", ""),
    ],
))

DECKS.append((
    "OB1 - Trous de Young.xml",
    "MP* OB1 - Trous de Young",
    "2.06",
    "Interférences à deux ondes, différence de marche.",
    [
        ("Condition d'interférences à deux ondes", "Même fréquence, déphasage constant (sources cohérentes), polarisations non orthogonales.", ""),
        ("Intensité résultante (deux ondes)", "I = I₁ + I₂ + 2√(I₁ I₂) cos φ. Contraste V = 2√(I₁ I₂)/(I₁+I₂) si totalement cohérent.", r"I=I_1+I_2+2\sqrt{I_1 I_2}\cos\varphi"),
        ("Différence de marche aux Young (écran lointain)", "a écartement des trous, D distance à l'écran, x abscisse.", r"\delta\simeq\dfrac{a x}{D}"),
        ("Interfrange", "Distance entre deux franges brillantes consécutives.", r"i=\dfrac{\lambda_0 D}{a}"),
        ("Ordre d'interférence", "p = δ/λ₀. Brillant : p entier. Sombre : p demi-entier.", r"p=\delta/\lambda_0"),
        ("Frange centrale", "δ = 0 : toujours brillante en lumière blanche (blanche).", ""),
        ("Teinte plate / champ d'interférences", "Teinte plate : δ constant sur l'écran. Sinon franges d'égale épaisseur ou d'égale inclinaison.", ""),
    ],
))

DECKS.append((
    "OB2 - Young et variantes.xml",
    "MP* OB2 - Young +",
    "2.06",
    "Lame d'eau, source étendue, translation des franges.",
    [
        ("Lame à faces parallèles sur un trajet", "Ajoute n e − e = (n−1)e au chemin optique (incidence normale).", r"\Delta\delta=(n-1)e"),
        ("Translation des franges", "Augmenter δ sur un trou décale les franges vers l'autre trou.", ""),
        ("Source étendue : condition de visibilité", "La différence de marche doit varier peu sur la source (cohérence spatiale). Trous dans le plan de la lentille / fente source parallèle aux franges.", ""),
        ("Largeur de la source et contraste", "Si la source est trop large, V diminue (moyenne des figures décalées).", ""),
        ("Trous éclairés par une fente source", "Fente // aux franges pour maximiser le contraste.", ""),
        ("Localisation des franges (Young)", "Non localisées (visibles partout derrière les trous) si source ponctuelle.", ""),
        ("Lumière blanche aux Young", "Irisation hors du centre ; spectre cannelé si on analyse une frange.", ""),
    ],
))

DECKS.append((
    "OB3 - Interféromètre de Michelson.xml",
    "MP* OB3 - Michelson",
    "2.06",
    "Lame d'air, coin d'air, anneaux d'égale inclinaison.",
    [
        ("Rôle des deux miroirs du Michelson", "Séparatrice à 45°. On interfère l'onde réfléchie par M₁ et celle réfléchie par M₂ (image M₂').", ""),
        ("Différence de marche (lame d'air e, incidence i)", "Aller-retour dans la lame d'air.", r"\delta=2e\cos i"),
        ("Contact optique (e = 0)", "Teinte plate noire (déphasage à la réflexion sur la séparatrice, convention usuelle MP).", ""),
        ("Coin d'air : franges", "Franges d'égale épaisseur, droites, localisées au coin. Interfrange i = λ₀/(2α).", r"i=\lambda_0/(2\alpha)"),
        ("Lame d'air : anneaux", "Anneaux d'égale inclinaison, localisés à l'infini. Observer dans le plan focal d'une lentille.", ""),
        ("Rayon de l'anneau d'ordre p (lentille f')", "", r"R_p\simeq f'\sqrt{\dfrac{p\lambda_0}{e}}"),
        ("Déplacement d'un miroir de Δe", "Le centre défile. Nombre de franges : N = 2 Δe / λ₀.", r"N=2\Delta e/\lambda_0"),
    ],
))

DECKS.append((
    "OB4 - Cohérence.xml",
    "MP* OB4 - Cohérence",
    "2.07",
    "Cohérence temporelle et spatiale, longueur de cohérence.",
    [
        ("Cohérence temporelle", "liée à la largeur spectrale. Longueur de cohérence ℓ_c ≃ λ₀² / Δλ.", r"\ell_c\simeq\dfrac{\lambda_0^2}{\Delta\lambda}"),
        ("Temps de cohérence", "τ_c ≃ 1/Δν. On perd le contraste si |τ| ≳ τ_c (δ ≳ ℓ_c).", r"\tau_c\simeq 1/\Delta\nu"),
        ("Pourquoi le blanc a une faible cohérence temporelle", "Δλ grand ⇒ ℓ_c de quelques μm. D'où irisations et disparition rapide des franges.", ""),
        ("Cohérence spatiale", "liée à l'extension angulaire de la source. Critère de visibilité : a θ ≲ λ (a base interférométrique).", ""),
        ("Théorème de van Cittert–Zernike (idée MP)", "Le contraste vs écartement des trous est la TF de l'intensité de la source.", ""),
        ("Doublets spectraux au Michelson", "Battements du contraste vs e. Mesure de Δλ.", ""),
        ("Filtrage spatial / spectral", "Fente source étroite ↑ cohérence spatiale. Filtre coloré ↑ cohérence temporelle.", ""),
    ],
))

DECKS.append((
    "TA1 - Principes de la thermodynamique.xml",
    "MP* TA1 - Les principes de la thermodynamique",
    "2.07",
    "Premier et second principes, fonctions d'état (révision MP).",
    [
        ("Premier principe (système fermé)", "U énergie interne, fonction d'état. W et Q algébriques, reçus par le système.", r"\Delta U=W+Q"),
        ("Identité thermodynamique (pfz, réversible)", "", r"\mathrm{d}U=T\mathrm{d}S-P\mathrm{d}V"),
        ("Enthalpie", "H = U + PV. Pratique à P constante : ΔH = Q_p.", r"H=U+PV"),
        ("Second principe", "S fonction d'état. ΔS = S_éch + S_créée, S_créée ≥ 0, = 0 ssi réversible.", r"\mathrm{d}S=\delta Q_\mathrm{rev}/T"),
        ("Entropie échangée", "Avec un thermostat à T_ext.", r"S_\mathrm{éch}=Q/T_\mathrm{ext}"),
        ("Gaz parfait : ΔU et ΔH", "Ne dépendent que de T. ΔU = n Cv ΔT, ΔH = n Cp ΔT (Cv, Cp constants).", r"C_p-C_v=nR\quad\text{(GP)}"),
        ("Transformation adiabatique réversible de GP", "Lois de Laplace.", r"TV^{\gamma-1}=\mathrm{cste}\qquad PV^\gamma=\mathrm{cste}"),
        ("Travail des forces de pression", "W = −∫ P_ext dV. Réversible : P_ext = P_gaz.", ""),
    ],
))

DECKS.append((
    "TA2 - Machines thermiques.xml",
    "MP* TA2 - Machines thermiques",
    "2.07",
    "Moteurs, réfrigérateurs, rendements de Carnot.",
    [
        ("Machine ditherme : convention", "Deux sources T_c > T_f. Bilan 1er principe sur un cycle : W + Q_c + Q_f = 0.", ""),
        ("Moteur ditherme", "W < 0 (travail fourni). Rendement η = |W|/Q_c. Carnot : η_C = 1 − T_f/T_c.", r"\eta_C=1-\dfrac{T_f}{T_c}"),
        ("Réfrigérateur / pompe à chaleur", "Efficacités e_r = Q_f/W et e_pc = Q_c/W (W > 0 reçu). Bornes de Carnot T_f/(T_c−T_f) et T_c/(T_c−T_f).", ""),
        ("Théorème de Carnot", "Toute machine réversible entre les mêmes sources a le même rendement, maximal.", ""),
        ("Cycle de Carnot", "Deux isothermes réversibles + deux adiabatiques réversibles.", ""),
        ("Inégalité de Clausius (cycle)", "∮ δQ/T ≤ 0, égalité ssi réversible.", ""),
        ("Pourquoi on ne peut pas tout convertir en travail", "Second principe : il faut une source froide pour rejeter de l'entropie.", ""),
    ],
))

DECKS.append((
    "CA1 - Thermochimie.xml",
    "MP* CA1 - Thermochimie",
    "2.08",
    "Enthalpie de réaction, Hess, Kirchhoff.",
    [
        ("Enthalpie standard de réaction Δ_r H°", "Chaleur à P constante, par mole de réaction telle qu'écrite. Extensive vis-à-vis de l'écriture.", ""),
        ("Loi de Hess", "Δ_r H° s'obtient par combinaison linéaire de Δ_f H° (formation) ou de combustions.", r"\Delta_r H^\circ=\sum\nu_i\Delta_f H^\circ(i)"),
        ("Exothermique / endothermique", "Δ_r H° < 0 exo (chaleur dégagée). > 0 endo.", ""),
        ("Loi de Kirchhoff", "Variation de Δ_r H° avec T (Cp des constituants).", r"\dfrac{\mathrm{d}\Delta_r H^\circ}{\mathrm{d}T}=\Delta_r C_p^\circ"),
        ("État standard", "P° = 1 bar. Soluté : c° = 1 mol·L⁻¹. Activités a_i.", ""),
        ("Enthalpie de changement d'état", "Fusion, vaporisation : toujours > 0 dans le sens de désorganisation.", ""),
        ("Liaison : enthalpie de dissociation", "Toujours > 0. Permet d'estimer Δ_r H via les liaisons cassées/formées.", ""),
    ],
))

DECKS.append((
    "CA2 - Sens et évolution d'une réaction.xml",
    "MP* CA2 - Sens et évolution d'une réaction chimique",
    "2.08",
    "Affinité, G, quotient réactionnel et van't Hoff.",
    [
        ("Enthalpie libre G", "Critère d'évolution à T, P constantes.", r"G=H-TS\qquad\mathrm{d}G=-S\mathrm{d}T+V\mathrm{d}P"),
        ("Enthalpie libre de réaction Δ_r G", "Δ_r G < 0 : réaction dans le sens direct (critère à T, P fixées).", r"\Delta_r G=\Delta_r G^\circ+RT\ln Q_r"),
        ("Quotient réactionnel Q_r", "Produit des activités élevées aux coeff. stoéch. algébriques.", r"Q_r=\prod a_i^{\nu_i}"),
        ("Constante d'équilibre K°", "K°(T) = exp(−Δ_r G° / RT). À l'équilibre Q_r = K°.", r"K^\circ(T)=e^{-\Delta_r G^\circ/RT}"),
        ("Relation de van't Hoff", "Si Δ_r H° > 0, K° croît avec T (endo favorisée à chaud).", r"\dfrac{\mathrm{d}\ln K^\circ}{\mathrm{d}T}=\dfrac{\Delta_r H^\circ}{RT^2}"),
        ("Principe de Le Chatelier (qualitatif)", "Le système s'oppose à la perturbation (T, P, composition) à l'équilibre.", ""),
        ("Activités usuelles", "Gaz parfait : a = P_i/P°. Solvant : 1. Soluté dilué : a = [X]/c°. Solide pur : 1.", ""),
    ],
))

DECKS.append((
    "CA3 - Révision chimie des solutions.xml",
    "MP* CA3 - Révision chimie des solutions",
    "2.08",
    "pH, acides-bases, solubilité (hors rédox).",
    [
        ("Ke de l'eau à 25 °C", "", r"K_e=[\mathrm{H}_3\mathrm{O}^+][\mathrm{OH}^-]=10^{-14}"),
        ("pH d'un acide fort / base forte", "Acide fort : pH = −log c. Base forte : pH = 14 + log c (eau négligée si c ≳ 10⁻⁶).", ""),
        ("pH d'un acide faible (approx. usuelle)", "Si c Ka ≫ Ke et c ≫ Ka.", r"\mathrm{pH}=\dfrac12\mathrm{p}K_a-\dfrac12\log c"),
        ("Zone tampon", "Mélange AH/A⁻. pH ≃ pKa + log([A⁻]/[AH]). Pouvoir tampon maximal à pH = pKa.", r"\mathrm{pH}=\mathrm{p}K_a+\log\dfrac{[\mathrm{A}^-]}{[\mathrm{AH}]}"),
        ("Produit de solubilité Ks", "Équilibre de dissolution d'un solide peu soluble. s solubilité.", ""),
        ("Effet d'ion commun", "Ajouter un ion du sel diminue la solubilité.", ""),
        ("Titrage acide-base : équivalence", "Quantités de titre et de titrant dans le rapport stoéch. pH d'équivalence selon les forces.", ""),
    ],
))

DECKS.append((
    "Q1 - Introduction à la mécanique quantique.xml",
    "MP* Q1 - Introduction à la mécanique quantique",
    "2.09",
    "Dualité, relations de Planck-Einstein et de de Broglie.",
    [
        ("Relation de Planck–Einstein", "Énergie d'un photon.", r"E=h\nu=\hbar\omega"),
        ("Impulsion d'un photon", "", r"p=h/\lambda=\hbar k"),
        ("Relation de de Broglie (particule)", "Toute particule d'impulsion p est associée à une onde de longueur d'onde λ.", r"\lambda=h/p"),
        ("Dualité onde-corpuscule", "Interférences (Young, électrons) mais détection granulaire. |ψ|² = densité de proba.", ""),
        ("Inégalité de Heisenberg spatiale", "", r"\Delta x\,\Delta p_x\geqslant\hbar/2"),
        ("Inégalité temps–énergie", "Une énergie bien définie exige une longue durée d'observation.", r"\Delta E\,\Delta t\geqslant\hbar/2"),
        ("Effet photoélectrique (idée)", "Seuil en fréquence ν₀ = W/h, indépendant de l'intensité. E_c,max = hν − W.", ""),
        ("Constante de Planck réduite", "", r"\hbar=h/2\pi"),
    ],
))

DECKS.append((
    "Q2 - Particule libre et puits infini.xml",
    "MP* Q2 - Particule libre et puits infini",
    "2.09",
    "Équation de Schrödinger stationnaire, quantification.",
    [
        ("Équation de Schrödinger stationnaire 1D", "E énergie, V(x) potentiel. États stationnaires : |ψ|² indépendant de t.", r"-\dfrac{\hbar^2}{2m}\dfrac{\mathrm{d}^2\varphi}{\mathrm{d}x^2}+V\varphi=E\varphi"),
        ("Particule libre (V = 0)", "Ondes planes. E = p²/2m = ħ² k² / 2m. Spectre continu.", r"\varphi=A e^{ikx}+B e^{-ikx}"),
        ("Puits infini [0, L] : conditions", "φ(0) = φ(L) = 0. Quantification de k et de E.", r"k_n=n\pi/L\qquad E_n=\dfrac{n^2\pi^2\hbar^2}{2m L^2}"),
        ("Fonctions propres du puits infini", "n entier ≥ 1.", r"\varphi_n(x)=\sqrt{2/L}\sin(n\pi x/L)"),
        ("Niveau fondamental", "n = 1, E₁ > 0 (énergie de confinement). Pas d'état E = 0.", ""),
        ("Parité dans un puits symétrique", "Les états sont pairs ou impairs. n impair : pas de nœud au centre.", ""),
        ("Normalisation", "∫ |φ|² dx = 1 sur tout l'espace (proba totale).", ""),
    ],
))

DECKS.append((
    "Q3 - Barrière et effet tunnel.xml",
    "MP* Q3 - Marche et effet tunnel",
    "2.09",
    "Marche de potentiel, coefficients R et T, tunnel.",
    [
        ("Marche de potentiel E > V₀", "Réflexion ET transmission, même si E > V₀ (effet quantique). k et k' différents.", ""),
        ("Marche E < V₀ (classiquement interdit)", "Onde évanescente en x > 0 : φ ∝ e^{−κx}. Réflexion totale, R = 1, mais pénétration.", r"\kappa=\sqrt{2m(V_0-E)}/\hbar"),
        ("Effet tunnel", "Barrière d'épaisseur a, E < V₀ : T > 0. T décroît exponentiellement avec a et √(V₀−E).", r"T\sim e^{-2\kappa a}"),
        ("Conservation du courant de probabilité", "R + T = 1 (flux réfléchi + transmis = incident) en stationnaire 1D sans absorption.", ""),
        ("Coefficient de transmission (définition)", "Rapport des flux (pas des |A|² bruts si v_g change).", ""),
        ("Microscope à effet tunnel (idée)", "Courant tunnel très sensible à la distance (exponentielle) → image de surface.", ""),
        ("Différence avec la mécanique classique", "Classiquement T = 0 si E < V₀ et T = 1 si E > V₀ (sauf réflexion partielle newtonienne nulle en 1D sans force).", ""),
    ],
))

DECKS.append((
    "EA1 - Mouvement d'une charge.xml",
    "MP* EA1 - Mouvement d'une charge",
    "2.10",
    "Trajectoires dans E et B uniformes, Laplace ponctuel.",
    [
        ("Force de Lorentz (rappel)", "Travail de q v⃗ ∧ B⃗ nul (orthogonale à v⃗).", r"\vec{f}=q(\vec{E}+\vec{v}\wedge\vec{B})"),
        ("Charge dans E⃗ uniforme (B = 0)", "Accélération constante. Parabole si v₀ non colinéaire à E⃗.", r"\vec{a}=q\vec{E}/m"),
        ("Charge dans B⃗ uniforme (E = 0)", "Hélice (ou cercle si v_∥ = 0). Pulsation cyclotron ω_c = qB/m. R = m v_⊥ / (|q| B).", r"\omega_c=|q|B/m\qquad R=mv_\perp/(|q|B)"),
        ("Signe de la rotation dans B⃗", "La rotation de v⃗_⊥ autour de B⃗ dépend du signe de q (règle des 3 doigts / produit vectoriel).", ""),
        ("Invariance de v_∥ et de l'énergie cinétique (B seul)", "B⃗ ne travaille pas. v_∥ conservée, v_⊥ conservée en norme.", ""),
        ("Filtre de Wien (E ⊥ B)", "Sélection de vitesse : qE = q v B ⇒ v = E/B pour la particule non déviée.", r"v=E/B"),
        ("Spectrographe de masse (idée)", "Après accélération, déflexion par B ⇒ r ∝ √m / |q|.", ""),
    ],
))

DECKS.append((
    "EA2 - Courant et force de Laplace.xml",
    "MP* EA2 - Courant électrique et force de Laplace",
    "2.10",
    "Force de Laplace sur un circuit, rail de Laplace.",
    [
        ("Force de Laplace sur un fil", "i algébrique, dℓ⃗ dans le sens du courant.", r"\mathrm{d}\vec{F}=i\,\mathrm{d}\vec{\ell}\wedge\vec{B}"),
        ("Force sur une spire plane dans B⃗ uniforme", "Résultante nulle. Moment : ⃗M = I ⃗S ∧ B⃗.", r"\vec{\mathcal{M}}=I\vec{S}\wedge\vec{B}"),
        ("Rail de Laplace : force", "Barre ℓ, courant i, B⃗ ⊥ plan. F = i ℓ B.", r"F=i\ell B"),
        ("Puissance de Laplace", "P = i (v ∧ B) · ℓ⃗ = −i e, avec e fem d'induction. Bilan mécanique ↔ électrique.", ""),
        ("Action = réaction Laplace / Laplace", "Deux fils parallèles : attraction si courants de même sens.", r"\dfrac{\mathrm{d}F}{\mathrm{d}\ell}=\dfrac{\mu_0 i_1 i_2}{2\pi d}"),
        ("Densité volumique de force de Laplace", "", r"\vec{f}=\vec{j}\wedge\vec{B}"),
        ("Haut-parleur / moteur (idée)", "Conversion i, B → force. Reciprocité : induction.", ""),
    ],
))

DECKS.append((
    "EA3 - Induction de Lorentz.xml",
    "MP* EA3 - Induction de Lorentz",
    "2.10",
    "Fem de Lorentz, loi de Lenz, rail mobile.",
    [
        ("Fem d'induction le long d'un fil mobile", "Charges du conducteur subissent v⃗ ∧ B⃗.", r"e=\int(\vec{v}\wedge\vec{B})\cdot\mathrm{d}\vec{\ell}"),
        ("Loi de Faraday (flux) — cas Lorentz", "e = −dΦ/dt pour un circuit filiforme dont le flux de B change par mouvement.", r"e=-\dfrac{\mathrm{d}\Phi}{\mathrm{d}t}"),
        ("Loi de Lenz", "Le courant induit s'oppose à la cause qui lui donne naissance (flux de B).", ""),
        ("Rail de Laplace : équation électrique", "e = B ℓ v, L R circuit. i = (B ℓ v − …)/R.", r"e=B\ell v"),
        ("Conversion électromécanique", "P_meca + P_élec,Joule + dE_magn/dt = 0 (bilan). Freinage par courants de Foucault.", ""),
        ("Courants de Foucault", "Courants induits dans un conducteur massif. Dissipation Joule, freinage, chauffage.", ""),
        ("Condition pour une fem de Lorentz non nulle", "Le conducteur (ou une partie) coupe les lignes de B (v⃗ non parallèle à B⃗, circuit ouvert éventuellement polarisé).", ""),
    ],
))

DECKS.append((
    "EB0 - Topographie des champs.xml",
    "MP* EB0 - Topographie",
    "2.11",
    "Lignes de champ, flux, circulation, symétries.",
    [
        ("Ligne de champ", "Courbe tangente à E⃗ (ou B⃗) en chaque point. On ne se croise pas (sauf E = 0).", ""),
        ("Symétries de E⃗ créé par des charges", "Plan de symétrie des charges : E⃗ dans le plan. Plan d'antisymétrie : E⃗ orthogonal au plan.", ""),
        ("Symétries de B⃗ créé par des courants", "Plan de symétrie des courants : B⃗ orthogonal. Plan d'antisymétrie : B⃗ dans le plan. (Inverse de E.)", ""),
        ("Invariance par translation / rotation", "Le champ ne dépend que des coordonnées non invariantes. Simplifie Gauss / Ampère.", ""),
        ("Flux d'un champ à travers une surface", "", r"\Phi=\iint\vec{E}\cdot\mathrm{d}\vec{S}"),
        ("Circulation le long d'une courbe", "", r"C=\int\vec{E}\cdot\mathrm{d}\vec{\ell}"),
        ("Tube de champ", "Ensemble des lignes s'appuyant sur un contour. Pour B⃗, flux conservé le long d'un tube (div B = 0).", ""),
    ],
))

DECKS.append((
    "EB1 - Dipôle électrostatique.xml",
    "MP* EB1 - Dipôle électrostatique",
    "2.11",
    "Moment dipolaire, potentiel et champ lointain.",
    [
        ("Moment dipolaire électrostatique", "De −q vers +q. p⃗ = q d⃗.", r"\vec{p}=q\vec{d}"),
        ("Potentiel lointain d'un dipôle", "Développement en 1/r² (le terme de charge totale est nul).", r"V(M)=\dfrac{1}{4\pi\varepsilon_0}\dfrac{\vec{p}\cdot\vec{u}_r}{r^2}"),
        ("Champ lointain (allure)", "E⃗ ∝ 1/r³. Lignes sortent de + et rentrent en −.", ""),
        ("Énergie d'un dipôle dans E⃗ extérieur (uniforme)", "", r"E_p=-\vec{p}\cdot\vec{E}"),
        ("Moment des forces sur un dipôle", "Tend à aligner p⃗ sur E⃗.", r"\vec{\mathcal{M}}=\vec{p}\wedge\vec{E}"),
        ("Force sur un dipôle dans un champ non uniforme", "Attiré vers les zones de fort |E| si p⃗ // E⃗.", r"\vec{F}=(\vec{p}\cdot\overrightarrow{\mathrm{grad}})\vec{E}"),
        ("Polarisation d'un diélectrique (idée)", "Dipôles microscopiques → P⃗ densité volumique de moment dipolaire.", ""),
    ],
))

DECKS.append((
    "EB2 - Dipôle magnétostatique.xml",
    "MP* EB2 - Dipôle magnétostatique",
    "2.12",
    "Moment magnétique, spire, aimant.",
    [
        ("Moment magnétique d'une spire plane", "I courant, S⃗ = S n⃗ orienté par le courant (droitier).", r"\vec{m}=I\vec{S}"),
        ("Analogie avec le dipôle électrique", "m⃗ joue le rôle de p⃗, B⃗ celui de E⃗. E_p = − m⃗ · B⃗, ⃗M = m⃗ ∧ B⃗.", r"E_p=-\vec{m}\cdot\vec{B}"),
        ("Champ lointain d'un dipôle mag.", "Même structure angulaire que le dipôle élec., en 1/r³, avec μ₀/4π.", ""),
        ("Aimant / aimantation", "M⃗ = densité volumique de moment magnétique. Équivalent à des courants microscopiques.", ""),
        ("Couple sur une boussole", "L'aiguille s'aligne sur B⃗ terrestre (composante horizontale).", ""),
        ("Expérience d'Ørsted (rappel)", "Un courant crée un champ mag. qui oriente une boussole.", ""),
        ("Spire dans B⃗ uniforme", "Résultante nulle, couple non nul si m⃗ non aligné.", ""),
    ],
))

DECKS.append((
    "TB1 - Équation de diffusion.xml",
    "MP* TB1 - Équation de diffusion",
    "2.12",
    "Fourier, conservation, équation de la chaleur 1D.",
    [
        ("Loi de Fourier", "Flux thermique opposé au gradient de T. λ conductivité thermique.", r"\vec{j}_Q=-\lambda\overrightarrow{\mathrm{grad}}T"),
        ("Conservation de l'énergie (local, sans source)", "e densité d'énergie interne thermique ≈ ρ c T.", r"\dfrac{\partial e}{\partial t}+\mathrm{div}\,\vec{j}_Q=0"),
        ("Équation de la chaleur (λ, ρ, c constants)", "D = λ/(ρ c) diffusivité.", r"\dfrac{\partial T}{\partial t}=D\Delta T"),
        ("Analogie avec la diffusion de particules", "Même équation pour n(x,t). Loi de Fick j⃗ = −D grad n.", ""),
        ("Temps caractéristique de diffusion", "Sur une longueur L : τ ∼ L² / D. La chaleur ne se propage pas à célérité finie dans ce modèle.", r"\tau\sim L^2/D"),
        ("Régime stationnaire 1D sans source", "div j_Q = 0 ⇒ j_Q constant ⇒ T linéaire si section constante.", ""),
        ("Conditions aux limites usuelles", "T imposée (Dirichlet) ou flux imposé (Neumann, éventuellement Newton : −λ ∂T/∂n = h (T−T_ext)).", ""),
    ],
))

DECKS.append((
    "TB2 - Solutions classiques de la diffusion.xml",
    "MP* TB2 - Solutions classiques",
    "2.13",
    "Régime transitoire, profils types, ailette.",
    [
        ("Profil d'erreur (mur semi-infini)", "T(x,t) s'exprime avec erf(x / √(4Dt)). Épaisseur de peau thermique √(Dt).", ""),
        ("Régime sinusoïdal forcé (onde thermique)", "Pénétration δ = √(2D/ω). Déphasage avec la profondeur.", r"\delta=\sqrt{2D/\omega}"),
        ("Ailette stationnaire", "Compétition conduction / conv. latérale. Longueur caractéristique √(λS / hP).", ""),
        ("Résistance de contact", "Saut de T à une interface imparfaite. j_Q = ΔT / r_c.", ""),
        ("Superposition", "Équation linéaire : on superpose des solutions (CI, CL).", ""),
        ("Ordres de grandeur de D", "Métaux : D grand (10⁻⁵–10⁻⁴ m²/s). Isolants / liquides : plus petit. Diffusion de particules en gaz ≫ solides.", ""),
        ("Lien avec l'effet de peau EM", "Même mathématique (équation de diffusion pour B⃗ dans un conducteur ohmique).", ""),
    ],
))

DECKS.append((
    "TB3 - Diffusion 3D.xml",
    "MP* TB3 - Vision 3D de la diffusion",
    "2.13",
    "Laplacien, symétries, régime stationnaire.",
    [
        ("Laplacien en cartésien", "", r"\Delta T=\partial_x^2 T+\partial_y^2 T+\partial_z^2 T"),
        ("Régime stationnaire : équation de Laplace / Poisson", "Sans source : ΔT = 0. Avec source volumique : −λ ΔT = p_vol.", ""),
        ("Symétrie sphérique stationnaire", "j_Q × 4π r² = P_tot (conservation). T(r) en 1/r hors sources.", ""),
        ("Symétrie cylindrique stationnaire", "j_Q × 2π r L = P. T en ln r.", ""),
        ("Analogie électrostatique", "T ↔ V, j_Q ↔ j⃗, λ ↔ σ. Gauss thermique.", ""),
        ("Principe du maximum", "En stationnaire sans source, T n'a pas d'extremum intérieur (conséquence de Laplace).", ""),
        ("Résistance thermique d'une paroi plane", "R_th = e / (λ S). Q̇ = ΔT / R_th.", r"R_\mathrm{th}=e/(\lambda S)"),
    ],
))

DECKS.append((
    "TB4 - Résistance thermique et diffusion radiale.xml",
    "MP* TB4 - Résistance thermique et diffusion radiale",
    "2.13",
    "Associations de résistances thermiques, cylindre, sphère.",
    [
        ("Loi d'Ohm thermique", "Analogie U ↔ ΔT, I ↔ Q̇, R ↔ R_th.", r"\dot Q=\Delta T/R_\mathrm{th}"),
        ("Parois en série / parallèle", "Série : même flux, R s'ajoutent. Parallèle : même ΔT, 1/R s'ajoutent.", ""),
        ("R_th d'une coquille sphérique", "Entre r₁ et r₂.", r"R_\mathrm{th}=\dfrac{1}{4\pi\lambda}\left(\dfrac{1}{r_1}-\dfrac{1}{r_2}\right)"),
        ("R_th d'une coquille cylindrique (longueur L)", "", r"R_\mathrm{th}=\dfrac{\ln(r_2/r_1)}{2\pi\lambda L}"),
        ("Convection : résistance h", "Q̇ = h S ΔT ⇒ R_th,conv = 1/(h S).", r"R_\mathrm{th,conv}=1/(hS)"),
        ("Circuit thermique d'un calorifugeage", "Conduction de l'isolant + conv. extérieure en série. Il existe parfois une épaisseur optimale (cylindre).", ""),
        ("Régime quasi-stationnaire", "Si transitoire interne ≪ temps d'observation : profil spatial ≈ stationnaire, T_m(t) lente.", ""),
    ],
))

DECKS.append((
    "TC1 - Hydrostatique.xml",
    "MP* TC1 - Hydrostatique",
    "2.14",
    "Pression dans un fluide au repos, Archimède.",
    [
        ("Relation fondamentale de la statique des fluides", "Fluide au repos dans g⃗ uniforme.", r"\overrightarrow{\mathrm{grad}}P=\rho\vec{g}"),
        ("Pression dans un liquide incompressible", "z vers le haut.", r"P=P_0+\rho g (z_0-z)"),
        ("Loi d'atmosphère isotherme (GP)", "P(z) = P₀ e^{−z/H}, H = RT/(Mg).", r"H=\dfrac{RT}{Mg}"),
        ("Poussée d'Archimède (rappel)", "Oppposée au poids du fluide déplacé. Centre de poussée = CDM du fluide déplacé.", ""),
        ("Surface isobare", "Orthogonale à g⃗ (liquide). Dans l'atmosphère, couches horizontales si g uniforme.", ""),
        ("Paradoxe hydrostatique", "La force sur le fond ne dépend que de P et de S, pas du volume total au-dessus si la surface libre est à z fixé.", ""),
        ("Manomètre / baromètre", "Hauteur de colonne : ΔP = ρ g h.", ""),
    ],
))

DECKS.append((
    "TC2 - Systèmes à deux niveaux.xml",
    "MP* TC2 - Systèmes à deux niveaux",
    "2.14",
    "Facteur de Boltzmann, population, paramagnétisme.",
    [
        ("Facteur de Boltzmann", "Proba d'un état d'énergie E à température T.", r"p\propto e^{-E/k_B T}"),
        ("Système à deux niveaux E = ±ε", "n₊ / n₋ = e^{−2ε / kT} si ε est le demi-écart (selon convention). Population du fondamental dominante à T → 0.", ""),
        ("Énergie moyenne", "⟨E⟩ interpolé entre −ε (T=0) et 0 (T→∞, équipartition des deux niveaux).", ""),
        ("Capacité thermique d'un TLS", "Pic de Schottky : C → 0 à T=0 et T→∞.", ""),
        ("Température infinie / inversion", "Équipopulation à T→∞. Inversion de population ⇔ T formellement négative (hors équilibre thermique).", ""),
        ("Moment magnétique à deux orientations", "Paramagnétisme de Langevin à deux états : ⟨μ⟩ = μ tanh(μB / kT).", r"\langle\mu\rangle=\mu\tanh(\mu B/k_B T)"),
        ("k_B T à 300 K en eV", "k_B T ≃ 25 meV ≃ 1/40 eV. Compare les écarts d'énergie (liaison, spin, photon IR…).", ""),
    ],
))

DECKS.append((
    "TC3 - Systèmes complexes.xml",
    "MP* TC3 - Systèmes complexes",
    "2.14",
    "Ensemble canonique, fonction de partition, gaz parfait.",
    [
        ("Ensemble canonique", "Système à T fixée par un thermostat. Z = ∑ e^{−E_i / kT}.", r"Z=\sum_i e^{-E_i/k_B T}"),
        ("Énergie libre de Helmholtz", "F = − kT ln Z = U − T S. Minimum à T, V, N fixés.", r"F=-k_B T\ln Z"),
        ("Énergie moyenne canonique", "", r"U=-\dfrac{\partial\ln Z}{\partial\beta}\qquad\beta=1/k_B T"),
        ("Facteur de partition d'un GP monoatomique (idée)", "Z_1 ∝ V (T)^{3/2}. U = (3/2) N kT. Pression : P V = N kT.", ""),
        ("Extensivité et indiscernabilité", "Pour N particules indiscernables indépendantes : Z = Z_1^N / N!. Évite le paradoxe de Gibbs.", ""),
        ("Équipartition (rappel)", "Chaque terme quadratique de l'énergie contribue pour ½ kT par particule (classique).", ""),
        ("Lien S et Z", "S = k (ln Z + β U). L'entropie statistique mesure le log du nombre d'états accessibles.", ""),
    ],
))

DECKS.append((
    "CB1 - Pile.xml",
    "MP* CB1 - La pile",
    "2.15",
    "Oxydoréduction, Nernst, fem à vide.",
    [
        ("Définition d'une pile", "Générateur électrochimique spontané (Δ_r G < 0). Anode : oxydation. Cathode : réduction.", ""),
        ("Convention de notation", "Anode | électrolyte | cathode. Ex. Zn | Zn²⁺ || Cu²⁺ | Cu.", ""),
        ("Équation de Nernst (à 25 °C, log10)", "E° potentiel standard. Q quotient des ox/red.", r"E=E^\circ+\dfrac{0,059}{n}\log\dfrac{[\mathrm{ox}]}{[\mathrm{red}]}"),
        ("Fem à vide E_pile", "E_pile = E_cathode − E_anode (potentiels de Nernst). E_pile° = E°_c − E°_a.", ""),
        ("Lien Δ_r G° et E°", "n Faraday, n e⁻ échangés.", r"\Delta_r G^\circ=-n F E^\circ"),
        ("Sens spontané", "Le couple de plus grand E oxyde le réducteur du couple de plus petit E.", ""),
        ("Pont salin", "Assure l'électroneutralité sans mélanger trop vite les compartiments. Ferme le circuit ionique.", ""),
    ],
))

DECKS.append((
    "CB2 - Pile qui débite.xml",
    "MP* CB2 - Pile qui débite",
    "2.15",
    "Intensité, faraday, capacité, rendement.",
    [
        ("Faraday", "Charge d'une mole d'électrons. F = N_A e ≃ 96500 C·mol⁻¹.", r"F=N_A e"),
        ("Quantité de matière convertie", "Pour n e⁻ dans l'équation, I t / (n F) moles de réaction.", r"\xi=It/(nF)"),
        ("Tension aux bornes en débit", "U = E_pile − r I (résistance interne, surtensions). U < E à vide.", ""),
        ("Puissance électrique fournie", "P = U I. Maximale pour une charge égale à r (modèle linéaire).", ""),
        ("Capacité d'une pile (Ah)", "Charge totale extractible. Limitée par le réactif en défaut.", ""),
        ("Polarisation / surtension", "Écart à Nernst dû à la cinétique (transfert, diffusion). Augmente les pertes.", ""),
        ("Bilan énergétique", "Une partie de −Δ_r G part en chaleur (Joule, irréversibilités), le reste en travail électrique.", ""),
    ],
))

DECKS.append((
    "CB3 - Pile qui recharge.xml",
    "MP* CB3 - Pile qui recharge (électrolyse)",
    "2.16",
    "Électrolyse, tension minimale, accumulateurs.",
    [
        ("Électrolyse", "Transformation forcée (Δ_r G > 0) par une source. Anode toujours oxydation, cathode réduction.", ""),
        ("Tension minimale (idéale)", "U_min = E_anode − E_cathode (souvent |E_pile| du sens inverse). En pratique U > U_min (surtensions).", ""),
        ("Accumulateur", "Pile rechargeable. Charge = électrolyse. Décharge = pile.", ""),
        ("Rendement faradique", "Rapport de la charge utile à la charge circulée (réactions parasites : H₂O, corrosion).", ""),
        ("Eau : potentiels et dégagements", "Réduction : H₂ (ou O₂ selon pH). Oxydation : O₂. D'où 1,23 V théoriques pour l'eau.", ""),
        ("Concurrence des réactions", "À une électrode, la réaction de plus faible |surtension| / plus favorable cinétiquement gagne.", ""),
        ("Diagramme E–pH (idée)", "Domaines de prédominance / d'existence (eau, métal, oxydes). Prévoit corrosion, passivation, immunité.", ""),
    ],
))

DECKS.append((
    "EC1 - Théorème de Gauss.xml",
    "MP* EC1 - Théorème de Gauss",
    "2.17",
    "Flux de E, distributions à forte symétrie.",
    [
        ("Théorème de Gauss (électrostatique)", "Q_int charge algébrique intérieure.", r"\iint_{\partial V}\vec{E}\cdot\mathrm{d}\vec{S}=\dfrac{Q_\mathrm{int}}{\varepsilon_0}"),
        ("Forme locale", "", r"\mathrm{div}\,\vec{E}=\rho/\varepsilon_0"),
        ("Plan infini chargé σ", "E = σ/(2ε₀) de chaque côté, orthogonal au plan (symétrie).", r"E=\sigma/(2\varepsilon_0)"),
        ("Fil infini λ", "E = λ /(2π ε₀ r), radial.", r"E=\dfrac{\lambda}{2\pi\varepsilon_0 r}"),
        ("Sphère / boule uniformément chargée", "Dehors : comme une charge ponctuelle au centre. Dedans (boule) : E ∝ r.", r"E_\mathrm{ext}=\dfrac{1}{4\pi\varepsilon_0}\dfrac{Q}{r^2}"),
        ("Conducteur en équilibre", "E = 0 à l'intérieur. Charge surfacique. E_juste_dehors = σ/ε₀ n⃗ (théorème de Coulomb).", ""),
        ("Choix de la surface de Gauss", "Faire E constant et // dS sur les faces utiles, 0 ailleurs, en suivant les invariances.", ""),
    ],
))

DECKS.append((
    "EC2 - Condensateur.xml",
    "MP* EC2 - Condensateur",
    "2.17",
    "Capacité, énergie électrostatique, associations.",
    [
        ("Définition de la capacité", "Q charge d'une armature, U tension.", r"C=Q/U"),
        ("Condensateur plan", "e ≪ √S. E = σ/ε₀ entre les plaques.", r"C=\varepsilon_0 S/e"),
        ("Énergie stockée", "", r"E_el=\dfrac12 C U^2=\dfrac{Q^2}{2C}"),
        ("Densité d'énergie électrostatique", "", r"u_e=\dfrac12\varepsilon_0 E^2"),
        ("Associations série / parallèle", "Parallèle : C s'ajoutent. Série : 1/C s'ajoutent.", ""),
        ("Condensateur cylindrique / sphérique", "Se déduit de Gauss + V = −∫ E·dℓ.", ""),
        ("Diélectrique (idée MP)", "C → κ C (κ > 1). Polarisation, diminution de E pour Q fixé.", ""),
    ],
))

DECKS.append((
    "EC3 - Théorème d'Ampère.xml",
    "MP* EC3 - Théorème d'Ampère",
    "2.18",
    "Circulation de B, fil, nappe, cylindre.",
    [
        ("Théorème d'Ampère (magnétostatique)", "I_enl courant algébrique enlacet (droitier).", r"\oint\vec{B}\cdot\mathrm{d}\vec{\ell}=\mu_0 I_\mathrm{enl}"),
        ("Forme locale", "", r"\overrightarrow{\mathrm{rot}}\,\vec{B}=\mu_0\vec{j}"),
        ("Fil infini", "B = μ₀ I /(2π r), lignes = cercles.", r"B=\dfrac{\mu_0 I}{2\pi r}"),
        ("Nappe de courant (K vecteur dens. surfacique)", "Saut de B tangentiel : n⃗ ∧ (B₂ − B₁) = μ₀ K⃗.", ""),
        ("Cylindre / tube infini", "Dehors : comme un fil. Cavité intérieure d'un tube : B = 0 si courants longitudinaux uniformes sur la paroi (selon distrib.).", ""),
        ("μ₀", "4π × 10⁻⁷ H·m⁻¹. c = 1/√(μ₀ ε₀).", r"c=1/\sqrt{\mu_0\varepsilon_0}"),
        ("Choix du contour d'Ampère", "B // et constant sur le contour, orthogonal ailleurs. Suivre invariances (cercles, rectangles).", ""),
    ],
))

DECKS.append((
    "EC4 - Solénoïde.xml",
    "MP* EC4 - Solénoïde",
    "2.18",
    "Champ d'un solénoïde, inductance propre.",
    [
        ("Solénoïde infini, n spires par mètre", "B intérieur = μ₀ n I, axial. B extérieur = 0.", r"B=\mu_0 n I"),
        ("Flux à travers une spire / inductance propre", "Φ_tot = L I. Pour N spires, section S, longueur ℓ : n = N/ℓ.", r"L=\mu_0 n^2 S\ell=\mu_0 N^2 S/\ell"),
        ("Énergie magnétique d'une inductance", "", r"E_m=\dfrac12 L I^2"),
        ("Densité d'énergie magnétique", "", r"u_m=\dfrac{B^2}{2\mu_0}"),
        ("Tore (solénoïde refermé)", "B ≃ μ₀ N I /(2π r) à l'intérieur, 0 hors du tore (idéal).", ""),
        ("Solénoïde fini : fuites", "Lignes se referment à l'extérieur. B_ext ≠ 0, B_int non parfaitement uniforme.", ""),
        ("Bobine comme dipôle", "Moment m = N I S, analogue à un aimant droit.", ""),
    ],
))

DECKS.append((
    "ED1 - Équations de Maxwell.xml",
    "MP* ED1 - Équations de Maxwell",
    "2.18",
    "Les quatre équations, courant de déplacement.",
    [
        ("Maxwell–Gauss", "", r"\mathrm{div}\,\vec{E}=\rho/\varepsilon_0"),
        ("Maxwell–Thomson", "Pas de monopôle magnétique.", r"\mathrm{div}\,\vec{B}=0"),
        ("Maxwell–Faraday", "Induction. Forme intégrale : ∮ E·dℓ = − dΦ_B / dt.", r"\overrightarrow{\mathrm{rot}}\,\vec{E}=-\dfrac{\partial\vec{B}}{\partial t}"),
        ("Maxwell–Ampère", "j⃗_D = ε₀ ∂E⃗/∂t courant de déplacement.", r"\overrightarrow{\mathrm{rot}}\,\vec{B}=\mu_0\vec{j}+\mu_0\varepsilon_0\dfrac{\partial\vec{E}}{\partial t}"),
        ("Pourquoi le courant de déplacement ?", "Sans lui, div j⃗ + ∂ρ/∂t ≠ 0. Il assure la conservation de la charge.", r"\mathrm{div}\,\vec{j}+\dfrac{\partial\rho}{\partial t}=0"),
        ("Équations dans le vide (ρ = 0, j = 0)", "Ondes EM à la célérité c. E⃗ et B⃗ transverses, |B| = |E|/c.", ""),
        ("ARQS / quasi-permanent", "On néglige ∂E/∂t dans Ampère et parfois le retard. Circuits de taille ≪ λ.", ""),
    ],
))

DECKS.append((
    "ED2 - Manipuler Maxwell.xml",
    "MP* ED2 - Manipuler les équations de Maxwell",
    "2.20",
    "Équation de propagation, jauge, potentiels.",
    [
        ("Équation de d'Alembert pour E⃗ dans le vide", "Idem pour B⃗.", r"\Delta\vec{E}-\dfrac{1}{c^2}\dfrac{\partial^2\vec{E}}{\partial t^2}=\vec{0}"),
        ("Potentiels V et A⃗", "B = rot A, E = −grad V − ∂A/∂t. Liberté de jauge.", r"\vec{B}=\overrightarrow{\mathrm{rot}}\vec{A}"),
        ("Jauge de Lorenz (idée)", "Lie V et A pour obtenir des d'Alembert sourcés par ρ et j⃗.", ""),
        ("Continuité de E_∥ et B_⊥", "E_∥ discontinu si nappe de courant (saut de B_∥). B_⊥ toujours continu (div B = 0).", ""),
        ("Onde plane : structure", "k⃗, E⃗, B⃗ trièdre direct. E et B en phase dans le vide.", r"\vec{B}=\dfrac{1}{c}\vec{u}\wedge\vec{E}"),
        ("Vecteur de Poynting", "Densité de flux d'énergie EM.", r"\vec{\Pi}=\dfrac{\vec{E}\wedge\vec{B}}{\mu_0}"),
        ("Densité d'énergie EM", "", r"u=\dfrac12\varepsilon_0 E^2+\dfrac{B^2}{2\mu_0}"),
    ],
))

DECKS.append((
    "ED3 - Induction de Neumann.xml",
    "MP* ED3 - Induction de Neumann",
    "2.20",
    "B variable, circuit fixe, autoinduction.",
    [
        ("Induction de Neumann", "Circuit fixe, B⃗ variable. e = −dΦ/dt. Champ électrique induit (rot E ≠ 0).", r"e=-\dfrac{\mathrm{d}\Phi}{\mathrm{d}t}"),
        ("Différence Lorentz / Neumann", "Lorentz : charges mobiles dans B (souvent B constant). Neumann : B variable, circuit au repos. Les deux : Faraday.", ""),
        ("Loi de Lenz (rappel)", "Le courant induit s'oppose à la variation de flux.", ""),
        ("Spire dans un B(t) uniforme", "e = −S dB/dt si B ⊥ spire. Même si B est spatialement uniforme (E induit azimuthal).", ""),
        ("Transformateur (idée)", "Flux commun. u₁ / n₁ = u₂ / n₂ en régime idéal. Isolation galvanique.", ""),
        ("Courants de Foucault (B variable)", "Dissipation dans les masses conductrices. Tôles feuilletées pour les limiter.", ""),
        ("Champ E induit autour d'un solénoïde", "∮ E·dℓ = − dΦ/dt. E_θ × 2π r = − π R² dB/dt (r > R : Φ = π R² B).", ""),
    ],
))

DECKS.append((
    "ED4 - Auto et mutuelle induction.xml",
    "MP* ED4 - Auto et mutuelle induction",
    "2.20",
    "L, M, énergie mutuelle, couplage.",
    [
        ("Inductance propre L", "Φ_propre = L I. e = − L dI/dt.", r"e=-L\dfrac{\mathrm{d}I}{\mathrm{d}t}"),
        ("Inductance mutuelle M", "Φ_{21} = M I₁. Reciprocité M_{12} = M_{21} = M.", r"e_2=-M\dfrac{\mathrm{d}I_1}{\mathrm{d}t}"),
        ("Coefficient de couplage", "0 ≤ k ≤ 1. k = M / √(L₁ L₂).", r"k=M/\sqrt{L_1 L_2}"),
        ("Énergie de deux circuits couplés", "", r"E=\dfrac12 L_1 I_1^2+\dfrac12 L_2 I_2^2+M I_1 I_2"),
        ("Convention de signe de M", "M > 0 si les courants positifs produisent des flux de même sens (points de Born).", ""),
        ("RL série soumis à un échelon", "I(t) = (E/R)(1 − e^{−t/τ}), τ = L/R. i continue.", ""),
        ("Surtension à l'ouverture", "L di/dt grand si on coupe brutalement → arc. D'où diode de roue libre.", ""),
    ],
))

DECKS.append((
    "EE1 - Ondes dans le vide.xml",
    "MP* EE1 - Ondes dans le vide",
    "2.21",
    "OPP harmonique, polarisation, impédance du vide.",
    [
        ("OPPHE dans le vide", "E⃗ = E_m cos(ωt − k z) u⃗_x (ex.). k = ω/c. B⃗ = E_m/c cos(...) u⃗_y.", r"c=1/\sqrt{\mu_0\varepsilon_0}"),
        ("Impédance du vide", "Z₀ = E/H = √(μ₀/ε₀) ≃ 377 Ω. H = B/μ₀.", r"Z_0=\sqrt{\mu_0/\varepsilon_0}"),
        ("Intensité (Poynting moyen)", "", r"I=\langle\Pi\rangle=\dfrac12 c\varepsilon_0 E_m^2=\dfrac{E_m^2}{2Z_0}"),
        ("Polarisation rectiligne / circulaire", "Rectiligne : E dans une direction fixe. Circulaire : deux composantes égales en quadrature.", ""),
        ("Transversalité", "E⃗ ⊥ k⃗, B⃗ ⊥ k⃗, E⃗ ⊥ B⃗. Pas de composante longitudinale dans le vide.", ""),
        ("Pression de radiation (onde absorbée)", "Π/c. Réfléchie parfaitement : 2Π/c.", ""),
        ("Spectre EM (ordres)", "Radio ≪ micro-ondes ≪ IR ≪ visible (400–800 nm) ≪ UV ≪ X ≪ γ.", ""),
    ],
))

DECKS.append((
    "EE2 - Ondes et conducteurs.xml",
    "MP* EE2 - Ondes EM et conducteurs",
    "2.21",
    "Effet de peau, réflexion sur un métal.",
    [
        ("Conducteur ohmique : j⃗ = γ E⃗", "γ conductivité. Dans Maxwell–Ampère, le terme de conduction domine souvent ∂E/∂t (ARQS conducteur).", r"\vec{j}=\gamma\vec{E}"),
        ("Équation de diffusion de B⃗", "Dans un bon conducteur.", r"\dfrac{\partial\vec{B}}{\partial t}=D\Delta\vec{B}\quad D=1/(\mu_0\gamma)"),
        ("Épaisseur de peau", "δ = √(2/(μ₀ γ ω)). Courants et champs confinés sur δ.", r"\delta=\sqrt{\dfrac{2}{\mu_0\gamma\omega}}"),
        ("Réflexion sur un métal parfait", "E_∥ = 0 à la surface. Onde stationnaire, nœud de E, ventre de B à la paroi.", ""),
        ("Cavité / guide (idée)", "Modes discrets. Fréquence de coupure. Pas d'onde guidée sous f_c.", ""),
        ("Pertes Joule de peau", "Résistance surfacique R_s = 1/(γ δ). Dissipation ∝ H_∥² R_s.", ""),
        ("Blindage", "Un conducteur épais ≫ δ atténue fortement les champs variables.", ""),
    ],
))

DECKS.append((
    "EE3 - Onde dans un plasma.xml",
    "MP* EE3 - Onde dans un plasma",
    "2.21",
    "Pulsation plasma, relation de dispersion, coupure.",
    [
        ("Modèle du plasma (ions fixes, e⁻)", "n densité électronique. Force −e E⃗, pas de collisions (1re approx.).", ""),
        ("Pulsation plasma", "", r"\omega_p=\sqrt{\dfrac{n e^2}{\varepsilon_0 m_e}}"),
        ("Relation de dispersion (sans collisions)", "Onde n'existe que si ω > ω_p (milieu transparent). Sinon évanescente.", r"k^2 c^2=\omega^2-\omega_p^2"),
        ("Indice du plasma", "n = √(1 − ω_p²/ω²) < 1. v_φ = c/n > c, v_g = c² / v_φ < c.", r"n=\sqrt{1-\omega_p^2/\omega^2}"),
        ("Réflexion ionosphérique (idée)", "Ondes radio HF réfléchies si ω < ω_p local. Permet les liaisons longue distance.", ""),
        ("Densité de coupure", "Pour une ω donnée, n_c = ε₀ m_e ω² / e². Au-delà, la sonde ne pénètre pas.", ""),
        ("Collisions", "Ajout d'un terme d'amortissement : absorption, n complexe.", ""),
    ],
))

DECKS.append((
    "EE4 - Dipôle rayonnant.xml",
    "MP* EE4 - Dipôle rayonnant",
    "2.21",
    "Rayonnement d'un dipôle oscillant, zone de rayonnement.",
    [
        ("Dipôle de Hertz", "p⃗(t) = p_m cos(ωt) u⃗_z, taille ≪ λ. Source d'ondes sphériques.", ""),
        ("Zone de rayonnement (r ≫ λ)", "E⃗ et B⃗ ∝ 1/r, transverses, Poynting sortant. Diagramme en sin²θ.", ""),
        ("Puissance moyenne rayonnée (ordre / formule)", "∝ ω⁴ p_m² (très sensible à la fréquence). Formule de Larmor dipolaire.", r"\mathcal{P}\propto\omega^4 p_m^2"),
        ("Résistance de rayonnement", "Le dipôle « voit » une résistance qui dissipe la puissance rayonnée (pas Joule locale).", ""),
        ("Polarisation du champ rayonné", "E⃗ dans le plan méridien, ⊥ u⃗_r. Nulle dans l'axe du dipôle (θ = 0).", ""),
        ("Antenne λ/2 (idée)", "Résonance, diagramme analogue au dipôle élémentaire, plus directive un peu.", ""),
        ("Diffusion de Rayleigh (lien)", "Petites particules : dipôles induits, puissance ∝ ω⁴ → ciel bleu.", ""),
    ],
))

DECKS.append((
    "MC1 - Référentiels non galiléens en translation.xml",
    "MP* MC1 - Référentiels non galiléens en translation",
    "2.22",
    "Force d'entraînement, pesanteur effective.",
    [
        ("Loi de composition des accélérations (translation)", "a⃗_abs = a⃗_rel + a⃗_e, a⃗_e = a⃗_origine du mobile.", r"\vec{a}_\mathrm{abs}=\vec{a}_\mathrm{rel}+\vec{a}_e"),
        ("Force d'inertie d'entraînement (translation)", "À ajouter dans le PFD du référentiel non galiléen.", r"\vec{f}_e=-m\vec{a}_e"),
        ("Ascenseur accéléré", "Pesanteur effective g_eff = g − a_asc (si a vers le haut, on se sent plus lourd).", r"\vec{g}_\mathrm{eff}=\vec{g}-\vec{a}_e"),
        ("Chute libre du mobile (Einstein)", "g_eff = 0. Les flottements, trajectoires droites « sans pesanteur ».", ""),
        ("PFD dans R non galiléen (translation)", "", r"m\vec{a}_\mathrm{rel}=\vec{f}_\mathrm{vraies}+\vec{f}_e"),
        ("Travail de f_e", "Peut modifier E_m dans R_rel. À discuter selon a_e(t).", ""),
        ("Référentiel d'un véhicule en CRU", "Galiléen si le sol l'est. f_e = 0.", ""),
    ],
))

DECKS.append((
    "MC2 - Référentiels non galiléens en rotation.xml",
    "MP* MC2 - Référentiels non galiléens en rotation",
    "2.22",
    "Entraînement, Coriolis, centrifuge.",
    [
        ("Accélération d'entraînement (rotation uniforme / axe fixe)", "a_e = Ω⃗ ∧ (Ω⃗ ∧ r⃗) = − Ω² r_⊥ (centripète).", r"\vec{a}_e=\vec{\Omega}\wedge(\vec{\Omega}\wedge\vec{r})"),
        ("Accélération de Coriolis", "", r"\vec{a}_c=2\vec{\Omega}\wedge\vec{v}_\mathrm{rel}"),
        ("Force centrifuge", "f_e = − m a_e = m Ω² r_⊥, vers l'extérieur.", r"\vec{f}_\mathrm{centrifuge}=-m\vec{\Omega}\wedge(\vec{\Omega}\wedge\vec{r})"),
        ("Force de Coriolis", "f_c = − 2 m Ω⃗ ∧ v_rel. Orthogonale à v_rel, ne travaille pas.", r"\vec{f}_c=-2m\vec{\Omega}\wedge\vec{v}_\mathrm{rel}"),
        ("PFD dans R tournant (Ω constant)", "", r"m\vec{a}_\mathrm{rel}=\vec{f}-m\vec{a}_e-2m\vec{\Omega}\wedge\vec{v}_\mathrm{rel}"),
        ("Manège / Terre : ordres", "Coriolis visible sur de grandes vitesses / durées (vents, projectiles). Centrifuge terrestre : déjà dans g.", ""),
        ("Pendule de Foucault (idée)", "Rotation du plan d'oscillation due à Coriolis. Période 2π / (Ω sin λ).", ""),
    ],
))

DECKS.append((
    "MC3 - Référentiel terrestre.xml",
    "MP* MC3 - Référentiel terrestre",
    "2.23",
    "Pesanteur, déviations de Coriolis, verticale.",
    [
        ("Pesanteur g⃗", "g⃗ = G⃗_grav + Ω⃗ ∧ (Ω⃗ ∧ r⃗) (centrifuge). Légèrement hors du rayon terrestre (ellipsoïde).", ""),
        ("Verticale d'un lieu", "Direction de g⃗ (fil à plomb), pas exactement vers le centre.", ""),
        ("Déviation vers l'est d'une chute libre", "Effet Coriolis. Ordre δ ∼ Ω √(2h³/g) (latitude dépendante).", ""),
        ("Force de Coriolis horizontale", "Dans l'hémisphère nord, dévie vers la droite du mouvement (cyclones, rivières).", ""),
        ("Poids apparent", "P⃗ = m g⃗. La balance mesure ||P||, pas m G_grav.", ""),
        ("Référentiel géocentrique vs terrestre", "Géocentrique : quasi galiléen (translation autour du Soleil négligée en 1re approx. mécanique locale). Terrestre : tournant.", ""),
        ("Ω terrestre", "Ω = 2π / Tsidéral ≃ 7,3×10⁻⁵ rad·s⁻¹. T_sidéral ≃ 86164 s.", ""),
    ],
))

DECKS.append((
    "CC1 - Révision chimie des matériaux.xml",
    "MP* CC1 - Révision chimie des matériaux",
    "2.23",
    "Métaux, oxydes, diagrammes d'Ellingham (idée).",
    [
        ("Oxydation d'un métal", "M → M^{n+} + n e⁻. L'oxygène (ou H⁺) est souvent l'oxydant.", ""),
        ("Diagramme d'Ellingham (idée)", "Δ_r G°(T) des oxydations. Plus la droite est basse, plus l'oxyde est stable. Prévoit les réductions par C, CO, H₂, Al…", ""),
        ("Passivation", "Film d'oxyde compact (Al, Cr, inox) qui bloque la corrosion ultérieure.", ""),
        ("Échelle d'Ellingham et température", "La pente est −Δ_r S°. Changement de pente aux changements d'état.", ""),
        ("Aluminothermie", "Al réduit Fe₂O₃ car ΔG de formation de Al₂O₃ plus négatif (à T adaptée).", ""),
        ("Haut-fourneau (idée)", "Réduction des oxydes de fer par CO. Zones de T différentes.", ""),
        ("Métal « noble »", "E° élevé, difficile à oxyder (Au, Pt). Zn, Fe plus réducteurs.", ""),
    ],
))

DECKS.append((
    "CC2 - Corrosion.xml",
    "MP* CC2 - Corrosion",
    "2.23",
    "Corrosion humide, pile de corrosion, protection.",
    [
        ("Corrosion humide", "Pile locale : anode (métal s'oxyde), cathode (O₂ ou H⁺ se réduit) dans un électrolyte.", ""),
        ("Corrosion différentielle d'aération", "La zone moins aérée (O₂ faible) est anodique et se corrode (piqûres, joints).", ""),
        ("Protection cathodique", "Forcer le métal à être cathode : anode sacrificielle (Zn, Mg) ou courant imposé.", ""),
        ("Anode sacrificielle", "Métal plus réducteur que celui à protéger. Il s'oxyde à sa place.", ""),
        ("Inhibiteurs / revêtements", "Peinture, galvanisation (Zn), inox (passivation Cr). Isolent ou passivent.", ""),
        ("Diagramme de Pourbaix (E–pH)", "Immunité / corrosion / passivation. Attention : thermodynamique, pas cinétique.", ""),
        ("Corrosion galvanique", "Deux métaux en contact : le plus réducteur (petit E) s'oxyde. Surface cathodique grande ⇒ anode très attaquée.", ""),
    ],
))

DECKS.append((
    "L2 - Calculs.xml",
    "MP* L2 - Calculs",
    "2.01",
    "DL, ordres de grandeur, approximations usuelles en physique.",
    [
        ("DL usuels en 0 : cos, sin, tan, e^x, ln(1+x)", "À l'ordre 2 souvent suffisant en physique.", r"\cos x=1-x^2/2+o(x^2)\quad\sin x=x+o(x)"),
        ("√(1+x) et 1/(1+x)", "", r"\sqrt{1+x}=1+x/2+o(x)\qquad 1/(1+x)=1-x+o(x)"),
        ("Ordre de grandeur vs valeur précise", "Un OG se calcule avec 1 C.S. et des puissances de 10. Permet de négliger un terme dans une ED.", ""),
        ("Petite oscillation : sin θ ≃ θ", "θ en radians. Pendule, Gauss optique, Young paraxiaux.", ""),
        ("Moyenne temporelle d'un cos²", "⟨cos²(ωt)⟩ = 1/2. D'où les 1/2 en puissance moyenne.", r"\langle\cos^2\rangle=1/2"),
        ("Différentielle logarithmique", "d(ln X) = dX/X. Utile pour les incertitudes relatives et van't Hoff.", r"\dfrac{\mathrm{d}X}{X}=\mathrm{d}(\ln X)"),
        ("Linéarisation d'une ED autour d'un point d'équilibre", "x = x_eq + ε, on garde l'ordre 1 en ε → oscillateur ou exponentielle.", ""),
    ],
))


# Cartes supplémentaires (programme MP*, même densité que les cours 1A)
EXTRA = {
    "MA2 - Théorème du moment cinétique.xml": [
        ("TMC par rapport à un axe Δ", "Projection du TMC vectoriel. Utile pour les mouvements plans.", r"\dfrac{\mathrm{d}\sigma_\Delta}{\mathrm{d}t}=\mathcal{M}_\Delta"),
        ("Moment d'une force : bras de levier", "M_Δ = ± F × d, d distance de la droite d'action à l'axe.", r"\mathcal{M}_\Delta=\pm F d"),
        ("Kepler 2 (loi des aires)", "Conséquence de σ_O conservé : dA/dt = σ/(2m) constant.", r"\dfrac{\mathrm{d}A}{\mathrm{d}t}=\dfrac{\sigma_O}{2m}"),
        ("Potentiel effectif : barrière centrifuge", "L²/(2m r²) empêche r = 0 si L ≠ 0. Orbites liées si E < 0 (gravitation).", r"E_{p,\mathrm{eff}}=E_p(r)+\dfrac{L^2}{2m r^2}"),
        ("Condition de circularité", "Force centrale = m v²/r (ou dE_p,eff/dr = 0) et ṙ = 0.", ""),
    ],
    "MA3 - Autour des solides.xml": [
        ("Liaison pivot idéale", "Moment d'axe nul (pas de frottement). La réaction d'axe a un moment nul sur Δ.", ""),
        ("Puissance d'une force sur un solide / Δ", "P = M_Δ ω. Utile pour le TEC du solide.", r"P=\mathcal{M}_\Delta\,\omega"),
        ("Moment d'inertie : additivité", "J est additif. Une masse ponctuelle à distance d : md².", r"J=\sum m_i r_{\perp,i}^2"),
        ("Tige, disque, cylindre (ordres de J)", "Tige / axe médian ⊥ : mL²/12. Disque / axe : mR²/2. Cylindre / génératrice : …", r"J_\mathrm{disque,axe}=mR^2/2"),
        ("Roulis sans glissement", "Liaison holonome : v_G = R ω. Attention : le point de contact a v = 0 à chaque instant.", r"v_G=R\omega"),
    ],
    "MB1 - Vers l'équation d'onde.xml": [
        ("Célérité vs vitesse de la corde", "c est la vitesse de phase de la déformation, pas v_y = ∂y/∂t du brin de corde.", ""),
        ("Linéarisation (petites pentes)", "On suppose |∂y/∂x| ≪ 1 pour obtenir d'Alembert. Tension T₀ uniforme.", ""),
        ("Relation k, λ, f, T", "", r"k=2\pi/\lambda\qquad \omega=2\pi f\qquad \lambda=cT"),
        ("Condition de raccord (corde)", "y continue. T₀ ∂y/∂x peut sauter s'il y a une masse ponctuelle (TMC).", ""),
        ("Onde plane 3D", "Phase ωt − k⃗ · r⃗. Surfaces d'onde = plans ⊥ k⃗.", r"s=s_m\cos(\omega t-\vec{k}\cdot\vec{r})"),
    ],
    "MB2 - Ondes.xml": [
        ("Ventres et nœuds (corde, extrémités fixes)", "Nœuds : y = 0. Ventres : amplitude max. Distants de λ/4.", ""),
        ("Célérité du son dans l'air (ordre)", "c ≃ 340 m/s à 20 °C. Plus grande dans l'eau (≃ 1500 m/s) et les solides.", ""),
        ("Impédance acoustique", "Z = ρ c. Réflexion d'autant plus forte que Z contraste.", r"Z=\rho c"),
        ("Paquet d'ondes", "v_g = dω/dk transporte l'énergie (et l'information). v_φ = ω/k est la vitesse de phase.", r"v_g=\mathrm{d}\omega/\mathrm{d}k\qquad v_\varphi=\omega/k"),
        ("Résonance d'une corde excitée", "L'amplitude explose (sans amortissement) si f_exc = f_n. En pratique, amortissement limite.", ""),
    ],
    "OA1 - Rappel optique 1A.xml": [
        ("Construction d'une lentille convergente", "Rayon // axe → F'. Rayon par O non dévié. Rayon par F → // axe.", ""),
        ("Objet réel / image réelle", "Objet réel : rays incidents divergents (avant la lentille). Image réelle : rays émergents convergents (écran).", ""),
        ("Lentille divergente", "f' < 0. Image toujours virtuelle pour un objet réel (Gauss).", r"f'<0"),
        ("Grandissement transversal", "γ < 0 : image renversée. |γ| > 1 : agrandie.", r"\gamma=\dfrac{\overline{A'B'}}{\overline{AB}}=\dfrac{\overline{OA'}}{\overline{OA}}"),
        ("Condition de stigmatisme approché", "Dioptre sphérique / lentille mince + Gauss. Le stigmatisme rigoureux est rare (plan miroir, ellipse…).", ""),
    ],
    "OA2 - Modèle scalaire des ondes lumineuses.xml": [
        ("Amplitude complexe d'une vibration lumineuse", "s = Re[a e^{jωt}]. a contient l'amplitude et la phase spatiale.", r"a=A e^{-j\varphi}"),
        ("Différence de chemin et cohérence", "Si |δ| ≫ ℓ_c, on moyenne cos φ → plus de terme d'interférence.", ""),
        ("Principe de Huygens–Fresnel (idée)", "Chaque point d'une surface d'onde est source secondaire. Base de la diffraction.", ""),
        ("Indice et retard", "Traverser e d'indice n retarde de (n−1)e par rapport à l'air (même e).", r"\delta=(n-1)e"),
        ("Lumière polarisée : limite du modèle scalaire", "Dès que la polarisation compte (Brewster, lames λ/4), on revient au vecteur E⃗.", ""),
    ],
    "OB1 - Trous de Young.xml": [
        ("Dispositif des Young (schéma mental)", "Source S, deux trous S₁ S₂, écran. Trous = sources secondaires cohérentes.", ""),
        ("Ordre au centre", "Si les chemins SS₁ et SS₂ sont égaux, p(0) = 0 : frange centrale brillante.", ""),
        ("Contraste (visibilité de Michelson)", "V = (I_max − I_min)/(I_max + I_min). V = 1 si I₁ = I₂ et cohérence totale.", r"V=\dfrac{I_\mathrm{max}-I_\mathrm{min}}{I_\mathrm{max}+I_\mathrm{min}}"),
        ("Largeur des trous", "Trop larges → diffraction individuelle étroite et cohérence spatiale dégradée. Compromis.", ""),
        ("Mesure de λ par les Young", "i = λ D / a ⇒ λ = i a / D. Classique de TP.", r"\lambda=ia/D"),
    ],
    "OB2 - Young et variantes.xml": [
        ("Compensateur de Babinet / lame de verre", "Décale les franges sans changer i (δ additif constant).", ""),
        ("Trous éclairés en lumière blanche", "Seul le centre reste blanc ; les bords s'iriseraient puis le contraste tombe (ℓ_c petit).", ""),
        ("Fentes de Young vs trous", "Fentes : figure invariante selon la fente (plus de lumière). Interfrange identique en x.", ""),
        ("Source à l'infini", "On place S au foyer objet d'une collimatrice : onde plane sur les trous.", ""),
        ("Condition a θ ≪ λ", "θ = taille angulaire de la source vue des trous. Sinon V s'effondre.", r"a\theta\ll\lambda"),
    ],
    "OB3 - Interféromètre de Michelson.xml": [
        ("Réglage du contact optique", "On cherche la teinte plate. Puis on ouvre en lame d'air (anneaux) ou coin (droites).", ""),
        ("Pourquoi 2e dans δ = 2e cos i", "Aller-retour dans la lame d'air d'épaisseur e.", ""),
        ("Localisation lame d'air vs coin d'air", "Lame : infini (anneaux). Coin : au voisinage du coin (droites).", ""),
        ("Lumière blanche au Michelson", "Franges seulement près du contact (ℓ_c ~ μm). Irisation, teinte de Newton.", ""),
        ("Mesure d'une longueur d'onde", "On compte N franges pour un Δe connu : λ = 2 Δe / N.", r"\lambda=2\Delta e/N"),
    ],
    "OB4 - Cohérence.xml": [
        ("Largeur spectrale et ℓ_c", "Un filtre étroit augmente ℓ_c. Un laser a ℓ_c énorme (mètres en TP).", ""),
        ("Battements de contraste (doublet)", "V(e) module à la période Λ = λ² / Δλ. Permet de mesurer un doublet.", r"\Lambda=\lambda^2/\Delta\lambda"),
        ("Cohérence spatiale d'une étoile (idée)", "Interféromètre de Fizeau / stellar : la base a où V s'annule donne le diamètre angulaire.", ""),
        ("Train d'ondes", "Durée τ_c, longueur c τ_c. Deux trains ne interfèrent que s'ils se recouvrent.", ""),
        ("Éclairage spatialement cohérent", "Source ponctuelle (ou fente étroite) + grande distance, ou laser.", ""),
    ],
    "TA1 - Principes de la thermodynamique.xml": [
        ("Fonction d'état vs fonction de transfert", "U, S, H, T, P, V : d'état. W et Q : transferts, dépendent du chemin.", ""),
        ("Identité pour H", "", r"\mathrm{d}H=T\mathrm{d}S+V\mathrm{d}P"),
        ("Capacités thermiques", "C_V = (∂U/∂T)_V, C_P = (∂H/∂T)_P. Pour un GP, ne dépendent que de T (souvent constantes).", r"C_V=(\partial U/\partial T)_V"),
        ("Détente de Joule (vide)", "W = 0, Q = 0 ⇒ ΔU = 0. Pour un GP, T finale = T initiale.", ""),
        ("Entropie créée par frottement / choc visqueux", "S_créée > 0. L'énergie mécanique « perdue » chauffe, donc augmente S.", ""),
    ],
    "TA2 - Machines thermiques.xml": [
        ("Énoncé de Kelvin", "Impossible de convertir intégralement de la chaleur d'une seule source en travail, en cycle.", ""),
        ("Énoncé de Clausius", "La chaleur ne passe pas spontanément du froid vers le chaud.", ""),
        ("Cycle moteur réel vs Carnot", "η < η_C à cause des irréversibilités (frottements, ΔT aux sources, détentes brutales).", ""),
        ("Diagramme (T, S) d'un Carnot", "Rectangle. |W| = aire. Q_c = T_c ΔS, |Q_f| = T_f ΔS.", ""),
        ("Pompe à chaleur : COP", "On veut Q_c (chauffage). COP = |Q_c|/W ≤ T_c/(T_c − T_f).", r"e_\mathrm{PC}\le T_c/(T_c-T_f)"),
    ],
    "CA1 - Thermochimie.xml": [
        ("État standard de formation", "Δ_f H° des corps simples dans leur état standard = 0 par convention.", ""),
        ("Réaction de combustion", "Δ_c H° < 0. Permet Hess si on n'a que des combustions tabulées.", ""),
        ("Grandeurs molaires de réaction", "Δ_r X = ∑ ν_i X_m,i (ν_i algébriques : >0 produits, <0 réactifs).", ""),
        ("Température et Δ_r H", "Souvent on prend Δ_r H°(298 K) même à une autre T si Δ_r C_p est mal connu (approx.).", ""),
        ("Calorimétrie (idée)", "Q_p = ΔH du système. On mesure ΔT du calorimètre et on remonte à Δ_r H.", ""),
    ],
    "CA2 - Sens et évolution d'une réaction.xml": [
        ("Critère d'équilibre", "Δ_r G = 0 ⇔ Q_r = K°. Hors équilibre, le sens est celui qui rapproche Q de K.", ""),
        ("Variance (idée de Gibbs)", "Ω = 2 + C − φ (−r relations). Prévoit les paramètres intensifs libres.", ""),
        ("Influence de P sur K°", "K° ne dépend que de T. Mais Q_r des gaz dépend des pressions → l'équilibre se déplace avec P.", ""),
        ("Δ_r G° et K° : lien d'ordre", "Δ_r G° ≪ 0 ⇒ K° ≫ 1 (réaction quantitative). Δ_r G° ≫ 0 ⇒ K° ≪ 1.", ""),
        ("Enthalpie libre standard de formation", "Δ_f G° , même Hess que pour H. Δ_r G°(T) ≈ Δ_r H° − T Δ_r S° (si peu variables).", r"\Delta_r G^\circ=\Delta_r H^\circ-T\Delta_r S^\circ"),
    ],
    "CA3 - Révision chimie des solutions.xml": [
        ("Constante d'acidité Ka", "AH = A⁻ + H⁺. pKa = −log Ka. Plus pKa est petit, plus l'acide est fort.", r"K_a=\dfrac{[\mathrm{A}^-][\mathrm{H}_3\mathrm{O}^+]}{[\mathrm{AH}]}"),
        ("Espèce prédominante", "pH < pKa : AH prédomine. pH > pKa : A⁻ prédomine.", ""),
        ("Titrage d'un acide faible par une base forte", "Équivalence : A⁻, pH > 7. Demi-équivalence : pH = pKa.", ""),
        ("Solubilité d'un sel A_p B_q", "Ks = [A]^{p}[B]^{q} (activités). s s'exprime selon la stoéch. et les ions déjà présents.", ""),
        ("Complexation / précipitation (idée)", "Ajouter un ligand peut dissoudre un précipité en formant un complexe (déplace l'équilibre).", ""),
    ],
    "Q1 - Introduction à la mécanique quantique.xml": [
        ("Constante de Planck (valeur usuelle)", "h = 6,62×10⁻³⁴ J·s. ℏ = h/2π.", r"h=6{,}62\cdot 10^{-34}\,\mathrm{J\cdot s}"),
        ("Onde de matière vs onde EM", "λ = h/p pour une particule massive. Un photon a aussi p = E/c mais m = 0.", ""),
        ("Expérience des fentes (électrons)", "Figure d'interférences même particule par particule. L'état est une amplitude, pas une trajectoire classique.", ""),
        ("Mesure et réduction (idée MP)", "Une mesure de grandeur A projette sur un état propre. On ne prédit que des probabilités.", ""),
        ("Pourquoi l'atome ne s'effondre pas (idée)", "Confinement ⇒ Δp ≥ ℏ/(2Δx) ⇒ E_c minimale. Compétition avec E_p attractive.", ""),
    ],
    "Q2 - Particule libre et puits infini.xml": [
        ("Densité de probabilité", "ρ(x) = |φ(x)|². Nulle aux parois du puits infini.", r"\rho(x)=|\varphi(x)|^2"),
        ("Énergie de confinement", "E₁ ∝ 1/(m L²) : plus le puits est étroit, plus le fondamental est haut.", ""),
        ("nœuds de φ_n", "n − 1 nœuds intérieurs. n = 2 : un nœud au centre.", ""),
        ("Superposition de stationnaires", "Si ψ = a₁ φ₁ e^{-i E₁ t/ℏ} + a₂ φ₂ e^{-i E₂ t/ℏ}, |ψ|² oscille à (E₂−E₁)/ℏ.", ""),
        ("Courant de probabilité (libre)", "Pour une onde plane e^{ikx}, j = (ℏ k / m) |A|² (vitesse de groupe × densité).", ""),
    ],
    "Q3 - Barrière et effet tunnel.xml": [
        ("Coefficient de réflexion R", "R = |j_r / j_i|. Pour une marche E < V₀, R = 1 (tout revient, avec retard de phase).", ""),
        ("Continuité de φ et φ' (V fini)", "φ et φ' continues si V n'a pas de δ. Aux parois infinies, φ = 0 suffit.", ""),
        ("Largeur de la barrière et T", "T s'effondre si κ a ≫ 1. D'où la sensibilité du STM à 0,1 nm.", ""),
        ("Résonance de transmission (puits fini / double barrière)", "Pour certaines E, T → 1 (états quasi-liés). Base des diodes tunnel.", ""),
        ("Limite ħ → 0", "κ → ∞ si E < V₀ ⇒ T → 0 : on retrouve l'interdit classique.", ""),
    ],
    "EA1 - Mouvement d'une charge.xml": [
        ("Période cyclotron", "Indépendante de v (non relativiste). T = 2π m / (|q| B).", r"T_c=2\pi m/(|q|B)"),
        ("Pas de l'hélice", "b = v_∥ T_c. Si v_∥ = 0 : cercle.", r"b=2\pi m v_\parallel/(|q|B)"),
        ("Travail de la force magnétique", "Toujours nul. Seul E⃗ (ou un champ électrique induit) change E_c.", r"\vec{f}_m\cdot\vec{v}=0"),
        ("Signe q dans un condensateur / Wien", "La déviation donne le signe de q. Filtre de Wien : indépendant de q (si on néglige le poids).", ""),
        ("Ordre de grandeurs : e, m_e", "e = 1,6×10⁻¹⁹ C, m_e = 9,11×10⁻³¹ kg. ω_c énorme même pour B faible.", ""),
    ],
    "EA2 - Courant et force de Laplace.xml": [
        ("Orientation de dℓ⃗", "Dans le sens du courant algébrique i. Le produit vectoriel donne le sens de F⃗.", ""),
        ("Rail : puissance mécanique", "P = F v = i ℓ B v = i e. Le moteur reçoit P_élec et fournit P_meca (ou l'inverse : génératrice).", ""),
        ("Cadre mobile dans B (génératrice)", "e = B ℓ v. Conversion v → i dans une charge.", ""),
        ("Force de Laplace et action réciproque", "Le rail est attiré ; les aimants / circuits sources subissent −F (souvent oublié).", ""),
        ("Haut-parleur : rôle de B", "Bobine dans l'entrefer : F ∝ i, orthogonale. Le cone a une masse + k (rappel) + amortissement.", ""),
    ],
    "EA3 - Induction de Lorentz.xml": [
        ("Polarisation d'une barre qui coupe B", "Les charges se séparent jusqu'à qE = q v B. U = v B ℓ à vide.", r"U=vB\ell"),
        ("Auto-cohérence rail + circuit", "i crée une Laplace qui freine (Lenz). Équation couplée m ẋ̈ = − i ℓ B.", ""),
        ("Freinage électromagnétique", "Dissipation Joule = − P_meca. Sans circuit fermé, pas de courant, pas de frein (idéalement).", ""),
        ("Condition de Faraday globale", "e = −dΦ/dt marche aussi en Lorentz si on calcule le flux du circuit dont l'aire change.", ""),
        ("Barre + rails + R : constante de temps mécanique", "Le régime est du 1er ordre : v(t) → 0 exponentiellement si pas de moteur, ou v_∞ si on impose E.", ""),
    ],
    "EB0 - Topographie des champs.xml": [
        ("Exemples de lignes de E", "Charge : droites radiales. Dipôle : de + vers −. Condensateur plan : droites ⊥ plaques (fuites aux bords).", ""),
        ("Exemples de lignes de B", "Fil : cercles. Spire : comme un dipôle. Solénoïde : droites intérieures.", ""),
        ("Invariance et coordonnées", "Fil infini : invariance par translation z et rotation ⇒ B = B(r) u_θ.", ""),
        ("Flux de B à travers une surface fermée", "Toujours 0 (pas de monopôle). Les lignes de B sont fermées.", r"\iint\vec{B}\cdot\mathrm{d}\vec{S}=0"),
        ("Circulation de E électrostatique", "Nulle sur tout contour fermé ⇔ E = −grad V. Faux dès qu'il y a induction (Maxwell–Faraday).", ""),
    ],
    "EB1 - Dipôle électrostatique.xml": [
        ("Approximation dipolaire", "Valable si r ≫ taille du doublet et charge totale nulle.", ""),
        ("Lignes de champ d'un dipôle", "Sortent de +p, rentrent en −. Axis : E // p⃗. Équateur : E anti-// p⃗, plus faible.", ""),
        ("Dipôle induit", "p⃗ = α E⃗ (polarisation linéaire). Molécules non polaires.", ""),
        ("Molécule polaire", "p⃗ permanent. En champ, orientation (Langevin) + légère déformation.", ""),
        ("Unité de p", "C·m. Le debye : 3,34×10⁻³⁰ C·m (hors programme de mémorisation stricte).", ""),
    ],
    "EB2 - Dipôle magnétostatique.xml": [
        ("Analogie spire / aimant", "Une petite spire ≡ aimant de moment m⃗. Lignes de B identiques au loin.", ""),
        ("Aimantation et courants ampéériens", "rot M⃗ ↔ j_liés. À la surface, K = M ∧ n.", ""),
        ("Énergie et alignement", "Position stable : m⃗ // B⃗. L'aiguille de boussole s'aligne (amortissement).", ""),
        ("Champ d'un aimant droit (allure)", "Comme un dipôle : sort du nord, rentre au sud. Pas de monopôles isolés.", ""),
        ("Spire : m⃗ et orientation", "Pouce de la main droite dans le sens de m⃗, doigts dans le sens de I.", ""),
    ],
    "TB1 - Équation de diffusion.xml": [
        ("Unité de λ, de D", "λ en W·m⁻¹·K⁻¹. D = λ/(ρc) en m²·s⁻¹.", r"D=\lambda/(\rho c)"),
        ("Analogie électrique 1D stationnaire", "ΔT ↔ U, Q̇ ↔ I, e/(λS) ↔ R.", ""),
        ("Source volumique", "Si p_vol (W/m³) : ∂e/∂t + div j_Q = p_vol. Ex. effet Joule, réaction.", r"\rho c\partial_t T=\lambda\Delta T+p_\mathrm{vol}"),
        ("Pourquoi pas d'onde thermique à célérité c", "Le modèle de Fourier est parabolique (vitesse infinie non physique mais excellent en pratique).", ""),
        ("Ordre de τ pour un mur de béton 20 cm", "D ~ 10⁻⁶ m²/s ⇒ τ ~ L²/D ~ 10 h. Un métal : beaucoup plus vite.", ""),
    ],
    "TB2 - Solutions classiques de la diffusion.xml": [
        ("Épaisseur de peau thermique", "Distance sur laquelle l'oscillation de T est atténuée d'un facteur e.", r"\delta=\sqrt{2D/\omega}"),
        ("Mur semi-infini, T_s imposée à t=0+", "La chaleur pénètre sur √(Dt). Au-delà, le milieu « n'a pas encore vu » la perturbation.", ""),
        ("Ailette : à quoi ça sert", "Augmenter S d'échange. Efficace si elle n'est pas trop longue (T_bout ≈ T_ext sinon inutile).", ""),
        ("Régime transitoire d'un objet lumped (Bi petit)", "T uniforme dans l'objet si conduction interne ≫ conv. externe. T(t) = exponentielle, τ = ρ c V / (h S).", ""),
        ("Nombre de Biot (idée)", "Bi = h L / λ. Bi ≪ 1 : résistance interne négligeable.", r"\mathrm{Bi}=hL/\lambda"),
    ],
    "TB3 - Diffusion 3D.xml": [
        ("Laplacien sphérique (T = T(r))", "", r"\Delta T=\dfrac{1}{r^2}\dfrac{\mathrm{d}}{\mathrm{d}r}\left(r^2\dfrac{\mathrm{d}T}{\mathrm{d}r}\right)"),
        ("Noyau chaud en stationnaire", "Source au centre : T(r) = A/r + B hors de la source. A fixé par la puissance.", ""),
        ("Isolation d'une sphère", "R_th sphérique sature quand r₂ → ∞ : R = 1/(4π λ r₁). On ne peut pas isoler parfaitement une petite sphère dans un infini.", ""),
        ("Analogie Gauss thermique", "Flux de −λ grad T à travers une surface fermée = puissance thermique intérieure (stationnaire).", ""),
        ("Coin / arête : singularités", "Les flux se concentrent aux pointes (même maths que E⃗ au voisinage d'un conducteur pointu).", ""),
    ],
    "TB4 - Résistance thermique et diffusion radiale.xml": [
        ("Pont thermique", "Chemin de faible R_th qui court-circuite l'isolant (balcon, ossature).", ""),
        ("Épaisseur critique d'un calorifuge cylindrique", "Ajouter de l'isolant peut augmenter les pertes si r < λ/h (conv. gagne sur la surface).", r"r_\mathrm{c}=\lambda/h"),
        ("Régime variable lent : capacité thermique", "C_th = ρ c V. Analogie C électrique. τ = R_th C_th.", r"C_\mathrm{th}=\rho c V"),
        ("Paroi plane multicouche", "R_th = ∑ e_i /(λ_i S) + 1/(h_int S) + 1/(h_ext S).", ""),
        ("Mesure de λ (idée)", "Imposer ΔT, mesurer Q̇, remonter à R_th puis λ.", ""),
    ],
    "TC1 - Hydrostatique.xml": [
        ("Pression : définition mécanique", "Force surfacique normale, isotrope au repos. P = F/S, unité Pa.", r"P=F_\perp/S"),
        ("Théorème de Pascal", "Une ΔP s'applique en tout point d'un fluide incompressible au repos (presse hydraulique).", ""),
        ("Équilibre d'un iceberg", "Poids = poussée ⇒ ρ_glace V = ρ_eau V_immergé. Fraction émergée = 1 − ρ_g/ρ_e.", ""),
        ("Baromètre de Torricelli", "Hauteur de Hg ~ 76 cm. P_atm = ρ_Hg g h.", ""),
        ("Fluide en accélération uniforme", "g_eff = g − a. Surfaces libres ⊥ g_eff (accélérateur, véhicule).", r"\overrightarrow{\mathrm{grad}}P=\rho\vec{g}_\mathrm{eff}"),
    ],
    "TC2 - Systèmes à deux niveaux.xml": [
        ("Température infinie", "Équipopulation. ⟨E⟩ = 0 si les deux niveaux sont ±ε (origine au milieu).", ""),
        ("Limite T → 0", "Le système est certain d'être dans le fondamental. S → 0 (3e principe, idée).", ""),
        ("Spin 1/2 dans B⃗", "Écart 2 μ B. Polarisation magnétique = tanh(μ B / kT).", ""),
        ("Pourquoi C_V → 0 à T = 0", "Plus d'excitation possible : on ne peut plus absorber d'énergie infiniment petit.", ""),
        ("Lien avec le laser (idée)", "L'inversion de population n'est pas un état d'équilibre thermique à T > 0.", ""),
    ],
    "TC3 - Systèmes complexes.xml": [
        ("β = 1/kT", "Variable naturelle du canonique. Haute T = petit β = tous les états accessibles.", r"\beta=1/k_B T"),
        ("Gaz parfait : pression microscopique", "Chocs sur la paroi. On retrouve PV = NkT.", r"PV=Nk_B T"),
        ("Entropie de mélange (idée)", "L'indiscernabilité / N! évite une S non extensive (Gibbs).", ""),
        ("Libre parcours moyen (ordre, air)", "ℓ ≃ 0,1 µm. Beaucoup de chocs : le GP « ressent » quand même des interactions courtes.", ""),
        ("Énergie d'un GP diatomique (classique)", "U = (5/2) N kT (3 trans + 2 rot). Les vibrations gèlent à T ambiante pour O₂, N₂.", r"U=\dfrac52 Nk_B T"),
    ],
    "CB1 - Pile.xml": [
        ("Potentiel d'électrode", "E du couple ox/red, mesuré vs une référence (ESH, ECS). Nernst le donne en fonction des activités.", ""),
        ("Convention du Faraday", "F ≃ 96500 C/mol. n e⁻ ↔ n F coulomb par mole de réaction.", ""),
        ("Pile Daniell", "Zn | Zn²⁺ || Cu²⁺ | Cu. E° ≃ 1,1 V. Zn s'oxyde, Cu²⁺ se réduit.", ""),
        ("Rôle du solvant / électrolyte", "Permet la migration ionique. Sans électrolyte, le circuit est ouvert du côté ionique.", ""),
        ("E° et tables", "E° élevés : bons oxydants (F₂, MnO₄⁻). E° bas : bons réducteurs (Na, Li, Zn).", ""),
    ],
    "CB2 - Pile qui débite.xml": [
        ("Anode / cathode en débit", "Anode = oxydation = pôle − de la pile. Cathode = réduction = pôle +.", ""),
        ("Capacité en Ah", "Q = I t. 1 Ah = 3600 C. Limitée par le réactif minoritaire et n.", ""),
        ("Rendement énergétique", "η = U I / (|Δ_r H| × débit de réaction) (selon définition). U < E_pile.", ""),
        ("Résistance interne", "Ions + électrodes + polarisation. r augmente en fin de vie / à froid.", r"U=E-rI"),
        ("Puissance maximale (modèle r)", "P_max = E²/(4r) pour R_charge = r. Pas le point de meilleur rendement.", ""),
    ],
    "CB3 - Pile qui recharge.xml": [
        ("Inversion des électrodes à la charge", "Le pôle + de l'accu devient anode de l'électrolyse (oxydation du produit de réduction).", ""),
        ("Accumulateur Pb / Li-ion (idée)", "Pb : Pb et PbO₂, électrolyte H₂SO₄. Li-ion : intercalation, pas d'électrolyse de l'eau.", ""),
        ("Dégagement gazeux", "Si U trop grande : électrolyse de l'eau (H₂, O₂) en parallèle → danger, perte de faradique.", ""),
        ("Tension de charge", "Toujours > E_pile à l'équilibre, pour forcer le courant inverse.", ""),
        ("Coulométrie", "On mesure I t pour connaître ξ. Base des dosages électrochimiques.", ""),
    ],
    "EC1 - Théorème de Gauss.xml": [
        ("Potentiel et E⃗", "E = −grad V en électrostatique. V continu, E peut sauter à une nappe σ.", r"\vec{E}=-\overrightarrow{\mathrm{grad}}V"),
        ("Sphères concentriques conductrices", "Champ dans le métal = 0. Charge intérieure induit −Q sur la face interne.", ""),
        ("Plan chargé : discontinuité", "E_⊥2 − E_⊥1 = σ/ε₀. Pour un plan unique dans le vide, E = σ/(2ε₀) de chaque côté.", ""),
        ("Boule : E intérieur", "Charge volumique uniforme ρ : E(r) = ρ r / (3 ε₀).", r"E(r)=\rho r/(3\varepsilon_0)"),
        ("Quand Gauss est inefficace", "Pas assez de symétrie (dipôle, spire…). On revient à Coulomb / potentiel.", ""),
    ],
    "EC2 - Condensateur.xml": [
        ("Lien C et géométrie", "C = ε₀ × (grandeur de longueur). Plan : S/e. Sphère isolée : 4π ε₀ R.", r"C_\mathrm{sph}=4\pi\varepsilon_0 R"),
        ("Charge / décharge (rappel SA1)", "τ = RC. u_C continue. Énergie ½ C U² vient de la source, la moitié en Joule si charge par R sur E constante.", ""),
        ("Pressions de Kelvin (idée)", "Les armatures s'attirent. F = ½ Q² d(1/C)/dx…", ""),
        ("Associations : tension et charge", "Parallèle : même U, Q s'ajoutent. Série : même Q, U s'ajoutent.", ""),
        ("Isolant entre armatures", "Si on impose Q, U diminue (κ). Si on impose U, Q augmente.", ""),
    ],
    "EC3 - Théorème d'Ampère.xml": [
        ("Fil + point : sens de B", "Règle de la main droite : pouce = i, doigts = B.", ""),
        ("Tore vs solénoïde droit", "Tore : fuites faibles. Droit : B_ext négligé seulement si L ≫ R.", ""),
        ("Nappe K : analogie σ", "K joue pour B le rôle de σ pour E, avec un facteur 2 et μ₀.", r"\Delta B_\parallel=\mu_0 K"),
        ("Boucle de courant et dipôle", "Loin, B de la spire = dipôle m = I S.", ""),
        ("Limites d'Ampère", "Sans invariance, le contour n'aide pas (spire unique : B on-axis par Biot-Savart).", ""),
    ],
    "EC4 - Solénoïde.xml": [
        ("n = N/ℓ", "n en m⁻¹. B = μ₀ n I indépendant du rayon (modèle infini).", r"n=N/\ell"),
        ("Énergie = intégrale de B²/2μ₀", "Cohérent avec ½ L I² pour le solénoïde infini (on tronque à ℓ).", ""),
        ("Inductance et taille", "L ∝ N². Doubler N à ℓ fixé multiplie L par 4.", ""),
        ("Bobine réelle : R série", "Fil de cuivre : r_L. Modèle L + r. Facteur de qualité Q = Lω / r.", r"Q=L\omega/r"),
        ("Champ à l'extrémité (ordre)", "Environ B_centre / 2 pour un solénoïde long.", ""),
    ],
    "ED1 - Équations de Maxwell.xml": [
        ("Forme intégrale de Faraday", "", r"\oint\vec{E}\cdot\mathrm{d}\vec{\ell}=-\dfrac{\mathrm{d}}{\mathrm{d}t}\iint\vec{B}\cdot\mathrm{d}\vec{S}"),
        ("Forme intégrale d'Ampère–Maxwell", "", r"\oint\vec{B}\cdot\mathrm{d}\vec{\ell}=\mu_0 I+\mu_0\varepsilon_0\dfrac{\mathrm{d}\Phi_E}{\mathrm{d}t}"),
        ("Condensateur et courant de déplacement", "Entre les armatures j = 0 mais I_D = ε₀ dΦ_E/dt = i_fils. Continuité du courant « total ».", ""),
        ("Incompatibilité ARQS / OEM", "ARQS : on jette ∂E/∂t. OEM : c'est le terme qui permet la propagation. Deux régimes distincts.", ""),
        ("c et les constantes", "", r"c=1/\sqrt{\mu_0\varepsilon_0}"),
    ],
    "ED2 - Manipuler Maxwell.xml": [
        ("Onde plane : relations", "k = ω/c, E = c B, trièdre (u⃗, E⃗, B⃗) direct.", r"|B|=|E|/c"),
        ("Jauge : A n'est pas unique", "A → A + grad χ, V → V − ∂χ/∂t laisse E, B invariants.", ""),
        ("Conditions de passage (résumé)", "B_⊥ continu, E_∥ continu (pas de nappe). D_⊥ saute avec σ. H_∥ saute avec K.", ""),
        ("Bilan d'énergie local (Poynting)", "∂u/∂t + div Π = − j · E. j·E : puissance cédée à la matière.", r"\dfrac{\partial u}{\partial t}+\mathrm{div}\,\vec{\Pi}=-\vec{j}\cdot\vec{E}"),
        ("Onde sphérique lointaine", "E, B ∝ 1/r pour que la puissance à travers 4π r² reste finie.", ""),
    ],
    "ED3 - Induction de Neumann.xml": [
        ("E induit n'est pas conservatif", "∮ E·dℓ ≠ 0. On ne définit plus V de façon unique autour du circuit.", ""),
        ("Spire + B(t) solénoïde", "Même hors du solénoïde (B=0), E_θ ≠ 0. Φ est celui qui traverse la spire.", ""),
        ("Autoinduction d'une bobine", "Cas particulier : Φ = L I, e = −L dI/dt. Déjà ED4 mais c'est du Neumann.", ""),
        ("Chauffage par induction", "B variable → Foucault → Joule. Fréquence et δ choisies pour concentrer la chaleur.", ""),
        ("Signe de e et orientation", "Orienter le circuit (droitier avec n⃗). Φ = ∬ B·dS. e = −dΦ/dt dans ce sens.", ""),
    ],
    "ED4 - Auto et mutuelle induction.xml": [
        ("L d'un solénoïde (rappel)", "", r"L=\mu_0 n^2 S\ell"),
        ("M de deux bobines coaxiales (idée)", "M = k √(L₁ L₂) ≤ √(L₁ L₂). k = 1 si tout le flux de l'une traverse l'autre.", ""),
        ("Énergie mutuelle : signe", "Le terme M I₁ I₂ est > 0 si les flux se renforcent (courants « dans le même sens »).", ""),
        ("Couplage en régime sinusoïdal", "e₂ = − j M ω I₁. Transformateur : k proche de 1, noyau ferromagnétique (hors modèle linéaire strict).", ""),
        ("Continuité de i dans L", "Une inductance impose i continue (énergie ½LI² finie). u_L peut sauter.", ""),
    ],
    "EE1 - Ondes dans le vide.xml": [
        ("Relation E / B / c", "", r"B=E/c\qquad \vec{B}=\dfrac{1}{c}\vec{u}\wedge\vec{E}"),
        ("Polarisation elliptique", "Cas général : deux composantes d'amplitudes et phases quelconques, ⊥ u⃗.", ""),
        ("Intensité et E_eff", "I = E_eff² / Z₀ avec E_eff = E_m / √2.", r"I=E_\mathrm{eff}^2/Z_0"),
        ("Onde stationnaire EM (deux OPP contraires)", "Nœuds de E = ventres de B, distants de λ/4. Analogie corde.", ""),
        ("Spectre visible en nm", "≈ 400 nm (violet) à 800 nm (rouge). f ~ 10¹⁴–10¹⁵ Hz.", ""),
    ],
    "EE2 - Ondes et conducteurs.xml": [
        ("Bon conducteur : quasi E_∥ = 0", "Les charges se réorganisent (temps ε₀/γ très court) : écran pour le statique et le BF.", r"\tau=\varepsilon_0/\gamma"),
        ("δ vs λ dans le métal", "L'onde est évanescente : on ne parle plus de λ usuelle, plutôt de δ.", ""),
        ("Réflexion métallique (miroir)", "R ≈ 1 dans l'IR / visible pour un bon métal. Déphasage de E_∥.", ""),
        ("Câble coaxial (idée)", "Onde TEM guidée, célérité 1/√(με). Rôle du diélectrique.", ""),
        ("Induction à 50 Hz dans le cuivre", "δ ~ 1 cm : un fil épais n'est pas parcouru uniformément (effet de peau).", ""),
    ],
    "EE3 - Onde dans un plasma.xml": [
        ("ω_p ionosphère (ordre)", "f_p ~ 10 MHz (fiche constantes). Les ondes radio AM peuvent rebondir, pas la lumière.", ""),
        ("v_g v_φ = c²", "Conséquence de ω² = ω_p² + c² k². v_g < c < v_φ.", r"v_g v_\varphi=c^2"),
        ("Milieu dispersif sans absorption (collisions nulles)", "n(ω) réel pour ω > ω_p. Pas de dissipation, mais paquets qui se déforment.", ""),
        ("Réflexion à ω < ω_p", "k imaginaire : onde évanescente, analogie optique (réflexion totale) / tunnel.", ""),
        ("Densité et couleur d'un plasma (idée)", "Plus n est grand, plus ω_p est grand : métaux (n ~ 10²⁸ m⁻³) réfléchissent le visible.", ""),
    ],
    "EE4 - Dipôle rayonnant.xml": [
        ("Zone de Rayleigh / Fresnel / far-field", "Rayonnement : r ≫ λ et r ≫ taille. Les termes 1/r², 1/r³ (induction, quasi-statique) deviennent négligeables.", ""),
        ("Diagramme de rayonnement", "∝ sin²θ. Nul dans l'axe, max dans le plan équatorial.", r"\langle\Pi\rangle\propto\sin^2\theta/r^2"),
        ("Lien p̈ et rayonnement", "C'est l'accélération des charges (p̈) qui rayonne. Courant constant ne rayonne pas.", ""),
        ("Antenne : adaptation", "On cherche Z_ant ≈ Z_ligne pour transférer la puissance (réflexion minimale).", ""),
        ("Ciel bleu vs coucher de soleil", "Rayleigh ∝ 1/λ⁴ : le bleu est diffusé. Au couchant, le trajet long laisse le rouge.", ""),
    ],
    "MC1 - Référentiels non galiléens en translation.xml": [
        ("Pesanteur effective dans un véhicule", "Freinage : on est projeté en avant (f_e dans le sens de −a_véhicule vu du véhicule ? a_e = a_veh, f_e = −m a_veh).", ""),
        ("Pendule dans un wagon accéléré", "Équilibre : fil // g_eff. tan α = a/g.", r"\tan\alpha=a/g"),
        ("Référentiel en chute libre", "Toutes les masses ont la même a = g : f_e = −mg annule le poids. Trajectoires « droites » relatives.", ""),
        ("Travail de f_e", "Si a_e constant et déplacement relatif, W_e = − m a_e · Δr. Peut se mettre en E_p fictive −m a_e · r.", ""),
        ("Ne pas oublier les vraies forces", "f_e s'ajoute ; contacts, tension, etc. restent. Le PFD relatif les contient toutes.", ""),
    ],
    "MC2 - Référentiels non galiléens en rotation.xml": [
        ("Coriolis ne travaille pas", "f_c ⊥ v_rel ⇒ P = 0. Elle dévie, elle ne change pas E_c dans R_rel (si Ω constant, f_e conservative).", ""),
        ("Force centrifuge conservative", "E_p = −½ m Ω² r_⊥². Minimum à r grand : on est « jeté » vers l'extérieur.", r"E_{p,\mathrm{cf}}=-\dfrac12 m\Omega^2 r_\perp^2"),
        ("Manège : lancer un objet", "Vu du manège, déviation de Coriolis. Vu du sol, droite (si pas d'autre force horizontale).", ""),
        ("Vent géostrophique (idée)", "Équilibre grad P ↔ Coriolis. D'où rotation des dépressions (cyclones).", ""),
        ("Ω ∧ (Ω ∧ r) vs 2 Ω ∧ v", "Centrifuge existe même au repos relatif. Coriolis seulement si v_rel ≠ 0.", ""),
    ],
    "MC3 - Référentiel terrestre.xml": [
        ("Géocentrique : est-il galiléen ?", "Non strictement (révolution autour du Soleil, ~ 6×10⁻³ m/s²). Souvent acceptable vs g.", ""),
        ("Composante verticale de Ω", "Ω_v = Ω sin λ. C'est elle qui entre dans Foucault et la déviation horizontale.", r"\Omega_v=\Omega\sin\lambda"),
        ("Déviation vers l'est (chute)", "Une pierre lâche a déjà la vitesse est du sol (plus grande en altitude). Elle « précède » le sol.", ""),
        ("Poids et balance", "Une balance à ressort mesure ||mg_eff||, qui contient déjà la centrifuge.", ""),
        ("Latitude et g", "g diminue légèrement à l'équateur (centrifuge max + bourrelet équatorial).", ""),
    ],
    "CC1 - Révision chimie des matériaux.xml": [
        ("Corps simple / oxyde : Ellingham", "2M + O₂ = 2MO. On compare les Δ_r G° par mole de O₂.", ""),
        ("Réduction par le carbone", "À haute T, la droite C/CO descend (ΔS > 0) : C réduit beaucoup d'oxydes.", ""),
        ("Passivation de l'aluminium", "Al₂O₃ compact, adhérent. Al « devrait » se corroder (E° bas) mais le film bloque.", ""),
        ("Inox", "Fe + Cr (≥ 12 %) : oxyde de Cr passivant. Le Mo, Ni améliorent selon les milieux.", ""),
        ("Échelle des métaux (rappel)", "K, Ca, Na, Mg, Al, Zn, Fe, Ni, Sn, Pb, Cu, Ag, Au : du plus réducteur au plus noble.", ""),
    ],
    "CC2 - Corrosion.xml": [
        ("Pile de corrosion : exemple Fe/Cu", "Fe (anode) s'oxyde, O₂ se réduit sur Cu (cathode). Le contact accélère la rouille du fer.", ""),
        ("Oxygène dissous", "En milieu neutre/basique, la cathode est souvent O₂ + 2 H₂O + 4 e⁻ = 4 OH⁻.", ""),
        ("Galvanisation", "Zn recouvre l'acier : barrière + anode sacrificielle aux rayures.", ""),
        ("Protection par courant imposé", "On injecte des e⁻ dans la structure (pipeline, coque). Potentiel abaissé dans le domaine d'immunité.", ""),
        ("Piqûres / crevasses", "Milieu confiné, O₂ faible, pH local bas, Cl⁻ : corrosion localisée très rapide (inox en chlorures).", ""),
    ],
    "L2 - Calculs.xml": [
        ("tan x, e^x, ln(1+x) en 0", "", r"\tan x=x+o(x)\qquad e^x=1+x+x^2/2+o(x^2)\qquad\ln(1+x)=x-x^2/2+o(x^2)"),
        ("(1+x)^α", "", r"(1+x)^\alpha=1+\alpha x+o(x)"),
        ("DL d'un oscillateur : cos(ωt+φ)", "On relit A, φ sur les CI après avoir posé la solution générale.", ""),
        ("Négliger un terme dans une somme", "Si A + B et |B/A| ≪ 1 (souvent 10⁻²), on garde A. Justifier par un OG.", ""),
        ("Incertitudes : addition vs produit", "Add/sub : incertitudes absolues. Mul/div : relatives. Cohérent avec les C.S. de L1.", ""),
        ("Changement d'unité dans un DL", "x doit être sans dimension (ou ≪ 1 dans l'unité choisie) : θ en rad, x/L, t/τ…", ""),
    ],
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    results = []
    for filename, name, time, desc, cards in DECKS:
        cards = list(cards) + EXTRA.get(filename, [])
        fn, nm, n = write_deck(filename, name, cards)
        rel = f"Physique/MP star 2026-2027/{fn}"
        results.append({"path": rel, "name": nm, "time": time, "desc": desc, "n": n})
        print(f"{n:3d}  {rel}")

    man = json.loads(MANIFEST.read_text(encoding="utf-8"))
    decks = man["decks"] if isinstance(man, dict) else man
    existing_paths = {d["path"] if isinstance(d, dict) else d for d in decks}
    insert_at = next((i for i, d in enumerate(decks) if isinstance(d, dict) and str(d.get("path","")).startswith("Sciences industrielles/")), len(decks))
    added = 0
    for r in results:
        if r["path"] in existing_paths:
            continue
        entry = {
            "path": r["path"],
            "tags": ["timer"],
            "time": r["time"],
            "description": r["desc"],
        }
        decks.insert(insert_at + added, entry)
        added += 1
        existing_paths.add(r["path"])
    if isinstance(man, dict):
        man["decks"] = decks
        MANIFEST.write_text(json.dumps(man, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")
    else:
        MANIFEST.write_text(json.dumps(decks, ensure_ascii=False, indent="\t") + "\n", encoding="utf-8")

    counts = json.loads(COUNTS.read_text(encoding="utf-8"))
    for r in results:
        counts[r["path"]] = r["n"]
    counts = dict(sorted(counts.items(), key=lambda kv: kv[0].lower()))
    COUNTS.write_text(json.dumps(counts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n{len(results)} decks, {sum(r['n'] for r in results)} cartes, +{added} au manifest")


if __name__ == "__main__":
    main()
