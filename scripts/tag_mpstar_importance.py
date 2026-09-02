# -*- coding: utf-8 -*-
"""Tag XML cards with importance=core|std|extra for MP* review depth."""
from __future__ import annotations

import html
import os
import re
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECKS = os.path.join(ROOT, "decks")

CARD_RE = re.compile(r"<card(\b[^>]*)>(.*?)</card>", re.I | re.S)


def fold(s: str) -> str:
    s = html.unescape(str(s or ""))
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.lower().replace("œ", "oe").replace("æ", "ae")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    s = s.replace("ℏ", "hbar").replace("ħ", "hbar")
    return re.sub(r"\s+", " ", s).strip()


def card_text(inner: str) -> str:
    return fold(inner)


def any_re(text: str, patterns) -> bool:
    return any(re.search(p, text) for p in patterns)


CORE_VERBS = {
    "be", "have", "do", "go", "say", "get", "make", "know", "think", "take",
    "see", "come", "want", "look", "use", "find", "give", "tell", "work",
    "call", "try", "ask", "need", "feel", "become", "leave", "put", "mean",
    "keep", "let", "begin", "seem", "help", "show", "hear", "play", "run",
    "move", "live", "believe", "hold", "bring", "happen", "write", "sit",
    "stand", "lose", "pay", "meet", "include", "continue", "set", "learn",
    "lead", "understand", "watch", "follow", "stop", "create", "speak",
    "read", "spend", "grow", "open", "walk", "win", "teach", "offer", "buy",
    "send", "build", "fall", "cut", "sell", "choose", "eat", "drink", "sleep",
    "wear", "break", "drive", "forget", "catch", "throw", "rise", "hit",
    "draw", "fight", "hang", "hide", "hurt", "lay", "lie", "ride", "ring",
    "rise", "shake", "shoot", "shut", "sing", "sink", "slide", "smell",
    "steal", "stick", "strike", "swear", "swim", "tear", "wake", "win",
    "write", "become", "begin", "blow", "burn", "cost", "deal", "dream",
    "feed", "fly", "freeze", "light", "lend", "seek", "spread", "stand",
}
STD_VERBS = {
    "arise", "awake", "beat", "bend", "bet", "bind", "bite", "bleed", "broadcast",
    "burst", "cling", "creep", "deal", "dig", "dwell", "flee", "fling", "forecast",
    "forgive", "grind", "kneel", "knit", "lean", "leap", "overcome", "quit",
    "rid", "seek", "shine", "shrink", "sow", "speed", "spill", "spin", "spit",
    "split", "spoil", "spring", "sting", "stink", "stride", "strive", "swear",
    "sweep", "swing", "thrust", "tread", "upset", "weep", "wind", "withdraw",
    "withstand", "wring", "cast", "fit", "hang", "input", "offset", "output",
    "reset", "string", "sweat", "wed", "wet",
}

