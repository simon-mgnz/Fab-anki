#!/usr/bin/env python3
"""Restore emojis corrupted when fix_encoding.py replaced non-Latin-1 chars with '?'."""
import re
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / 'js' / 'app.js'

MODE_ICONS_BLOCK = """    const modeIcons = {
      'default': '📇',
      'fillblank': '✏️',
      'timer': '⏱️',
      'activeMemory': '🧠',
      'step': '👣',
      'reverse': '🔁',
      'random': '🎲',
      'hold': '✋',
      'multiple': '🧩',
      'calcul': '🔢',
      'associer': '🔗',
      'original': '📄',
      'rush': '⚡',
    };"""

MODE_ICONS_BLOCK_SHORT = """        const modeIcons = {
          'default': '📇',
          'activeMemory': '🧠',
          'step': '👣',
          'reverse': '🔁',
          'random': '🎲',
          'hold': '✋',
          'multiple': '🧩',
          'calcul': '🔢',
          'associer': '🔗',
        };"""

REPLACEMENTS = [
    # mode icon fallbacks
    ("modeIcons[mode.id] || '?'", "modeIcons[mode.id] || '🎯'"),
    # reward card UI
    ("preview.textContent = previewEmoji || (locked ? '?' : '?');",
     "preview.textContent = previewEmoji || (locked ? '🔒' : '🎁');"),
    ("previewEmoji: '?'", "previewEmoji: '👣'"),  # welcome quest part 3 only occurrence
    # manifest warning
    ('<div class="fab-notice-icon">??</div>', '<div class="fab-notice-icon">⚠️</div>'),
    # navigation / UI
    ("backBtn.textContent = '? Retour';", "backBtn.textContent = '← Retour';"),
    ("star.textContent = '?';", "star.textContent = '⭐';"),
    ("editBtn.textContent = '??';", "editBtn.textContent = '✏️';"),
    ("corriger.textContent = '? Corriger';", "corriger.textContent = '✓ Corriger';"),
    # TTS button
    ("btn.textContent = '?';", "btn.textContent = '🔊';"),
    ("btn.textContent = '?'; return }", "btn.textContent = '🔊'; return }"),
    ("u.onend = ()=>{ try{ btn.textContent = '?' }", "u.onend = ()=>{ try{ btn.textContent = '🔊' }"),
    ("u.onerror = ()=>{ try{ btn.textContent = '?' }", "u.onerror = ()=>{ try{ btn.textContent = '🔊' }"),
    # admin panel
    ('?? Admin Panel', '🛠️ Admin Panel'),
    # deck browser icons
    ("folderIconDiv.textContent = '?';", "folderIconDiv.textContent = '📁';"),
    ("fileIconDiv.textContent = '?';", "fileIconDiv.textContent = '📄';"),
    ("iconDiv.textContent = '?'; }", "iconDiv.textContent = '📄'; }"),
    ("iconDiv.textContent = '?'; }", "iconDiv.textContent = '📁'; }"),
    # profile / market
    ("fbIcon.textContent = '?';", "fbIcon.textContent = '💬';"),
    ("iconDiv.textContent = '??';", "iconDiv.textContent = '🛍️';"),
    ("modeBadge.textContent = '? NOUVEAU MODE';", "modeBadge.textContent = '✨ NOUVEAU MODE';"),
    ("timerIconDiv.textContent = '???';", "timerIconDiv.textContent = '⏱️';"),
    ("timerBadge.textContent = '? NOUVEAU MODE';", "timerBadge.textContent = '✨ NOUVEAU MODE';"),
    ("rushIconDiv.textContent = '??';", "rushIconDiv.textContent = '⚡';"),
    ("calculIconDiv.textContent = '??';", "calculIconDiv.textContent = '🔢';"),
    ("calculBadge.textContent = '? NOUVEAU MODE';", "calculBadge.textContent = '✨ NOUVEAU MODE';"),
    ("personneTitle.textContent = '? Personnalisation';", "personneTitle.textContent = '🎨 Personnalisation';"),
    ("preview.textContent = '? ' + item.name;", "preview.textContent = '🎨 ' + item.name;"),
    ("colorsSubtitle.textContent = '? Couleurs de fond';", "colorsSubtitle.textContent = '🎨 Couleurs de fond';"),
    ("patternsSubtitle.textContent = '?? Motifs de fond';", "patternsSubtitle.textContent = '🖼️ Motifs de fond';"),
    ("cardPatternsSubtitle.textContent = '? Motifs des cartes';", "cardPatternsSubtitle.textContent = '🃏 Motifs des cartes';"),
    ("animationsSubtitle.textContent = '? Animations';", "animationsSubtitle.textContent = '✨ Animations';"),
    ("activeMemoryIconDiv.textContent = '??';", "activeMemoryIconDiv.textContent = '🧠';"),
    ("activeMemoryStatusDiv.textContent = '? Offert';", "activeMemoryStatusDiv.textContent = '🎁 Offert';"),
    ("toast.textContent = '? Objectif quotidien atteint !';", "toast.textContent = '🎯 Objectif quotidien atteint !';"),
    # sync
    ("h.textContent = '?? Synchronisation';", "h.textContent = '🔄 Synchronisation';"),
    ("syncBadge.textContent = '? Synchronisation active';", "syncBadge.textContent = '✅ Synchronisation active';"),
    ("gStatus.textContent = '? ' +", "gStatus.textContent = '⚠️ ' +"),
    ("eyeBtn.className = 'secondary'; eyeBtn.textContent = '??';", "eyeBtn.className = 'secondary'; eyeBtn.textContent = '👁️';"),
    # missions
    ("dailyBtn.textContent = '? Quotidienne';", "dailyBtn.textContent = '📅 Quotidienne';"),
    ("weeklyBtn.textContent = '? Hebdomadaire';", "weeklyBtn.textContent = '📆 Hebdomadaire';"),
    ("newUserTitle.textContent = '? Nouvel utilisateur';", "newUserTitle.textContent = '👋 Nouvel utilisateur';"),
    # titles UI
    ("icon.textContent = '?'; icon.style.marginBottom='6px'", "icon.textContent = '🏆'; icon.style.marginBottom='6px'"),
    ("icon.textContent = '?'; icon.style.marginBottom='6px'; icon.style.textAlign='center';", "icon.textContent = '🏅'; icon.style.marginBottom='6px'; icon.style.textAlign='center';"),
  # deck editor
    ("deleteBtn.textContent = '??';", "deleteBtn.textContent = '🗑️';"),
    ("deleteFieldBtn.textContent = '??';", "deleteFieldBtn.textContent = '🗑️';"),
    ("testBtn.textContent = '? Tester';", "testBtn.textContent = '🧪 Tester';"),
    ("copyXMLBtn.textContent = '? Copier';", "copyXMLBtn.textContent = '📋 Copier';"),
    ("publishBtn.textContent = '? Publication...';", "publishBtn.textContent = '⏳ Publication...';"),
    ("publishBtn.textContent = '? Publier le Deck';", "publishBtn.textContent = '🚀 Publier le Deck';"),
    # modals
    ("closeBtn.textContent = '?';", "closeBtn.textContent = '✕';"),
    ("saveBtn.textContent = '? Enregistrer';", "saveBtn.textContent = '💾 Enregistrer';"),
    ("testBtn.textContent = '? Envoyer une notification test (serveur)';", "testBtn.textContent = '🔔 Envoyer une notification test (serveur)';"),
    # PWA install
    ("title.textContent = '? Installer Fab\\'Anki';", "title.textContent = '📲 Installer Fab\\'Anki';"),
    # FSRS tuning
    ("title: '? Note (variation)',", "title: '📝 Note (variation)',"),
    # mission toasts — credit symbol
    ("showWelcomeQuestToast(`Mission accomplie ! +${creditReward} ?`);", "showWelcomeQuestToast(`Mission accomplie ! +${creditReward} ℂ`);"),
    ("showWelcomeQuestToast(`Mission accomplie ! +${reward} ?`);", "showWelcomeQuestToast(`Mission accomplie ! +${reward} ℂ`);"),
    ("showWelcomeQuestToast('Mission accomplie ! +10 ?');", "showWelcomeQuestToast('Mission accomplie ! +10 ℂ');"),
    ("showWelcomeQuestToast('Mission accomplie ! +20 ?');", "showWelcomeQuestToast('Mission accomplie ! +20 ℂ');"),
    # welcome quest labels
    ("{ label: 'Ouvrir le Profil ??', done: state.part1.profile_opened, reward: '3 ?' },",
     "{ label: 'Ouvrir le Profil 👤', done: state.part1.profile_opened, reward: '3 ℂ' },"),
    ("const part2 = createQuestPart(' PremiersPartie 2: pas', [",
     "const part2 = createQuestPart('Partie 2: Premiers pas', ["),
    ("{ label: 'Ouvrir un deck', done: !part2Locked && state.part2.deck_opened, reward: '3 ?' },",
     "{ label: 'Ouvrir un deck', done: !part2Locked && state.part2.deck_opened, reward: '3 ℂ' },"),
    ("{ label: 'Terminer une session', done: !part2Locked && state.part2.session_completed, reward: '5 ?' }",
     "{ label: 'Terminer une session', done: !part2Locked && state.part2.session_completed, reward: '5 ℂ' }"),
    # timer tutorial arrows
    ("Vert (Facile) ? Bleu (Bon) ? Orange", "Vert (Facile) → Bleu (Bon) → Orange"),
    # post-welcome part3 reward was wrongly set to timer emoji
    ("{ label: 'Obtenir un titre', done: !part3Locked && state.part3.first_title, reward: '10 ⏱️' },",
     "{ label: 'Obtenir un titre', done: !part3Locked && state.part3.first_title, reward: '10 ℂ' },"),
    # reward card part 4 emoji was wrong in restore (📚 -> should be 🧩 for Multiple)
    ("subtitle: 'Mode Multiple',\n        locked: !part4Done,\n        previewStyle: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',\n        previewEmoji: '📚'",
     "subtitle: 'Mode Multiple',\n        locked: !part4Done,\n        previewStyle: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',\n        previewEmoji: '🧩'"),
]


