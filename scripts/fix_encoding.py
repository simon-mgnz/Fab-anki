#!/usr/bin/env python3
"""Fix UTF-8 mojibake (Latin-1 misread as UTF-8) in app.js source strings."""
from pathlib import Path

CP1252_EXTRA = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84,
    0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88,
    0x2030: 0x89, 0x0160: 0x8A, 0x2039: 0x8B, 0x0152: 0x8C,
    0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93,
    0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B,
    0x0153: 0x9C, 0x017E: 0x9E, 0x0178: 0x9F,
}

SUSPECT = ('Ã', 'Â', 'â', 'ð', 'ï', '')


def to_cp1252_bytes(text: str) -> bytes | None:
    out = bytearray()
    for ch in text:
        code = ord(ch)
        if code <= 0xFF:
            out.append(code)
        elif code in CP1252_EXTRA:
            out.append(CP1252_EXTRA[code])
        else:
            # Emoji / non-Latin-1: skip mojibake fix for this string
            return None
    return bytes(out)


def fix_mojibake(text: str) -> str:
    if not any(s in text for s in SUSPECT):
        return text
    try:
        raw = to_cp1252_bytes(text)
        if raw is None:
            return text
        fixed = raw.decode('utf-8')
        if fixed != text:
            return fix_mojibake(fixed)
        return fixed
    except UnicodeDecodeError:
        return text


def main():
    path = Path(__file__).resolve().parents[1] / 'js' / 'app.js'
    original = path.read_text(encoding='utf-8')
    lines = original.splitlines(keepends=True)
    changed = 0
    out = []
    for line in lines:
        fixed = fix_mojibake(line)
        if fixed != line:
            changed += 1
        out.append(fixed)
    result = ''.join(out)
    # Remove stray replacement characters if any remain
    result = result.replace('\ufffd', '')
    path.write_text(result, encoding='utf-8', newline='\n')
    print(f'Fixed {changed} lines in {path}')
    print(f'Remaining U+FFFD: {result.count(chr(0xFFFD))}')


if __name__ == '__main__':
    main()