MATH_CORE = [
    r"formule d[' ]addition", r"duplication", r"binome de newton", r"somme geometrique",
    r"coefficients binomiaux \(formule\)", r"factorielle", r"tangente$",
    r"cercle trigonometrique", r"cos\(a\+b\)", r"sin\(a\+b\)", r"tan\(a\+b\)",
    r"cos\(2a\)", r"sin\(2a\)", r"tan\(2a\)", r"formule d[' ]euler",
    r"module d[' ]un complexe", r"argument d[' ]un", r"exponentielle complexe",
    r"forme trigonometrique", r"forme exponentielle",
    r"racines n-iemes", r"racines de l[' ]unite", r"conjugue",
    r"developpements? limites?", r"\bdl\b", r"formule de taylor",
    r"a l[' ]ordre", r"o\(x", r"equivalent usuel", r"croissances comparees",
    r"derivee de", r"primitive de", r"ipp\b", r"integration par parties",
    r"formule de chasles", r"theoreme fondamental",
    r"frac\{d", r"d\(sin", r"d\(cos", r"d\(ln", r"d\(e\^", r"int\^x", r"int x\^",
    r"polynome caracteristique", r"variation de la constante",
    r"equation differentielle lineaire", r"solution generale", r"wronskien",
    r"theoreme du rang", r"noyau", r"image d[' ]une", r"base canonique",
    r"famille libre", r"famille generatrice", r"base de", r"dimension",
    r"determinant", r"matrice inverse", r"inverse de", r"transposee",
    r"produit (de )?matrices", r"trace d[' ]une matrice",
    r"changement de base", r"matrice de passage", r"operations elementaires",
    r"inegalite de cauchy", r"norme euclidienne",
    r"esperance", r"variance", r"loi binomiale", r"loi de bernoulli",
    r"loi geometrique", r"loi uniforme", r"probabilite conditionnelle",
    r"formule des probabilites totales", r"bayes",
    r"division euclidienne", r"reste de", r"polynome irreductible",
    r"somme des premiers entiers", r"somme des carres",
    r"relation de chasles", r"formule de pascal",
    r"limites usuelles", r"suite geometrique", r"suite arithmetique",
    r"theoreme des gendarmes", r"theoreme des valeurs intermediaires",
    r"rolle", r"accroissements finis", r"convexite",
    r"application lineaire", r"k parmi n", r"arrangement", r"permutation",
    r"e\^x", r"ln\(1", r"sin\(x\)", r"cos\(x\)", r"1/\(1-x\)",
]
MATH_STD = [
    r"bijection", r"injection", r"surjection", r"application composee",
    r"reciproque", r"independance", r"systeme complet",
    r"matrice diagonale", r"matrice triangulaire", r"gauss",
    r"groupe", r"anneau", r"corps", r"loi de composition",
]
MATH_EXTRA = [
    r"symbole [s∑σ∏]", r"somme vide", r"produit vide",
    r"positivite de la somme", r"croissance de la somme",
    r"homogeneite de la somme", r"additivite de la somme",
    r"glissement d[' ]indice", r"symetrie d[' ]indice",
    r"sommation par paquets", r"produit par paquets",
    r"observation perso", r"enonce par", r"blabla",
    r"quantificateur", r"rediger", r"raisonner", r"methode de",
    r"homogeneite du produit", r"multiplicativite du produit",
    r"annulation de la somme",
]

PHYS_CORE = [
    r"loi de newton", r"principe fondamental", r"pfd\b", r"gravitation",
    r"coulomb", r"lorentz", r"quantite de mouvement", r"energie cinetique",
    r"energie mecanique", r"moment cinetique", r"kepler",
    r"poids", r"reaction normale", r"frottement",
    r"ohm", r"kirchhoff", r"loi des mailles", r"loi des n[oe]uds",
    r"constante de temps", r"regime transitoire", r"impedance",
    r"fonction de transfert", r"filtre", r"bode", r"pulsation propre",
    r"condensateur", r"bobine", r"arqs",
    r"descartes", r"conjugaison", r"grandissement", r"lentille",
    r"premier principe", r"second principe", r"deuxieme principe",
    r"gaz parfait", r"carnot", r"enthalpie", r"entropie",
    r"identite thermodynamique", r"energie interne",
    r"cinématique", r"vitesse", r"acceleration",
    r"coordonnees polaires", r"base cylindrique", r"base spherique",
    r"theoreme de l[' ]energie", r"puissance",
]
PHYS_EXTRA = [
    r"enoncee par", r"en 17\d\d", r"en 18\d\d", r"historique",
    r"ferrari", r"kwh", r"prix moyen", r"bombe", r"explosif", r"c4\b",
    r"babysit", r"blabla", r"{{blob",
    r"aire sphere",  # card content is often the disk formula
]

CONST_CORE = [
    r"gravitation", r"acceleration de pesanteur", r"celerite de la lumiere",
    r"constante de planck", r"planck reduite", r"hbar",
    r"boltzmann", r"avogadro", r"gaz parfaits", r"permeabilite magnetique",
    r"permittivite", r"charge (electrique )?elementaire",
    r"masse de l[' ]electron", r"masse du proton", r"masse du nucleon",
    r"rayon (moyen )?de la terre", r"masse de la terre",
    r"unite astronomique", r"satellisation", r"vitesse de liberation",
    r"jour sideral", r"vitesse angulaire de rotation",
    r"pression atmospherique", r"indice optique de l[' ](eau|air|verre|vide)",
    r"domaine de la lumiere visible", r"longueur d[' ]onde de la lumiere visible",
    r"he-ne", r"632", r"rapport des capacites thermiques",
    r"masse volumique de l[' ]eau liquide", r"enthalpie massique de vaporisation",
    r"point triple de l[' ]eau", r"constante universelle",
    r"faraday",
]
CONST_EXTRA = [
    r"ferrari", r"bombe", r"c4\b", r"kwh", r"prix moyen", r"2025",
    r"marron-noir", r"gbf", r"voltmeter", r"amperemetre", r"centrale nucleaire",
    r"vide intergalactique", r"vide interstellaire", r"proxima",
    r"peau chez", r"sportif", r"cheval-vapeur", r"petite voiture",
    r"photomultiplicateur", r"photorésistance", r"photoresistance",
    r"goniometre", r"palmer", r"telescope amateur",
    r"densite du vide de laboratoire", r"age de l[' ]univers",
    r"age de la terre", r"lunaison", r"diametre apparent",
    r"resistance du corps", r"intensite (electrique )?(mortelle|dangereuse)",
    r"surface de peau", r"puissance dissipee au repos",
    r"huile", r"diamant", r"refractaire", r"dulong",
    r"anticyclone", r"depression", r"ionosphere", r"decharge gazeuse",
    r"claquage", r"beau temps", r"magnet\b", r"aimant",
    r"cuivre", r"epaisseur de peau", r"vitesse de derive",
    r"photon (x|γ|g)\b", r"energie massique",
    r"rayon de bohr", r"energie d[' ]ionisation",
]