def fix_mode_icons_blocks(text: str) -> str:
    # Full block (with original/rush)
    text = re.sub(
        r"const modeIcons = \{[^}]*'rush'[^}]*\};",
        MODE_ICONS_BLOCK.strip(),
        text,
        flags=re.DOTALL,
    )
    # Short block (deck browser folder view)
    text = re.sub(
        r"const modeIcons = \{\s*'default':[^}]*'associer'[^}]*\};",
        MODE_ICONS_BLOCK_SHORT.strip(),
        text,
        count=1,
    )
    return text


def main():
    text = APP.read_text(encoding='utf-8')
    original = text

    text = fix_mode_icons_blocks(text)
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)

    # Fix deck browser icon lines (two similar patterns)
    text = text.replace(
        "if(isXml){ iconDiv.style.cssText = 'width:32px;height:32px;border-radius:8px;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;border:1px solid rgba(0,0,0,0.08);'; iconDiv.textContent = '?'; }",
        "if(isXml){ iconDiv.style.cssText = 'width:32px;height:32px;border-radius:8px;background:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;border:1px solid rgba(0,0,0,0.08);'; iconDiv.textContent = '📄'; }",
    )
    text = text.replace(
        "else { iconDiv.style.cssText = 'width:32px;height:32px;border-radius:8px;background:rgba(155,89,208,0.15);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;'; iconDiv.textContent = '?'; }",
        "else { iconDiv.style.cssText = 'width:32px;height:32px;border-radius:8px;background:rgba(155,89,208,0.15);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;'; iconDiv.textContent = '📁'; }",
    )

    if text != original:
        APP.write_text(text, encoding='utf-8', newline='\n')
        print('Emoji restoration complete')
    else:
        print('No changes')

    # Report remaining suspicious patterns
    suspicious = len(re.findall(r"textContent = '\?'", text))
    suspicious += len(re.findall(r"previewEmoji: '\?'", text))
    suspicious += len(re.findall(r"Mission accomplie ! \+[0-9]+ \?", text))
    print(f'Remaining suspicious ? patterns: {suspicious}')


if __name__ == '__main__':
    main()
