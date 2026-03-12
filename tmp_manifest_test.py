import urllib.parse


def normalizeDeckPath(url):
    p = url or ''
    if p.startswith('./'):
        p = p[2:]
    if p.startswith('decks/'):
        p = p[len('decks/'):]
    if p.startswith('/'):
        p = p[1:]
    try:
        p = urllib.parse.unquote(p)
    except Exception:
        pass
    return p


manifestMeta = {'Informatique/Option/': {'path': 'Informatique/Option/', 'password': 'secret123'}}


def getManifestEntryForPath(url):
    rel = normalizeDeckPath(url)
    if not rel:
        return None

    relNoSlash = rel.rstrip('/')
    relWithSlash = relNoSlash + '/' if relNoSlash else rel

    entry = manifestMeta.get(rel) or manifestMeta.get(relNoSlash) or manifestMeta.get(relWithSlash)

    if not entry and manifestMeta:
        for key in manifestMeta:
            if not key:
                continue
            keyNorm = normalizeDeckPath(key)

            if keyNorm == rel or keyNorm == relNoSlash or keyNorm == relWithSlash:
                entry = manifestMeta[key]
                break

            keyFolder = keyNorm if keyNorm.endswith('/') else keyNorm + '/'
            if relNoSlash == keyNorm or relWithSlash.startswith(keyFolder):
                entry = manifestMeta[key]
                break

    return entry


for p in ['Informatique', 'Informatique/', 'Informatique/Option', 'Informatique/Option/', 'Informatique/Option/Chapitre 1 - Introduction.xml']:
    print(p, '=>', getManifestEntryForPath(p))