SI_CORE = [
    r"produit vectoriel", r"produit mixte", r"produit scalaire",
    r"changement de base", r"matrice de rotation", r"angle d[' ]euler",
    r"liaison pivot", r"liaison glissiere", r"liaison rotule", r"liaison helice",
    r"torseur", r"varignon", r"composition des vitesses", r"composition des accelerations",
    r"formule de bour", r"referentiel", r"base mobile",
    r"vitesse d[' ]un point", r"acceleration d[' ]un point",
    r"degre de liberte", r"graphe de liaisons",
]
SI_EXTRA = [
    r"sysml", r"use case", r"requirement", r"blabla", r"diagramme de",
    r"package", r"commentaire uml", r"acteur",
]

INFO_CORE = [
    r"list\.hd", r"list\.tl", r"list\.map", r"list\.fold", r"list\.filter",
    r"list\.rev", r"::", r"filtrage", r"pattern", r"let rec",
    r"array\.make", r"array\.get", r"array\.set", r"array\.length",
    r"complexite", r"o\(1\)", r"o\(n\)", r"recursiv",
    r"tete de liste", r"queue d[' ]une liste", r"liste vide",
    r"constructeur", r"type ", r"int\b", r"float", r"bool", r"string",
    r"tuple", r"fonction", r"filtrage par motif",
]
INFO_EXTRA = [
    r"stack\.", r"queue\.", r"babysit", r"list\.sort \(\+\)",
    r"histoire", r"caml light", r"introduction historique",
]


def first_verb(text: str) -> str:
    m = re.search(r"\b([a-z]+)(?=/)", text)
    if m:
        return m.group(1)
    m = re.search(r"\b(be|have|do|go|[a-z]{3,})\b", text)
    return m.group(1) if m else ""


def classify_verbs(text: str) -> str:
    # Back is like "go/went/gone"
    raw = text.replace(" ", "")
    inf = raw.split("/")[0].split("(")[0].strip()
    inf = re.sub(r"[^a-z]", "", inf)
    if inf in CORE_VERBS:
        return "core"
    if inf in STD_VERBS:
        return "std"
    if any_re(text, [r"archaique", r"poetique", r"litteraire", r"soutenu"]):
        return "extra"
    return "extra"


def classify(rel: str, text: str, default: str) -> str:
    rel_f = fold(rel.replace("\\", "/"))
    if "irregular verbs" in rel_f:
        return classify_verbs(text)
    extra_pats, core_pats, std_pats = [], [], []
    if "constantes" in rel_f:
        extra_pats, core_pats = CONST_EXTRA, CONST_CORE
    elif "/option/" in rel_f:
        extra_pats, core_pats = INFO_EXTRA, INFO_CORE
    elif "sciences industrielles" in rel_f:
        extra_pats, core_pats = SI_EXTRA, SI_CORE
    elif rel_f.startswith("physique/"):
        extra_pats, core_pats = PHYS_EXTRA, PHYS_CORE
    elif rel_f.startswith("maths/"):
        extra_pats, core_pats, std_pats = MATH_EXTRA, MATH_CORE, MATH_STD
    else:
        return default
    if any_re(text, extra_pats):
        return "extra"
    if any_re(text, core_pats):
        if default == "extra" and any_re(text, [r"montrer que", r"demonstrer", r"calculer ", r"determiner "]):
            return "extra"
        return "core"
    if std_pats and any_re(text, std_pats):
        return "std"
    return default


def file_default(rel: str) -> str:
    rel_f = fold(rel.replace("\\", "/"))
    if "irregular" in rel_f:
        return "extra"
    if rel_f.endswith("constantes.xml"):
        return "std"
    if "constantes physique" in rel_f:
        return "std"
    if "/option/chapitre 1" in rel_f:
        return "extra"
    if "/option/" in rel_f:
        return "std"
    if "sysml" in rel_f or "blabla" in rel_f:
        return "extra"
    if "sciences industrielles/chapitre 2" in rel_f:
        return "core"
    if "sciences industrielles" in rel_f:
        return "std"
    if "physique/formulaire" in rel_f:
        return "core"
    if "physique/definitions" in rel_f:
        return "std"
    if "physique/unite" in rel_f:
        return "std"
    if "physique/controle" in rel_f:
        return "extra"
    if "physique/cours" in rel_f:
        return "std"
    if "maths/calcul mental" in rel_f:
        return "core"
    if "derivees et primitives.xml" in rel_f:
        return "core"
    if "developpements limites" in rel_f:
        return "core"
    if "maths/controles" in rel_f:
        return "extra"
    if "chapitre 01" in rel_f or "chapitre 1 - raisonner" in rel_f:
        return "extra"
    if "chapitre 07" in rel_f or "chapitre 7 - logique" in rel_f:
        return "extra"
    if "lci" in rel_f:
        return "std"
    if "maths/cours" in rel_f:
        return "std"
    return "std"


def set_importance(attrs: str, level: str) -> str:
    attrs = attrs or ""
    if re.search(r"\bimportance\s*=", attrs, re.I):
        return re.sub(
            r"\bimportance\s*=\s*(['\"])[^'\"]*\1",
            f"importance='{level}'",
            attrs,
            count=1,
            flags=re.I,
        )
    if attrs.strip():
        return attrs.rstrip() + f" importance='{level}'"
    return f" importance='{level}'"


def process_file(path: str, rel: str) -> dict:
    raw = open(path, encoding="utf-8").read()
    default = file_default(rel)
    counts = {"core": 0, "std": 0, "extra": 0}
    n = 0

    def repl(m):
        nonlocal n
        attrs, inner = m.group(1), m.group(2)
        level = classify(rel, card_text(inner), default)
        counts[level] += 1
        n += 1
        return f"<card{set_importance(attrs, level)}>{inner}</card>"

    new, k = CARD_RE.subn(repl, raw)
    if k == 0:
        return {"n": 0}
    if new != raw:
        open(path, "w", encoding="utf-8", newline="\n").write(new)
    counts["n"] = n
    counts["rel"] = rel
    return counts


def collect_targets():
    out = []
    specs = [
        ("Maths/Cours", True),
        ("Maths/Contrôles", True),
        ("Maths/Calcul mental", True),
        ("Physique/Cours", True),
        ("Physique/Contrôle de cours", True),
        ("Sciences industrielles", True),
        ("Informatique/Option", True),
    ]
    singles = [
        "Maths/Dérivées et primitives.xml",
        "Maths/Développements Limités usuels.xml",
        "Maths/LCI et caractéristiques.xml",
        "Physique/Formulaire.xml",
        "Physique/Définitions.xml",
        "Physique/Unité (SI).xml",
        "Physique/Constantes.xml",
        "Physique/Constantes physique complet.xml",
        "Physique/Constantes physique générales.xml",
        "Anglais/Irregular verbs.xml",
    ]
    for folder, _ in specs:
        d = os.path.join(DECKS, folder)
        if not os.path.isdir(d):
            continue
        for name in os.listdir(d):
            if name.lower().endswith(".xml"):
                rel = f"{folder}/{name}".replace("\\", "/")
                out.append((os.path.join(d, name), rel))
    for rel in singles:
        p = os.path.join(DECKS, rel)
        if os.path.isfile(p):
            out.append((p, rel.replace("\\", "/")))
    return out


def main():
    rows = []
    for path, rel in collect_targets():
        stats = process_file(path, rel)
        if stats.get("n"):
            rows.append(stats)
            print(
                f"{stats['n']:4d}  core={stats['core']:3d} std={stats['std']:3d} extra={stats['extra']:3d}  {rel}"
            )
    tot = {"core": 0, "std": 0, "extra": 0, "n": 0}
    for r in rows:
        for k in tot:
            tot[k] += r[k]
    print("---")
    print(f"TOTAL {tot['n']}  core={tot['core']} std={tot['std']} extra={tot['extra']}")


if __name__ == "__main__":
    main()
