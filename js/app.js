  // Single-file app implementing requested functions.

  // Utility: simple DOM helpers
  const $ = sel => document.querySelector(sel);

  // Application state
  let deckURL = null;
  let deck = {title:'', cards:[]};
  let dueCards = [];
  let currentIndex = 0;
  let sessionTotal = 0;
  let reviewedCount = 0;
  let deckKey = null; // prefix for localStorage
  let manifestMeta = {}; // path (relative to decks/) -> manifest entry (cost/level/tags)
  let tooltipShown = false;
  let cardShownAt = Date.now();
  let showHintBox = false; // Toggle for hint box visibility

  function normalizeDeckPath(url){
    let p = url || '';
    p = p.replace(/^\.\//, '');
    if(p.startsWith('./')) p = p.slice(2);
    if(p.startsWith('decks/')) p = p.slice('decks/'.length);
    p = p.replace(/^\//, '');
    try{ p = decodeURIComponent(p); }catch(e){}
    return p;
  }
  function getManifestEntryForPath(url){
    const rel = normalizeDeckPath(url);
    return manifestMeta[rel] || null;
  }
  function isDeckUnlocked(path){
    return localStorage.getItem('fabanki:deck_unlocked:'+normalizeDeckPath(path)) === '1';
  }
  function setDeckUnlocked(path){
    localStorage.setItem('fabanki:deck_unlocked:'+normalizeDeckPath(path), '1');
  }
  function evaluateDeckLock(path){
    try{
      const entry = getManifestEntryForPath(path);
      console.log('evaluateDeckLock - entry:', entry);
      if(!entry) return { locked:false };
      const levelReq = Number(entry.level||0);
      const cost = Number(entry.cost||0);
      console.log('levelReq:', levelReq, 'cost:', cost);
      if(levelReq === 0 && cost === 0) return { locked:false };
      const unlocked = isDeckUnlocked(path);
      console.log('unlocked:', unlocked);
      let currentLevel = 0;
      let currentCredits = 0;
      try{
        if(typeof getXpTotal === 'function' && typeof computeLevelAndProgress === 'function'){
          currentLevel = computeLevelAndProgress(getXpTotal()).level;
        }
      }catch(e){ console.warn('Level check error:', e); }
      try{
        currentCredits = typeof getCredits === 'function' ? getCredits() : Number(localStorage.getItem('fabanki:credits') || 0);
      }catch(e){ console.warn('Credits check error:', e); }
      console.log('currentLevel:', currentLevel, 'currentCredits:', currentCredits);
      const lockedByLevel = levelReq > 0 && currentLevel < levelReq;
      const lockedByCost = cost > 0 && !unlocked && !lockedByLevel;
      console.log('lockedByLevel:', lockedByLevel, 'lockedByCost:', lockedByCost);
      return {
        locked: lockedByLevel || lockedByCost,
        lockedByLevel,
        lockedByCost,
        levelReq,
        cost,
        unlocked,
        currentCredits
      };
    }catch(e){
      console.warn('evaluateDeckLock error:', e);
      return { locked:false };
    }
  }

  // === FSRS storage key helpers ===
  function storageKey(s){ return `fabanki:${deckKey}:${s}` }

  // Ensure incLocal is defined early (fallback) to avoid ReferenceError
  if(typeof incLocal !== 'function'){
    var incLocal = function(key, n){ try{ const v = Number(localStorage.getItem(key) || 0) + (n||1); localStorage.setItem(key, String(v)); return v; }catch(e){ return 0 } };
    try{ window.incLocal = incLocal; }catch(e){}
  }

  // === Function: loadDeckFromURL ===
  async function loadDeckFromURL(url){
    updateStatus('Téléchargement du deck...');
    try{
      // Make sure we're not in multi-deck mode
      multiDeckMode = false;
      onlyNowMode = false;
      
      // Remove welcome page completely (both old and new welcome formats)
      const welcome = document.getElementById('welcome');
      if(welcome) welcome.remove();
      const welcomeDecks = document.getElementById('welcomeDecks');
      if(welcomeDecks) welcomeDecks.remove();
      
      // Show main content
      const mainEl = document.querySelector('main');
      if(mainEl) mainEl.style.display = 'block';
      
      const res = await fetch(url);
      if(!res.ok) throw new Error('HTTP '+res.status);
      const text = await res.text();
      const parser = new DOMParser();
      let xml = parser.parseFromString(text,'application/xml');
      let parsererror = xml.querySelector('parsererror');
      if(parsererror){
        // Fallback: some exported decks contain unescaped '<' inside TeX fields
        // which makes the file not well-formed XML. Try lenient HTML parsing.
        updateStatus('XML invalide — tentative décodage permissif (HTML)');
        xml = parser.parseFromString(text,'text/html');
        parsererror = null;
      }
      parseXMLDeck(xml, url);
      initFSRS();
      updateStatus('Deck chargé — prêt pour révision');
    }catch(err){
      console.error(err);
      updateStatus('Erreur chargement deck: '+err.message);
      deck = {title:'', cards:[]};
      renderEmpty();
    }
  }

  // === Multi-deck review mode ===
  let multiDeckMode = false;
  let multiDeckURLs = [];
  let multiDeckCards = []; // array of {card, deckURL, deckName}
  let cardFieldDefsMap = new Map(); // Map of cardId -> fieldDefs for multi-deck
  let onlyNowMode = false; // when true, sessions show only due-now cards
  
  async function loadMultipleDeckCards(deckURLs, options = {}){
    try{
      const onlyNow = options.onlyNow === true;
      onlyNowMode = onlyNow;
      multiDeckMode = true;
      multiDeckURLs = deckURLs;
      multiDeckCards = [];
      cardFieldDefsMap = new Map(); // Reset the map for new load
      const allCards = [];
      
      // Load all decks and collect cards
      for(const url of deckURLs){
        try{
          const res = await fetch(url);
          if(!res.ok) continue;
          const text = await res.text();
          const parser = new DOMParser();
          let xml = parser.parseFromString(text,'application/xml');
          if(xml.querySelector('parsererror')) xml = parser.parseFromString(text,'text/html');
          
          // Parse deck with proper field definitions (like parseXMLDeck does)
          const tempDeck = {title:'', cards:[], fieldDefs:[]};
          const deckKey = fallbackSha1(url).slice(0,10);
          
          // Title
          const titleEl = xml.querySelector('title') || xml.querySelector('name') || xml.documentElement.getAttribute('name');
          if(titleEl) tempDeck.title = titleEl.textContent ? titleEl.textContent.trim() : (xml.documentElement.getAttribute('name')||'');
          const deckName = tempDeck.title || decodeURIComponent(url.split('/').pop()).replace(/\.xml$/i,'');
          
          // Parse field definitions
          const fieldsContainer = xml.querySelector('fields');
          if(fieldsContainer){
            const defs = Array.from(fieldsContainer.children || []);
            console.log('Loading field definitions for', deckName, '- found', defs.length, 'definitions');
            for(const f of defs){
              const type = (f.localName || f.tagName || '').toLowerCase();
              const name = f.getAttribute('name') || type;
              const sides = interpretSides(f.getAttribute('sides') || '11');
              console.log('  Field def:', {name, type, sides});
              tempDeck.fieldDefs.push({name, type, sides});
            }
          } else {
            console.log('No field definitions container found for', deckName);
          }
          
          // Parse cards with proper field mapping
          const cardNodes = Array.from(xml.getElementsByTagName('card')).length ? Array.from(xml.getElementsByTagName('card')) : Array.from(xml.querySelectorAll('card, note, item, entry, record'));
          let idx = 0;
          for(const node of cardNodes){
            try{
              const id = node.getAttribute('id') || node.getAttribute('guid') || ('card-'+(idx++));
              const fields = {};
              
              // Map card content to field definitions
              const _fieldOrder = []; // preserve field order for multi-deck rendering
              if(tempDeck.fieldDefs.length > 0){
                // Use field definitions order - find matching elements for each definition
                for(const def of tempDeck.fieldDefs){
                  let fieldEl = null;
                  // Try multiple strategies to find the field element:
                  // 1) Direct child with matching name attribute
                  fieldEl = Array.from(node.children).find(ch => (ch.getAttribute && ch.getAttribute('name') === def.name));
                  // 2) Direct child with matching type
                  if(!fieldEl) fieldEl = Array.from(node.children).find(ch => ((ch.localName || ch.tagName || '').toLowerCase() === def.type));
                  // 3) Descendant with matching name attribute
                  if(!fieldEl) fieldEl = node.querySelector(`[name="${def.name}"]`);
                  // 4) Descendant with matching type  
                  if(!fieldEl) fieldEl = node.querySelector(def.type);
                  // 5) Any first child element if nothing else works
                  if(!fieldEl && node.children && node.children.length > 0) fieldEl = node.children[0];
                  
                  if(fieldEl){
                    fields[def.name] = {
                      html: fieldEl.innerHTML,
                      type: def.type,
                      sides: def.sides
                    };
                    _fieldOrder.push(def.name);
                  }
                }
              } else {
                // No field definitions - look for rich-text or tex tags first (like parseXMLDeck does)
                let richTexTags = Array.from(node.querySelectorAll('rich-text, tex'));
                let fieldEls = richTexTags.length > 0 ? richTexTags : Array.from(node.children || []);
                
                // Filter to only element nodes (no text nodes, comments, etc)
                const elementsOnly = fieldEls.filter(el => el.nodeType === 1 && (el.localName || el.tagName)); // nodeType 1 = ELEMENT_NODE
                
                // If we only got 1 element, try getting ALL children as fallback (some XMLs might wrap fields in containers)
                let fieldsToProcess = elementsOnly;
                if(elementsOnly.length <= 1){
                  // Fallback: get all child elements, not just rich-text/tex
                  fieldsToProcess = Array.from(node.children || []).filter(el => el.nodeType === 1 && (el.localName || el.tagName));
                }
                
                for(let fi = 0; fi < fieldsToProcess.length; fi++){
                  const f = fieldsToProcess[fi];
                  const tag = (f.getAttribute && f.getAttribute('name')) || (f.localName || f.tagName || '').toLowerCase();
                  // Keep all fields, don't skip any - we need the full structure
                  if(!tag) continue;
                  
                  // First field is front, rest are back
                  const isFront = (fi === 0);
                  fields[tag] = {
                    html: f.innerHTML || '',
                    type: (f.localName || f.tagName || '').toLowerCase(),
                    sides: {front: isFront, back: !isFront, always: false}
                  };
                  _fieldOrder.push(tag);
                }
              }
              // Always create the card with _fieldOrder, even if empty
              tempDeck.cards.push({id, fields, _fieldOrder: _fieldOrder.length > 0 ? _fieldOrder : Object.keys(fields)});
            }catch(e){ continue }
          }
          
          // Get due cards for this deck
          const now = new Date();
          
          // Debug: log field defs for this deck
          if(tempDeck.fieldDefs.length > 0){
            console.log('Loading multi-deck:', deckName, '- Field defs:', tempDeck.fieldDefs.map(d => d.name));
          }
          
          for(const c of tempDeck.cards){
            const key = `fabanki:${deckKey}:card:${c.id}`;
            const storedData = localStorage.getItem(key);
            let st = null;
            if(storedData){
              try{ st = JSON.parse(storedData); } catch(e){ st = null; }
            }
            const due = st && st.due ? new Date(st.due) : now;
            // Card is new if: no state exists OR no last review but reps is 0/undefined
            const isNew = (!st || (!st.last && (st.reps===0 || st.reps===undefined)));
            // Store field definitions in map so renderBack can access them
            cardFieldDefsMap.set(c.id, tempDeck.fieldDefs);
            // Add all cards to allCards - filtering will happen later
            allCards.push({card: c, deckURL: url, deckName, deckKey, isNew});
          }
        }catch(e){ console.warn('Error loading deck:', url, e); }
      }
      
      // Shuffle: separate by due status, shuffle each group, then concatenate
      const now = new Date();
      
      // Separate into due status groups
      const nowCards = [];
      const futureCards = [];
      for(const card of allCards){
        if(card.isNew){
          if(!onlyNow) continue; // new cards are excluded in only-now mode
          else continue; // explicit for clarity
        }
        const st = JSON.parse(localStorage.getItem(`fabanki:${card.deckKey}:card:${card.card.id}`) || '{}');
        const due = st && st.due ? new Date(st.due) : now;
        if(due <= now) {
          nowCards.push(card); // Due now or in past
        } else if(!onlyNow) {
          futureCards.push(card); // Due in future (only if not only-now mode)
        }
      }
      
      const newCards = onlyNow ? [] : allCards.filter(x => x.isNew);
      
      const shuffle = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] } };
      shuffle(nowCards);
      shuffle(futureCards);
      shuffle(newCards);
      
      // Order: Maintenant (due now) first, then future, then new
      multiDeckCards = onlyNow ? nowCards : nowCards.concat(futureCards).concat(newCards);
      
      if(multiDeckCards.length === 0){
        updateStatus(onlyNow ? 'Aucune carte à réviser maintenant' : 'Aucune carte à réviser');
        renderEmpty();
        return;
      }
      
      console.log('Multi-deck loaded:', multiDeckCards.length, 'cards');
      multiDeckCards.slice(0,3).forEach(c => {
        console.log('  Card:', c.card.id, 'from:', c.deckName, 'has fieldDefs in map:', cardFieldDefsMap.has(c.card.id));
      });
      
      // Set up pseudo-deck for display
      deck = {title: 'Révision Multi-Deck', cards: multiDeckCards.map(x => x.card)};
      deckKey = 'multideck';
      dueCards = multiDeckCards;
      sessionTotal = dueCards.length;
      reviewedCount = 0;
      currentIndex = 0;
      
      // Ensure progress info element is visible and initialized
      const progressInfo = document.getElementById('progressInfo');
      if(progressInfo) { progressInfo.textContent = `Revisées : 0 / ${sessionTotal}`; progressInfo.style.display = 'block'; }
      
      updateStatus('Multi-Deck chargé — prêt pour révision');
      showNextCard();
      updateProgressDisplay();
      // Update histogram for the first deck in multi-deck mode
      if(multiDeckCards.length > 0){
        updateHistogramForDeck(multiDeckCards[0].deckKey);
      } else {
        updateHistogram();
      }
    }catch(err){
      console.error('Multi-deck error:', err);
      updateStatus('Erreur chargement multi-deck: '+err.message);
      multiDeckMode = false;
      onlyNowMode = false;
    }
  }


  // === Function: parseXMLDeck ===
  // Parse the <fields> definition (name,type,sides) and build per-card `fields` objects.
  // Rules implemented:
  // - Read field definitions from <fields> (order preserved) and store in deck.fieldDefs.
  // - For each <card>, build card.fields = { [fieldName]: { html, type, sides } }.
  // - If a field is absent in a <card>, it is omitted (robustness requirement).
  function parseXMLDeck(xml, url){
    // create a deckKey based on URL (use synchronous fallback hash to avoid Promise issues)
    deckKey = fallbackSha1(url).slice(0,10);
    deck = {title:'', cards:[], fieldDefs:[]};

    // title (optional)
    const titleEl = xml.querySelector('title') || xml.querySelector('name') || xml.documentElement.getAttribute('name');
    if(titleEl) deck.title = titleEl.textContent ? titleEl.textContent.trim() : (xml.documentElement.getAttribute('name')||'');

    // --- Read <fields> definitions ---
    // Each child of <fields> defines a field: tag name (rich-text|tex), @name and @sides.
    const fieldsContainer = xml.querySelector('fields');
    if(fieldsContainer){
      const defs = Array.from(fieldsContainer.children || []);
      for(const f of defs){
        // Use localName when available for robust tag detection
        const type = (f.localName || f.tagName || '').toLowerCase(); // e.g. 'rich-text' or 'tex'
        const name = f.getAttribute('name') || '';
        const sidesAttr = f.getAttribute('sides') || (f.textContent||'');
        const sides = interpretSides(sidesAttr);
        const lang = f.getAttribute('lang') || f.getAttribute('xml:lang') || '';
        if(name) deck.fieldDefs.push({name, type, sides, lang});
      }
    }

    // If no field definitions detected, fall back to old heuristic to keep backwards compatibility.
    if(deck.fieldDefs.length === 0){
      // Find any explicit field-like tags to infer names
      const inferred = Array.from(xml.querySelectorAll('rich-text,tex')).map(n=>({name:n.getAttribute('name')||'Front', type:n.tagName.toLowerCase(), sides:{front:true,back:false,always:false}}));
      deck.fieldDefs = inferred.length ? inferred : [{name:'Front', type:'rich-text', sides:{front:true,back:false,always:false}},{name:'Back', type:'rich-text', sides:{front:false,back:true,always:false}}];
    }

    // --- Build cards from <cards><card> ---
    // Prefer explicit <cards><card> nodes; fallback to any <card> elements anywhere
    const cardNodes = Array.from(xml.getElementsByTagName('card'));
    const candidates = cardNodes.length ? cardNodes : Array.from(xml.querySelectorAll('card, note, item, entry, record'));

    let idx = 0;
    for(const node of candidates){
      try{
        const cardObj = { id: node.getAttribute('id') || node.getAttribute('guid') || ('card-'+(idx++)), fields: {} };

        // For each fieldDef, attempt to read the corresponding element inside this <card>
        for(const def of deck.fieldDefs){
          let el = null;
          // 1) any child element with attribute name equal to field name
          el = Array.from(node.children).find(ch => (ch.getAttribute && ch.getAttribute('name') === def.name));
          // 2) any child element whose localName/tag matches the expected type and (optional) name
          if(!el) el = Array.from(node.children).find(ch => ((ch.localName || ch.tagName || '').toLowerCase() === def.type));
          // 3) fallback: any descendant with name attribute matching
          if(!el) el = node.querySelector(`[name="${def.name}"]`);
          // 4) last resort: first child element
          if(!el && node.children && node.children.length>0) el = node.children[0];

          if(el){
            // For <tts> fields, preserve textContent (treat like <p>) to avoid raw HTML parsing
            let html = '';
            if((def.type||'').toLowerCase() === 'tts'){
              html = (el.textContent || '').trim();
            } else {
              html = (el.innerHTML || '').trim();
            }
            const fldLang = el.getAttribute && (el.getAttribute('lang') || el.getAttribute('xml:lang')) || def.lang || '';
            cardObj.fields[def.name] = { html, type: def.type, sides: def.sides, lang: fldLang };
          }
        }

        // Only include card if it has at least one field
        if(Object.keys(cardObj.fields).length>0) deck.cards.push(cardObj);
        }catch(e){ console.warn('ignored malformed card', e); continue }
      }
    // If still empty, try to parse table rows as last fallback
    if(deck.cards.length===0){
      const rows = Array.from(xml.querySelectorAll('tr'));
      for(const r of rows){
        const tds = Array.from(r.querySelectorAll('td'));
        if(tds.length>=2){
          const cardObj = { id: 'card-'+(idx++), fields: {} };
          cardObj.fields['Front'] = { html: tds[0].innerHTML||'', type: 'rich-text', sides: {front:true,back:false,always:false} };
          cardObj.fields['Back']  = { html: tds[1].innerHTML||'', type: 'rich-text', sides: {front:false,back:true,always:false} };
          deck.cards.push(cardObj);
        }
      }
    }

    if(deck.cards.length===0) throw new Error('Aucune carte détectée dans le fichier XML');

    // Update UI
    $('#deckInfo').textContent = `Deck: ${deck.title || 'non nommé'} — ${deck.cards.length} cartes`;
  }

  // === Function: interpretSides ===
  // Accepts strings like "11","10","01", or words 'front','back','both','always'.
  function interpretSides(s){
    const out = {front:false, back:false, always:false};
    if(!s) { out.front=true; out.back=false; return out; }
    s = String(s).trim().toLowerCase();
    if(s==='both' || s==='11' || s==='always') { out.front=true; out.back=true; out.always=true; return out; }
    if(s==='front' || s==='f' || s==='10') { out.front=true; out.back=false; return out; }
    if(s==='back' || s==='b' || s==='01') { out.front=false; out.back=true; return out; }
    if(s.length===2 && /[01]{2}/.test(s)){ out.front = s[0]==='1'; out.back = s[1]==='1'; out.always = out.front && out.back; return out; }
    // fallback: show on front
    out.front=true; return out;
  }

  // === Function: showDeckOverview ===
  // Shows an intermediate view with ring chart, card grid, and stats before reviewing
  async function showDeckOverview(url){
    try{
      // Show contextual onboarding on first open
      setTimeout(() => {
        if(typeof showOverviewOnboarding === 'function'){
          showOverviewOnboarding();
        }
      }, 500);
      
      // Find and remove the welcome element completely (both old and new formats)
      const welcome = document.getElementById('welcome');
      if(welcome) {
        console.log('Removing welcome element');
        welcome.remove();
      }
      const welcomeDecks = document.getElementById('welcomeDecks');
      if(welcomeDecks) {
        console.log('Removing welcomeDecks');
        welcomeDecks.remove();
      }
      
      // Hide main and stats
      const mainEl = document.querySelector('main');
      if(mainEl) {
        mainEl.style.display = 'none';
        mainEl.style.visibility = 'hidden';
      }
      const statsEl = document.getElementById('stats');
      if(statsEl) {
        statsEl.style.display = 'none';
        statsEl.style.visibility = 'hidden';
      }
      // Hide footer during overview
      const footerEl = document.querySelector('footer');
      if(footerEl) {
        footerEl.style.display = 'none';
      }

      // Hide and remove aria-hidden from any open overlays/modals
      const deckBrowserOverlay = document.getElementById('deckBrowserOverlay');
      if(deckBrowserOverlay) {
        deckBrowserOverlay.style.display = 'none';
        deckBrowserOverlay.classList.remove('open');
        deckBrowserOverlay.removeAttribute('aria-hidden');
      }
      
      const modals = document.querySelectorAll('.modal-overlay, .modal.open');
      modals.forEach(m => { 
        m.classList.remove('open'); 
        m.style.display = 'none'; 
        m.style.visibility = 'hidden';
        m.removeAttribute('aria-hidden');
      });

      // Ensure manifest metadata is available for lock checks
      if(Object.keys(manifestMeta||{}).length === 0){
        try{
          const manifestRes = await fetch('./decks/manifest.json');
          if(manifestRes && manifestRes.ok){
            const list = await manifestRes.json();
            console.log('Loaded manifest list:', list);
            if(Array.isArray(list)){
              manifestMeta = {};
              list.forEach(item => {
                console.log('Processing manifest item:', item);
                if(typeof item === 'string') manifestMeta[item] = { path:item };
                else if(item && item.path) {
                  console.log('Storing manifest entry for', item.path, ':', item);
                  manifestMeta[item.path] = item;
                }
              });
              console.log('Final manifestMeta:', manifestMeta);
            }
          }
        }catch(e){console.log('Manifest fetch error:', e);}
      }

      // Lock check is now handled in the overview page button display
      // No need to block access to overview - just show buy/lock button instead of start button

      // Create overview container with high z-index to ensure visibility
      const container = document.createElement('div');
      container.id = 'deckOverviewContainer';
      container.style.cssText = `
        padding:20px;
        overflow-y:auto;
        max-height:90vh;
        position:relative;
        z-index:9999;
        background:var(--bg);
        width:100%;
      `;

      // Parse deck to get stats
      const res = await fetch(url);
      const text = await res.text();
      const parser = new DOMParser();
      let xml = parser.parseFromString(text,'application/xml');
      if(xml.querySelector('parsererror')) xml = parser.parseFromString(text,'text/html');
      
      const tempDeck = {title:'', cards:[], fieldDefs:[]};
      const deckKeyForStats = fallbackSha1(url).slice(0,10);
      
      const titleEl = xml.querySelector('title') || xml.querySelector('name');
      if(titleEl) tempDeck.title = titleEl.textContent?.trim() || '';
      
      const cardNodes = Array.from(xml.getElementsByTagName('card')).length 
        ? Array.from(xml.getElementsByTagName('card')) 
        : Array.from(xml.querySelectorAll('card, note, item, entry, record'));
      
      // Count cards by due status
      const now = new Date();
      const counts = {new:0, now:0, h12:0, tomorrow:0, week:0, long:0};
      const cardsList = [];
      let reviewed = 0;
      
      console.log('Overview: deckKeyForStats=', deckKeyForStats, 'Looking for keys like: fabanki:' + deckKeyForStats + ':card:*');
      
      // Show all localStorage keys that match this deck (for debugging)
      const allKeys = Object.keys(localStorage);
      const deckKeys = allKeys.filter(k => k.includes(deckKeyForStats));
      console.log('Found', deckKeys.length, 'localStorage keys for this deck:', deckKeys.slice(0, 5), '...');
      
      let idx = 0; // Counter for card IDs (same as parseXMLDeck)
      
      for(const cardNode of cardNodes){
        try{
          // USE SAME ID LOGIC AS parseXMLDeck to ensure consistency with localStorage keys
          const cardId = cardNode.getAttribute('id') || cardNode.getAttribute('guid') || ('card-'+(idx++));
          const key = `fabanki:${deckKeyForStats}:card:${cardId}`;
          const storedData = localStorage.getItem(key);
          
          // Parse stored data - must handle null properly
          let st = null;
          if(storedData){
            try{ st = JSON.parse(storedData); } catch(e){ st = null; }
          }
          
          // Check if card has been reviewed (has a last review time)
          const hasBeenReviewed = st !== null && st.last !== undefined && st.last !== null;
          const due = (st && st.due) ? new Date(st.due) : now;
          const isNew = !hasBeenReviewed; // Card is new only if it's never been reviewed
          const reps = st?.reps || 0;
          
          // Debug logging for categorization
          console.log('Overview card categorization:', {cardId, storedData: !!storedData, st, hasBeenReviewed, isNew, due, hrs: due ? (due - now) / (1000*60*60) : 'N/A'});
          
          // Count reviewed
          if(hasBeenReviewed) reviewed++;
          
          // Get first field for card display
          const firstField = cardNode.children[0]?.innerHTML || cardNode.textContent?.slice(0,60) || '...';
          
          // Categorize by review status first, then by due date
          let category = 'long';
          if(isNew) {
            category = 'new';
          } else if(hasBeenReviewed) {
            // Only categorize by due date if card was already reviewed
            if(due <= now) category = 'now';
            else {
              const hrs = (due - now) / (1000*60*60);
              if(hrs <= 12) category = 'h12';
              else if(hrs <= 24) category = 'tomorrow';
              else if(hrs <= 24*7) category = 'week';
              else category = 'long';
            }
          }
          
          counts[category]++;
          cardsList.push({id:cardId, category, html:firstField, due, reps});
        }catch(e){ console.warn('Error processing card in overview:', e); continue; }
      }

      // Color mapping
      const colors = {new:'#a78bfa', now:'#ef4444', h12:'#f97316', tomorrow:'#eab308', week:'#22c55e', long:'#06b6d4'};
      const labels = {new:'Nouveau', now:'Maintenant', h12:'< 12h', tomorrow:'Demain', week:'< 1 semaine', long:'Futur'};
      
      // Build header
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;gap:20px;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;';
      
      // Ring chart
      const chartDiv = document.createElement('div');
      chartDiv.style.cssText = 'flex:0 0 200px;display:flex;flex-direction:column;align-items:center;';
      const canvas = document.createElement('canvas');
      canvas.width = 180;
      canvas.height = 180;
      chartDiv.appendChild(canvas);
      
      // Draw ring chart
      const ctx = canvas.getContext('2d');
      const total = Object.values(counts).reduce((a,b)=>a+b, 0);
      let angle = 0;
      const radius = 80;
      const centerX = 90, centerY = 90;
      
      Object.entries(counts).forEach(([cat, cnt]) => {
        if(cnt === 0) return;
        const sliceAngle = (cnt / total) * 2 * Math.PI;
        
        // Draw ring segment
        ctx.fillStyle = colors[cat];
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, angle, angle + sliceAngle);
        ctx.arc(centerX, centerY, radius - 20, angle + sliceAngle, angle, true);
        ctx.fill();
        angle += sliceAngle;
      });
      
      // Legend
      const legend = document.createElement('div');
      legend.style.cssText = 'font-size:0.85em;margin-top:12px;text-align:center;';
      Object.entries(counts).forEach(([cat, cnt]) => {
        if(cnt === 0) return;
        const line = document.createElement('div');
        line.style.cssText = `margin:4px 0;color:#666;`;
        line.innerHTML = `<span style="display:inline-block;width:12px;height:12px;background:${colors[cat]};margin-right:6px;border-radius:2px;"></span>${labels[cat]}: ${cnt}`;
        legend.appendChild(line);
      });
      chartDiv.appendChild(legend);
      header.appendChild(chartDiv);
      
      // Stats and button
      const rightPanel = document.createElement('div');
      rightPanel.style.cssText = 'flex:1;min-width:200px;';
      
      // Back button to restore deck browser
      const backBtn = document.createElement('button');
      backBtn.textContent = '← Retour';
      backBtn.className = 'secondary';
      backBtn.style.cssText = 'width:100%;padding:8px;font-size:0.9em;margin-bottom:12px;';
      backBtn.addEventListener('click', ()=>{
        const overviewContainer = document.getElementById('deckOverviewContainer');
        if(overviewContainer) overviewContainer.remove();
        // Return to home by reloading without deck parameter
        window.location.href = window.location.origin + window.location.pathname;
      });
      rightPanel.appendChild(backBtn);
      
      const title = document.createElement('h2');
      title.textContent = tempDeck.title || 'Deck';
      title.style.cssText = 'margin:0 0 16px 0;font-size:1.4em;';
      rightPanel.appendChild(title);
      
      const stats = document.createElement('div');
      stats.style.cssText = 'background:linear-gradient(135deg, #1e293b 0%, #334155 100%);color:#fff;padding:16px;border-radius:12px;margin-bottom:16px;font-size:0.9em;line-height:1.8;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      
      // Accuracy calculation
      let accuracySum = 0, reviewedTotal = 0;
      for(const c of cardsList){
        if(c.category === 'now') { accuracySum += 0; reviewedTotal++; }
        else if(c.category === 'h12') { accuracySum += 5; reviewedTotal++; }
        else if(c.category === 'tomorrow') { accuracySum += 10; reviewedTotal++; }
        else if(c.category === 'week') { accuracySum += 15; reviewedTotal++; }
        else if(c.category === 'long') { accuracySum += 20; reviewedTotal++; }
      }
      const accuracy = reviewedTotal > 0 ? (accuracySum / reviewedTotal).toFixed(2) : 'N/A';
      
      stats.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Cartes révisées</span><strong>${reviewed}</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Total</span><strong>${total}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>Précision</span><strong>${accuracy}</strong></div>
      `;
      rightPanel.appendChild(stats);
      
      // Check if deck is locked and show appropriate button
      const lockState = evaluateDeckLock(url);
      console.log('Lock state for', url, ':', lockState);
      console.log('manifestMeta:', manifestMeta);
      console.log('normalized path:', normalizeDeckPath(url));
      const startBtn = document.createElement('button');
      
      if(lockState.locked && lockState.lockedByCost){
        // Show buy button
        startBtn.textContent = `Acheter pour ${lockState.cost} 💳`;
        startBtn.className = lockState.currentCredits >= lockState.cost ? 'primary' : 'secondary';
        startBtn.disabled = lockState.currentCredits < lockState.cost;
        startBtn.style.cssText = 'width:100%;padding:12px;font-size:1em;';
        startBtn.addEventListener('click', ()=>{
          const freshState = evaluateDeckLock(url);
          if(freshState.currentCredits < freshState.cost){
            alert(`Crédits insuffisants. Vous avez ${freshState.currentCredits} 💳, il en faut ${freshState.cost} 💳`);
            return;
          }
          if(typeof addCredits === 'function') addCredits(-freshState.cost);
          setDeckUnlocked(url);
          alert(`Deck débloqué ! Il vous reste ${freshState.currentCredits - freshState.cost} 💳`);
          // Reload the overview to show the start button
          showDeckOverview(url);
        });
      } else if(lockState.locked && lockState.lockedByLevel){
        // Show level requirement
        startBtn.textContent = `🔒 Niveau ${lockState.levelReq} requis`;
        startBtn.className = 'secondary';
        startBtn.disabled = true;
        startBtn.style.cssText = 'width:100%;padding:12px;font-size:1em;opacity:0.6;cursor:not-allowed;';
      } else {
        // Show start button (deck is unlocked)
        startBtn.textContent = 'Démarrer';
        startBtn.className = 'primary';
        startBtn.style.cssText = 'width:100%;padding:12px;font-size:1em;';
        startBtn.addEventListener('click', ()=>{ 
          console.log('Démarrer clicked - starting review');
        
        // Hide the overview container completely
        const overviewContainer = document.getElementById('deckOverviewContainer');
        if(overviewContainer) {
          overviewContainer.remove();
          console.log('Overview removed');
        }
        
        // Exit multi-deck mode
        multiDeckMode = false;
        
        // Remove welcome page completely (both formats)
        const welcome = document.getElementById('welcome');
        if(welcome) {
          welcome.remove();
          console.log('Welcome removed');
        }
        const welcomeDecks = document.getElementById('welcomeDecks');
        if(welcomeDecks) {
          welcomeDecks.remove();
          console.log('WelcomeDecks removed');
        }
        
        // Show main content - be aggressive
        const mainEl = document.querySelector('main');
        if(mainEl) {
          mainEl.style.display = 'block';
          mainEl.style.visibility = 'visible';
          console.log('Main shown');
        }
        
        // Also hide stats
        const statsEl = document.getElementById('stats');
        if(statsEl) statsEl.style.display = 'none';
        
        // Load the deck (which will call showNextCard internally)
        deckURL = url;
        loadDeckFromURL(url);
      });
      }
      rightPanel.appendChild(startBtn);
      
      header.appendChild(rightPanel);
      container.appendChild(header);
      
      // Card grid
      const gridTitle = document.createElement('h3');
      gridTitle.textContent = 'Cartes';
      gridTitle.style.cssText = 'margin:24px 0 12px 0;';
      container.appendChild(gridTitle);
      
      // Sort cardsList by category in the specified order
      const categoryOrder = {now: 0, h12: 1, tomorrow: 2, week: 3, long: 4, new: 5};
      cardsList.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
      
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;';
      
      for(const card of cardsList){
        const cardEl = document.createElement('div');
        cardEl.style.cssText = `
          background:${colors[card.category]};
          color:white;
          padding:12px;
          border-radius:12px;
          font-size:0.85em;
          word-wrap:break-word;
          opacity:0.9;
          position:relative;
          cursor:pointer;
        `;
        
        // Render card content with KaTeX support
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = card.html;
        
        // Try to render KaTeX if available
        if(typeof katex !== 'undefined' && typeof renderMathInElement !== 'undefined'){
          try{
            renderMathInElement(contentDiv, {
              delimiters: [
                {left: '$$', right: '$$', display: true},
                {left: '$', right: '$', display: false},
                {left: '\\[', right: '\\]', display: true},
                {left: '\\(', right: '\\)', display: false}
              ],
              throwOnError: false
            });
          }catch(e){ console.warn('KaTeX render error:', e); }
        }
        
        // Get text preview
        const preview = contentDiv.textContent.replace(/<[^>]*>/g,'').slice(0,60);
        cardEl.textContent = preview + (preview.length >= 60 ? '...' : '');
        
        // Add tooltip on hover
        const tooltip = document.createElement('div');
        tooltip.style.cssText = `
          position:absolute;
          bottom:100%;
          left:50%;
          transform:translateX(-50%);
          background:#333;
          color:#fff;
          padding:8px 12px;
          border-radius:6px;
          font-size:0.75em;
          white-space:nowrap;
          z-index:10000;
          pointer-events:none;
          opacity:0;
          transition:opacity 0.2s;
          margin-bottom:8px;
        `;
        
        // Calculate relative time strings
        const now = new Date();
        const formatRelativeTime = (date) => {
          const diff = date - now;
          if(diff < 0) return 'maintenant';
          
          const ms = diff;
          const mins = Math.floor(ms / (1000*60));
          const hrs = Math.floor(ms / (1000*60*60));
          const days = Math.floor(ms / (1000*60*60*24));
          
          if(days > 0) return days + 'j';
          if(hrs > 0) return hrs + 'h';
          if(mins > 0) return mins + 'min';
          return 'maintenant';
        };
        
        // Get stored data for this card
        const storedKey = `fabanki:${deckKeyForStats}:card:${card.id}`;
        const storedData = localStorage.getItem(storedKey);
        let tooltipText = 'Aucune donnée';
        if(storedData){
          try{
            const st = JSON.parse(storedData);
            tooltipText = '';
            if(st.due) tooltipText = `Prochain: ${formatRelativeTime(new Date(st.due))}`;
            if(st.last) tooltipText += (tooltipText ? ' | ' : '') + `Dernier: ${formatRelativeTime(new Date(st.last))}`;
            if(!tooltipText) tooltipText = 'Aucune donnée';
          }catch(e){ tooltipText = 'Erreur'; }
        }
        
        tooltip.textContent = tooltipText;
        cardEl.appendChild(tooltip);
        
        // Show tooltip on hover
        cardEl.addEventListener('mouseenter', () => {
          tooltip.style.opacity = '1';
          // Auto-hide after 3 seconds
          setTimeout(() => { tooltip.style.opacity = '0'; }, 3000);
        });
        cardEl.addEventListener('mouseleave', () => {
          tooltip.style.opacity = '0';
        });
        
        
        grid.appendChild(cardEl);
      }
      container.appendChild(grid);
      
      // Add to page with explicit styling to ensure visibility
      // Remove any previous overview
      const oldContainer = document.getElementById('deckOverviewContainer');
      if(oldContainer) oldContainer.remove();
      
      // Append directly to body so it's on top of everything
      document.body.appendChild(container);
      
      // Scroll to top
      window.scrollTo(0, 0);
      
      updateStatus(`${tempDeck.title} - ${total} cartes`);
    }catch(e){
      console.error('Deck overview error:', e);
      updateStatus('Erreur: ' + e.message);
    }
  }

  // === Function: renderFront ===
  // Render fields that are allowed on the front side according to their `sides`.
  // Each card now has `card.fields` where keys are field names and values are {html,type,sides}.
  function renderFront(card){
    const frontEl = $('#front');
    const alwaysEl = $('#always');
    if(!card) { frontEl.innerHTML=''; alwaysEl.textContent=''; return }

    // Clear previous content
    frontEl.innerHTML = '';
    alwaysEl.textContent = '';

    const defs = deck.fieldDefs || [];
    let anyAlways = false;
    
    if(defs.length === 0){
      // No field definitions: show first field on front (multi-deck fallback)
      // Use _fieldOrder if available for correct ordering
      if(card.fields && card._fieldOrder && card._fieldOrder.length > 0){
        const fieldName = card._fieldOrder[0];
        const f = card.fields[fieldName];
        if(f){
          const def = {name: fieldName, type: f.type || 'rich-text', sides: {front: true, back: false}};
          const node = buildFieldElement(def, f);
          frontEl.appendChild(node);
        }
      } else if(card.fields){
        // Fallback if _fieldOrder not available
        let isFirst = true;
        for(const fieldName in card.fields){
          if(isFirst){
            const f = card.fields[fieldName];
            if(f){
              const def = {name: fieldName, type: f.type || 'rich-text', sides: {front: true, back: false}};
              const node = buildFieldElement(def, f);
              frontEl.appendChild(node);
            }
            isFirst = false;
            break;
          }
        }
      }
    } else {
      // Use field definitions
      for(const def of defs){
        const f = card.fields && card.fields[def.name];
        if(!f) continue;
        // Get sides, defaulting to front if not specified
        const sides = f.sides || def.sides || {front: true, back: false};
        if(sides.always || sides.front){
          const node = buildFieldElement(def, f);
          frontEl.appendChild(node);
        }
        if(sides.always) anyAlways = true;
      }
    }

    alwaysEl.textContent = '';
  }

  // === Function: renderBack ===
  // Similar to renderFront but shows fields allowed on the back side.
  function renderBack(card){
    const backEl = $('#back');
    if(!card){ backEl.innerHTML=''; return }

    backEl.innerHTML = '';
    // In multi-deck mode, get field defs from the map using card.id
    let defs = [];
    if(multiDeckMode && card && card.id){
      defs = cardFieldDefsMap.get(card.id) || [];
    }
    if(!defs || defs.length === 0){
      defs = deck.fieldDefs || [];
    }
    
    // DEBUG: Always log to see what's happening
    console.log('renderBack:', {
      cardId: card?.id,
      multiDeckMode,
      defsCount: defs.length,
      defsNames: defs.map(d => d.name),
      cardFieldsKeys: card && card.fields ? Object.keys(card.fields) : [],
      cardFieldsLength: card && card.fields ? Object.keys(card.fields).length : 0
    });
    
    let anyContent = false;
    const frontVisible = (function(){ try{ const fe = document.getElementById('front'); return fe && fe.style.display !== 'none'; }catch(e){ return false } })();
    
    if(defs.length === 0){
      // No field definitions: show all fields except first on back (multi-deck)
      // Use _fieldOrder if available to preserve XML order
      if(card.fields && card._fieldOrder && card._fieldOrder.length > 1){
        // Multiple fields - show all except first
        for(let i = 1; i < card._fieldOrder.length; i++){
          const fieldName = card._fieldOrder[i];
          const f = card.fields[fieldName];
          if(f){
            const def = {name: fieldName, type: f.type || 'rich-text', sides: {front: false, back: true}};
            const node = buildFieldElement(def, f);
            backEl.appendChild(node);
            anyContent = true;
          }
        }
      } else if(card.fields && card._fieldOrder && card._fieldOrder.length === 1){
        // Only one field - nothing to show on back
        anyContent = false;
      } else if(card.fields){
        // Fallback if _fieldOrder not available - try to find additional fields
        let isFirst = true;
        for(const fieldName in card.fields){
          if(!isFirst){
            const f = card.fields[fieldName];
            if(f){
              const def = {name: fieldName, type: f.type || 'rich-text', sides: {front: false, back: true}};
              const node = buildFieldElement(def, f);
              backEl.appendChild(node);
              anyContent = true;
            }
          } else {
            isFirst = false;
          }
        }
      }
    } else {
      // Use field definitions - show fields marked for back
      // FIRST: Check if any field definitions actually match card fields
      const cardFieldKeys = card.fields ? Object.keys(card.fields) : [];
      const defsMatch = defs.some(d => card.fields && card.fields[d.name]);
      
      if(!defsMatch && cardFieldKeys.length > 0){
        // Field definitions don't match card fields - use actual card field names instead
        console.log('Field defs dont match card fields. Using actual card fields instead. Defs:', defs.map(d=>d.name), 'Card fields:', cardFieldKeys);
        
        // Show all fields except first
        let isFirst = true;
        for(const fieldName of cardFieldKeys){
          if(isFirst){
            isFirst = false;
            continue;
          }
          const f = card.fields[fieldName];
          if(f){
            const def = {name: fieldName, type: f.type || 'rich-text', sides: {front: false, back: true}};
            const node = buildFieldElement(def, f);
            backEl.appendChild(node);
            anyContent = true;
          }
        }
      } else {
        // Field definitions match - use them
        let foundAny = false;
        let fieldsShown = 0;
        
        for(const def of defs){
          const f = card.fields && card.fields[def.name];
          if(!f) {
            console.warn('Field not found for def:', def.name, 'available fields:', Object.keys(card.fields || {}));
            continue;
          }
          foundAny = true;
          // Get sides info, defaulting to {front:true,back:false} if not specified (don't show duplicates)
          const sides = f.sides || def.sides || {front: true, back: false};
          // Skip if only on front and front is visible
          if(sides.front && !sides.back && frontVisible) {
            continue;
          }
          // Show if marked for back, but NOT if 'always' (always fields go to alwaysEl, not back)
          if(sides.back && !sides.always){
            const node = buildFieldElement(def, f);
            backEl.appendChild(node);
            anyContent = true;
            fieldsShown++;
          }
        }
        
        // Debug: if we have field definitions but didn't find any fields, log it
        if(defs.length > 0 && !foundAny && card.fields){
          console.error('ERROR: No matching fields in card. Expected defs:', defs.map(d=>d.name), 'Card has fields:', Object.keys(card.fields), 'Card:', card);
        }
      }
      
      // If field definitions path didn't work, fallback to _fieldOrder
      if(!anyContent && card._fieldOrder && card._fieldOrder.length > 1){
        console.log('Falling back to _fieldOrder approach for back content');
        for(let i = 1; i < card._fieldOrder.length; i++){
          const fieldName = card._fieldOrder[i];
          const f = card.fields[fieldName];
          if(f){
            const def = {name: fieldName, type: f.type || 'rich-text', sides: {front: false, back: true}};
            const node = buildFieldElement(def, f);
            backEl.appendChild(node);
            anyContent = true;
          }
        }
      }
    }

    if(!anyContent){ backEl.innerHTML = '<em>Contenu masqué côté réponse</em>'; }
  }

  // Helper: buildFieldElement(def, f)
  // Returns an HTMLElement for a given field definition and card field value.
  function buildFieldElement(def, f){
    const wrapper = document.createElement('div');
    wrapper.className = 'field field-'+def.name.replace(/\s+/g,'-').toLowerCase();
    // Treat only explicit 'tex'/'math' types as TeX — avoid matching 'text'
    const ttype = (f.type||def.type||'').toLowerCase();
    const isTexType = ['tex','math','latex'].includes(ttype);
    const isTTS = (ttype === 'tts');
    const isPlainText = (ttype === 'text');
    const containsBlockTags = /<(p|div|ul|ol|li|table|tr|td|br|h[1-6])\b/i.test(f.html||'');
    if(isTTS){
      // Render <tts> as a paragraph with plain text and add a play button
      const p = document.createElement('p');
      p.textContent = f.html || '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tts-play secondary';
      btn.title = 'Lire le texte';
      btn.textContent = '🔊';
      btn.addEventListener('click', ()=>{
        try{
          if(!('speechSynthesis' in window)){ alert('TTS non supporté dans ce navigateur'); return }
          // If currently speaking, cancel (acts as stop)
          if(window.speechSynthesis.speaking){ window.speechSynthesis.cancel(); btn.textContent = '🔊'; return }
          const text = (f.html||'').trim();
          if(!text) return;
          const u = new SpeechSynthesisUtterance(text);
          // prefer English by default for TTS unless field specifies otherwise
          u.lang = 'en-US';
          // prefer default voice; user can modify in browser
          btn.textContent = '⏸';
          u.onend = ()=>{ try{ btn.textContent = '🔊' }catch(e){} };
          u.onerror = ()=>{ try{ btn.textContent = '🔊' }catch(e){} };
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
        }catch(e){ console.warn('TTS error', e); alert('Erreur TTS: '+(e && e.message || e)); }
      });
      wrapper.appendChild(p);
      wrapper.appendChild(btn);
    } else if(isPlainText){
      // Render explicit <text> fields as plain text (do not attempt KaTeX)
      const p = document.createElement('p'); p.textContent = f.html || ''; wrapper.appendChild(p);
    } else if(isTexType && !containsBlockTags){
      // Safe to render with KaTeX (no block HTML inside)
      const texSrc = (f.html||'').trim();
      const span = document.createElement('div');
      try{
        if(window.katex && typeof katex.render === 'function'){
          const display = /\\\\\[|\\\\\]|\$\$|\n/.test(texSrc) || texSrc.split(/\\n|\n/).length>1;
          katex.render(texSrc, span, {throwOnError:false, displayMode: display});
        } else { span.textContent = texSrc }
      }catch(e){ span.textContent = texSrc }
      wrapper.appendChild(span);
    } else {
      // Render as HTML (rich-text) — do NOT run KaTeX here
      wrapper.innerHTML = f.html || '';
    }
    return wrapper;
  }

  // === Function: renderKaTeX ===
  // Uses auto-render with throwOnError:false to avoid breaking on invalid TeX.
  function renderKaTeX(container){
    // No-op: we render only explicit <tex> fields using katex.render()
    return;
  }

  // === FSRS implementation (SM-2-like) ===
  function initFSRS(){
    // ensure per-card state exists
    for(const c of deck.cards){
      const key = storageKey('card:'+c.id);
      if(!localStorage.getItem(key)){
        const state = {reps:0,interval:0,ef:2.5,due: (new Date()).toISOString(), last: null};
        // FSRS fields for Maths deck (initialized lazily as well)
        state.stability = 1.5; // days
        state.difficulty = 7.5; // higher default difficulty for Maths
        localStorage.setItem(key, JSON.stringify(state));
      }
    }
    dueCards = getDueCards();
    // sessionTotal should equal number of due cards at session start
    sessionTotal = dueCards.length; reviewedCount = 0;
    const dueEl = $('#dueCount'); if(dueEl) dueEl.textContent = dueCards.length;
    currentIndex = 0;
    showNextCard();
    updateProgressDisplay();
    updateHistogram();
  }

  // --- FSRS profiles per subject ---
  const fsrsProfiles = {
    maths: {
      targetRetention: 0.92,
      initStability: 1.5,
      initDifficulty: 7.5,
      weights: {
        w0: 0.35, w1: 1.40, w2: 2.45, w3: 6.30, w4: 0.40,
        w5: 1.60, w6: 0.20, w7: 1.25, w8: 0.78, w9: 1.00,
        w10: 1.22, w11: 0.60, w12: 0.35, w13: 1.15, w14: 0.18,
        w15: 0.12, w16: 1.05, w17: 0.10
      }
    },
    physique: {
      targetRetention: 0.86,
      initStability: 1.4,
      initDifficulty: 6.3,
      weights: {
        w0: 0.32, w1: 1.20, w2: 2.60, w3: 6.80, w4: 0.38,
        w5: 1.40, w6: 0.18, w7: 1.22, w8: 0.82, w9: 1.00,
        w10: 1.25, w11: 0.75, w12: 0.30, w13: 1.12, w14: 0.17,
        w15: 0.11, w16: 1.08, w17: 0.10
      }
    },
    anglais: {
      targetRetention: 0.84,
      initStability: 1.2,
      initDifficulty: 5.5,
      weights: {
        w0: 0.28, w1: 1.05, w2: 2.90, w3: 7.30, w4: 0.36,
        w5: 1.20, w6: 0.16, w7: 1.20, w8: 0.74, w9: 1.00,
        w10: 1.32, w11: 0.85, w12: 0.25, w13: 1.10, w14: 0.16,
        w15: 0.10, w16: 1.05, w17: 0.10
      }
    },
    francais: {
      targetRetention: 0.85,
      initStability: 1.3,
      initDifficulty: 6.0,
      weights: {
        w0: 0.30, w1: 1.10, w2: 2.60, w3: 7.10, w4: 0.37,
        w5: 1.30, w6: 0.17, w7: 1.18, w8: 0.80, w9: 1.00,
        w10: 1.24, w11: 0.78, w12: 0.28, w13: 1.11, w14: 0.17,
        w15: 0.10, w16: 1.06, w17: 0.10
      }
    },
    si: {
      targetRetention: 0.89,
      initStability: 1.4,
      initDifficulty: 6.5,
      weights: {
        w0: 0.33, w1: 1.25, w2: 2.55, w3: 7.00, w4: 0.42,
        w5: 1.45, w6: 0.19, w7: 1.22, w8: 0.82, w9: 1.00,
        w10: 1.20, w11: 0.68, w12: 0.32, w13: 1.12, w14: 0.17,
        w15: 0.11, w16: 1.08, w17: 0.10
      }
    },
    info: {
      targetRetention: 0.85,
      initStability: 1.3,
      initDifficulty: 6.0,
      weights: {
        w0: 0.30, w1: 1.10, w2: 2.70, w3: 7.10, w4: 0.38,
        w5: 1.30, w6: 0.18, w7: 1.20, w8: 0.80, w9: 1.00,
        w10: 1.25, w11: 0.80, w12: 0.28, w13: 1.11, w14: 0.17,
        w15: 0.10, w16: 1.07, w17: 0.10
      }
    }
  };

  function detectFsrsProfile(){
    const title = (deck && deck.title ? deck.title : '').toLowerCase();
    const url = (deckURL || '').toLowerCase();

    // Extract first folder under /decks/ if present
    let folder = '';
    const m = url.match(/\/decks\/([^/]+)/);
    if(m && m[1]) folder = m[1].toLowerCase();

    // Primary detection: exact folder name under decks/
    if(folder === 'maths') return 'maths';
    if(folder === 'physique') return 'physique';
    if(folder === 'anglais') return 'anglais';
    if(folder === 'français' || folder === 'francais') return 'francais';
    if(folder === 'sciences industrielles' || folder === 'si') return 'si';
    if(folder === 'informatique' || folder === 'info') return 'info';

    // Fallback: title/URL substring detection
    if(title.includes('math') || url.includes('/maths/') || url.includes('maths')) return 'maths';
    if(title.includes('phys') || url.includes('/physique') || url.includes('physique')) return 'physique';
    if(title.includes('anglais') || title.includes('english') || url.includes('/anglais') || url.includes('english')) return 'anglais';
    if(title.includes('français') || title.includes('francais') || title.includes('french') || url.includes('/français') || url.includes('/francais')) return 'francais';
    if(title.includes('sciences industrielles') || title.includes('si ') || title.endsWith(' si') || url.includes('/sciences industrielles') || url.includes('/si/')) return 'si';
    if(title.includes('info') || title.includes('informatique') || title.includes('computer') || title.includes('algo') || url.includes('/informatique') || url.includes('/info/')) return 'info';
    return null;
  }

  function ensureFsrsState(st, profileKey){
    const prof = fsrsProfiles[profileKey] || fsrsProfiles.maths;
    if(st.stability == null || Number.isNaN(st.stability)) st.stability = prof.initStability;
    if(st.difficulty == null || Number.isNaN(st.difficulty)) st.difficulty = prof.initDifficulty;
  }

  function fsrsScheduleGeneric(st, quality, profileKey){
    const prof = fsrsProfiles[profileKey];
    if(!prof) return st;
    const weights = prof.weights;
    const targetRetention = prof.targetRetention || 0.9;
    const now = new Date();
    ensureFsrsState(st, profileKey);
    const response = quality <= 1 ? 0 : (quality === 3 ? 1 : (quality === 4 ? 2 : 3));
    const lastReview = st.last ? new Date(st.last) : null;
    const elapsedDays = lastReview ? Math.max(0.01, (now - lastReview) / (1000*60*60*24)) : 0;

    const retrievability = st.stability > 0 ? Math.exp(Math.log(targetRetention) * elapsedDays / st.stability) : targetRetention;

    const diffDelta = response === 0 ? 0.30 : response === 1 ? 0.05 : response === 2 ? -0.05 : -0.10;
    st.difficulty = Math.min(9.5, Math.max(1.5, st.difficulty + diffDelta * weights.w5));

    let newStability;
    if(response === 0){
      newStability = Math.max(1, st.stability * weights.w11);
    } else {
      const growth = weights.w2 * Math.exp(-weights.w4 * st.stability) * (1 - retrievability);
      const buttonMult = response === 1 ? weights.w8 : response === 2 ? weights.w9 : weights.w10;
      const base = 1 + growth;
      newStability = Math.max(1, st.stability * base * buttonMult * weights.w7);
    }

    const intervalDays = Math.max(1, Math.round(newStability));

    st.stability = newStability;
    st.interval = intervalDays;
    st.reps = (st.reps || 0) + 1;
    st.last = now.toISOString();
    st.due = addDays(startOfDay(now), intervalDays).toISOString();
    return st;
  }

  function getDueCards(){
    // use current time so cards scheduled for now are included
    const now = new Date();
    const nowList = [], newList = [];
    for(const c of deck.cards){
      const key = storageKey('card:'+c.id);
      const st = JSON.parse(localStorage.getItem(key) || '{}');
      const due = st && st.due ? new Date(st.due) : new Date();
      const isNew = (!st || (!st.last && (st.reps===0 || st.reps===undefined)));
      if(due <= now && !isNew){ nowList.push(c); }
      else if(isNew){ newList.push(c); }
    }
    // shuffle within each bucket
    const shuffle = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]] } };
    shuffle(nowList); shuffle(newList);
    // prioritize 'Maintenant' then 'Nouveau'
    return nowList.concat(newList);
  }

  // === Histogram helper ===
  function updateHistogram(){
    if(!deck || !deck.cards) return;
    const now = new Date();
    const counts = {new:0, now:0, h12:0, tomorrow:0, week:0, long:0};
    for(const c of deck.cards){
      const key = storageKey('card:'+c.id);
      const st = JSON.parse(localStorage.getItem(key) || '{}');
      if(!st || (!st.last && (st.reps===0 || st.reps===undefined))){ counts.new++; continue }
      const due = st && st.due ? new Date(st.due) : now;
      const hrs = (due - now) / (1000*60*60);
      if(due <= now) counts.now++;
      else if(hrs <= 12) counts.h12++;
      else if(hrs <= 24) counts.tomorrow++;
      else if(hrs <= 24*7) counts.week++;
      else counts.long++;
    }
    // compute max for scaling
    const max = Math.max(1, counts.new, counts.now, counts.h12, counts.tomorrow, counts.week, counts.long);
    // set fills heights and counts above bars
    const setCol = (fillId, countId, val) => {
      const fill = document.getElementById(fillId);
      const cnt = document.getElementById(countId);
      if(cnt) cnt.textContent = val;
      if(!fill) return;
      const pct = Math.round((val / max) * 100);
      if(window.innerWidth <= 640){
        // mobile: horizontal bars (width-based)
        fill.style.width = pct + '%';
        fill.style.height = '100%';
      } else {
        // desktop: vertical bars (height-based)
        fill.style.height = pct + '%';
        fill.style.width = '';
      }
      fill.title = val + ' cartes';
    };
    setCol('bar-new','count-new', counts.new);
    setCol('bar-now','count-now', counts.now);
    setCol('bar-12h','count-12h', counts.h12);
    setCol('bar-tomorrow','count-tomorrow', counts.tomorrow);
    setCol('bar-week','count-week', counts.week);
    setCol('bar-long','count-long', counts.long);
    // Also update session total display if it hasn't been set (fallback)
    const infoEl = document.getElementById('progressInfo');
    if(infoEl && sessionTotal === 0){ infoEl.textContent = `Révisées : ${reviewedCount} / ${sessionTotal}` }
  }
  
  // Update histogram for a specific deck (used in multi-deck mode)
  function updateHistogramForDeck(deckKey){
    const now = new Date();
    const counts = {new:0, now:0, h12:0, tomorrow:0, week:0, long:0};
    
    // Get all cards from localStorage for this deck
    const prefix = `fabanki:${deckKey}:card:`;
    for(const k of Object.keys(localStorage)){
      if(!k.startsWith(prefix)) continue;
      try{
        const st = JSON.parse(localStorage.getItem(k) || '{}');
        if(!st || (!st.last && (st.reps===0 || st.reps===undefined))){ counts.new++; continue }
        const due = st && st.due ? new Date(st.due) : now;
        const hrs = (due - now) / (1000*60*60);
        if(due <= now) counts.now++;
        else if(hrs <= 12) counts.h12++;
        else if(hrs <= 24) counts.tomorrow++;
        else if(hrs <= 24*7) counts.week++;
        else counts.long++;
      }catch(e){ continue }
    }
    
    // compute max for scaling
    const max = Math.max(1, counts.new, counts.now, counts.h12, counts.tomorrow, counts.week, counts.long);
    // set fills heights and counts above bars
    const setCol = (fillId, countId, val) => {
      const fill = document.getElementById(fillId);
      const cnt = document.getElementById(countId);
      if(cnt) cnt.textContent = val;
      if(!fill) return;
      const pct = Math.round((val / max) * 100);
      if(window.innerWidth <= 640){
        fill.style.width = pct + '%';
        fill.style.height = '100%';
      } else {
        fill.style.height = pct + '%';
        fill.style.width = '';
      }
      fill.title = val + ' cartes';
    };
    setCol('bar-new','count-new', counts.new);
    setCol('bar-now','count-now', counts.now);
    setCol('bar-12h','count-12h', counts.h12);
    setCol('bar-tomorrow','count-tomorrow', counts.tomorrow);
    setCol('bar-week','count-week', counts.week);
    setCol('bar-long','count-long', counts.long);
  }

  function updateProgressDisplay(){
    const infoEl = document.getElementById('progressInfo');
    const pb = document.getElementById('progressBar');
    const total = sessionTotal || 0;
    const done = reviewedCount || 0;
    if(infoEl) infoEl.textContent = `Révisées : ${done} / ${total}`;
    if(pb){ const pct = total>0? Math.round((done/total)*100): 0; pb.style.width = pct + '%'; }
  }

  function scheduleCard(cardId, quality){
    // quality: 0..5 following SM-2 mapping. We'll expect mapping from buttons.
    const key = storageKey('card:'+cardId);
    const st = JSON.parse(localStorage.getItem(key) || '{}');
    const today = startOfDay(new Date());

    // FSRS profiles per subject
    const profileKey = detectFsrsProfile();
    if(profileKey){
      const prevDue = st && st.due ? new Date(st.due) : null;
      fsrsScheduleGeneric(st, quality, profileKey);
      localStorage.setItem(key, JSON.stringify(st));
      const now = new Date();
      try{
        if(prevDue && prevDue > now && new Date(st.due) <= now){ sessionTotal = (sessionTotal||0) + 1; updateProgressDisplay(); }
      }catch(e){}
      if(!multiDeckMode){
        dueCards = getDueCards();
        const dueEl = $('#dueCount'); if(dueEl) dueEl.textContent = dueCards.length;
        updateHistogram();
      }
      return;
    }

    if(quality < 3){
      // Raté: reset and make due immediately
      st.reps = 0; st.interval = 0; // due now
    } else {
      // Conservative FSRS adjustments to better separate qualities:
      // - Hard (3): small bonus, penalize ef
      // - Good (4): normal behavior
      // - Easy (5): larger bonus and ensure first-success moves to >= tomorrow
      if(!st.reps) st.reps = 0;
      if(st.reps === 0){
        if(quality === 5) st.interval = 2; // Easy: at least 2 days on first success
        else if(quality === 4) st.interval = 1; // Good: tomorrow
        else st.interval = 1; // Hard: tomorrow but conservative
      } else if(st.reps === 1){
        if(quality === 5) st.interval = 8; // reward Easy with larger second interval
        else if(quality === 4) st.interval = 6; // standard
        else st.interval = 3; // Hard: limited bonus
      } else {
        const baseMult = (st.ef || 2.5);
        let mult = baseMult;
        if(quality === 3) mult = Math.max(1.1, baseMult * 0.8); // Hard -> conservative growth
        else if(quality === 4) mult = Math.max(1.15, baseMult * 0.95);
        else if(quality === 5) mult = baseMult * 1.2; // Easy -> larger growth
        st.interval = Math.max(1, Math.round(st.interval * mult));
      }
      st.reps = (st.reps || 0) + 1;
      // update ef but apply stronger penalties/bonuses depending on quality
      st.ef = (st.ef || 2.5) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if(quality === 3) st.ef = (st.ef || 2.5) - 0.15; // penalize for Hard
      if(quality === 5) st.ef = (st.ef || 2.5) + 0.12; // boost for Easy
      if(st.ef < 1.3) st.ef = 1.3;
    }
    // set due
    let next;
    const prevDue = st && st.due ? new Date(st.due) : null;
    const now = new Date();
    if((st.interval || 0) === 0){
      next = new Date(); // immediate
    } else {
      next = addDays(today, st.interval || 1);
    }
    st.due = next.toISOString();
    st.last = (new Date()).toISOString();
    localStorage.setItem(key, JSON.stringify(st));
    // If this card moved from future to 'now' during the session, include it in session total
    try{
      if(prevDue && prevDue > now && next <= now){ sessionTotal = (sessionTotal||0) + 1; updateProgressDisplay(); }
    }catch(e){}
    // update due list and UI - but NOT in multi-deck mode (we manage dueCards directly)
    if(!multiDeckMode){
      dueCards = getDueCards();
      const dueEl = $('#dueCount'); if(dueEl) dueEl.textContent = dueCards.length;
      updateHistogram();
    }
  }

  // random integer helper
  function randInt(min, max){ return Math.floor(Math.random()*(max-min+1)) + min }

  // === Helpers ===
  // updateStatus: set status text and ensure on mobile the status appears above the hint box
    function updateStatus(t){
    try{
      const s = document.getElementById('status'); if(!s) return; s.textContent = t;
      const hint = document.getElementById('histHint');
      // Show status and hint in normal document flow above the main card (mobile and desktop).
      // Avoid using fixed positioning which overlays the card content.
      if(s){ s.style.position = ''; s.style.top = ''; s.style.left = ''; s.style.right = ''; s.style.zIndex = ''; s.style.background = ''; s.style.padding = t ? '8px' : ''; s.style.borderRadius = t ? '6px' : ''; s.style.boxShadow = t ? '0 6px 18px rgba(0,0,0,0.04)' : ''; s.style.display = t ? 'block' : ''; }
      if(hint){ hint.style.position = ''; hint.style.top = ''; hint.style.left = ''; hint.style.right = ''; hint.style.zIndex = ''; hint.style.display = t ? 'block' : ''; }
    }catch(e){ try{ $('#status').textContent = t }catch(e){} }
  }
  function renderEmpty(){
    const front = $('#front'); if(front) front.innerHTML='';
    const back = $('#back'); if(back) back.innerHTML='';
    const resp = $('#respButtons'); if(resp) resp.style.display='none';
    const sa = $('#showAnswer'); if(sa) sa.style.display='none';
  }
  function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x }

  // sha1 small implementation (for id generation). Use subtle crypto if available.
  function sha1(msg){
    try{
      const enc = new TextEncoder();
      const data = enc.encode(msg);
      return crypto.subtle.digest('SHA-1', data)
        .then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''))
        .catch(() => fallbackSha1(msg));
    }catch(e){
      return fallbackSha1(msg);
    }
  }

  function fallbackSha1(s){
    // crude fallback hash for environments without crypto.subtle
    let h = 0;
    for(let i=0;i<s.length;i++){
      h = ((h<<5)-h) + s.charCodeAt(i);
      h |= 0;
    }
    return (h>>>0).toString(16);
  }

  // Because crypto.subtle returns a Promise, wrap sha1 usage accordingly in parseXMLDeck id creation.
  // For simplicity where sha1 is used synchronously above, ensure fallback string is returned; this is acceptable for IDs.

  // === UI flow ===
  function showNextCard(){
    // Show contextual onboarding on first card
    if(!window.__reviewOnboardingShown && typeof showReviewOnboarding === 'function'){
      window.__reviewOnboardingShown = true;
      setTimeout(() => {
        showReviewOnboarding();
      }, 300);
    }
    
    if(!dueCards || dueCards.length===0){ updateStatus('Aucune carte à réviser aujourd\'hui'); renderEmpty(); return }
    if(currentIndex >= dueCards.length) currentIndex = 0;
    const c = multiDeckMode ? dueCards[currentIndex].card : dueCards[currentIndex];
    const cardData = multiDeckMode ? dueCards[currentIndex] : null;
    const sa = $('#showAnswer'); if(sa) sa.style.display = 'inline-block';
    const resp = $('#respButtons'); if(resp) resp.style.display = 'none';
    const backEl = $('#back'); if(backEl) backEl.style.display = 'none';
    
    // Display deck name if in multi-deck mode
    if(multiDeckMode && cardData){
      const deckTitle = document.getElementById('multiDeckTitle');
      if(deckTitle){
        deckTitle.textContent = cardData.deckName;
        deckTitle.style.display = 'block';
      }
    } else {
      const deckTitle = document.getElementById('multiDeckTitle');
      if(deckTitle) deckTitle.style.display = 'none';
    }

    
    renderFront(c);
    // update card status box (Nouveau / Maintenant)
    try{ renderCardStatus(c); }catch(e){}
    // record when this card was shown to compute XP based on time spent
    try{ cardShownAt = Date.now(); }catch(e){}
    // Ensure front is visible (might have been hidden after showing an answer)
    const frontEl = $('#front'); if(frontEl){ frontEl.style.display = 'flex'; frontEl.style.flex = '1 1 auto'; }
    // do not show per-card index (user requested removal)
    // progress
    const pct = Math.round(((currentIndex)/Math.max(1,dueCards.length))*100);
    const pb = $('#progressBar'); if(pb) pb.style.width = pct + '%';
    
    // Update histogram for current deck if in multi-deck mode
    if(multiDeckMode && cardData){
      updateHistogramForDeck(cardData.deckKey);
    }
  }

  // Render or update the small persistent card status box
  function renderCardStatus(card){
    try{
      if(!card) return;
      const cardArea = document.getElementById('cardArea'); if(!cardArea) return;
      let stEl = document.getElementById('cardStatus');
      if(!stEl){ stEl = document.createElement('div'); stEl.id = 'cardStatus'; stEl.className = 'card-status'; cardArea.appendChild(stEl); cardArea.style.position = cardArea.style.position || 'relative'; }
      const key = storageKey('card:'+card.id);
      const st = JSON.parse(localStorage.getItem(key) || '{}');
      const now = new Date();
      let txt = '';
      let cls = 'status-upcoming';
      const isNew = (!st || (!st.last && (st.reps===0 || st.reps===undefined)));
      if(onlyNowMode){
        txt = 'Maintenant'; cls = 'status-now';
      } else if(isNew){ txt = 'Nouveau'; cls = 'status-new'; }
      else {
        const due = st && st.due ? new Date(st.due) : now;
        const hrs = (due - now) / (1000*60*60);
        if(due <= now){ txt = 'Maintenant'; cls = 'status-now'; }
        else if(hrs <= 12){ txt = '<12h'; cls = 'status-12h'; }
        else if(hrs <= 24){ txt = 'Demain'; cls = 'status-tomorrow'; }
        else if(hrs <= 24*7){ txt = '<1 sem'; cls = 'status-week'; }
        else { txt = 'Longtemps'; cls = 'status-long'; }
      }
      stEl.textContent = txt; stEl.className = 'card-status ' + cls;
    }catch(e){ console.warn('renderCardStatus', e) }
  }

  // Button handlers
    $('#showAnswer').addEventListener('click', ()=>{
    const c = multiDeckMode ? dueCards[currentIndex].card : dueCards[currentIndex];
    try{
      renderBack(c);
      const frontEl = $('#front');
      const backEl = $('#back');
      const respBtn = $('#respButtons');
      const showBtn = $('#showAnswer');
      if(window.innerWidth <= 640){
        // mobile: replace front with back (full-screen centered)
        if(frontEl){ frontEl.style.display = 'none'; frontEl.style.flex = '0 0 auto'; }
        if(backEl){ backEl.style.display = 'flex'; backEl.style.flex = '1 1 auto'; }
      } else {
        // desktop: show answer under the question, center both
        if(frontEl){ frontEl.style.display = 'block'; frontEl.style.flex = '0 0 auto'; }
        if(backEl){ backEl.style.display = 'block'; backEl.style.flex = '0 0 auto'; }
        // ensure text inside both is centered
        try{ frontEl.querySelectorAll('.field').forEach(n=>n.style.textAlign='center'); }catch(e){}
        try{ backEl.querySelectorAll('.field').forEach(n=>n.style.textAlign='center'); }catch(e){}
      }
      if(respBtn) respBtn.style.display = 'flex';
      if(showBtn) showBtn.style.display = 'none';
    }catch(e){ console.warn('showAnswer error', e); }
  });

  $('#again').addEventListener('click', ()=>{ answerCurrent(0) });
  $('#hard').addEventListener('click', ()=>{ answerCurrent(3) });
  $('#good').addEventListener('click', ()=>{ answerCurrent(4) });
  $('#easy').addEventListener('click', ()=>{ answerCurrent(5) });
  // Pass current card: mark as 'Never' (far future) and remove from session
  $('#passer').addEventListener('click', ()=>{ passCurrent() });

  function passCurrent(){
    try{
      const cardData = multiDeckMode ? dueCards[currentIndex] : null;
      const c = cardData ? cardData.card : dueCards[currentIndex];
      if(!c) return;
      
      const origStorageKey = storageKey; // save original
      
      // If in multi-deck mode, temporarily override storageKey
      if(multiDeckMode && cardData){
        const deckKeyLocal = cardData.deckKey;
        storageKey = (s) => `fabanki:${deckKeyLocal}:${s}`;
      }
      
      // mark card as never due again by setting a far-future date
      const key = storageKey('card:'+c.id);
      const st = JSON.parse(localStorage.getItem(key) || '{}');
      st.never = true;
      st.due = new Date(9999,11,31,23,59,59).toISOString();
      st.last = (new Date()).toISOString();
      localStorage.setItem(key, JSON.stringify(st));
      // count this as reviewed for session
      reviewedCount = (reviewedCount || 0) + 1; updateProgressDisplay();
      try{ incLocal('fabanki:pass_total', 1); resetWeeklyIfNeeded(); resetMonthlyIfNeeded(); const delta = -6; const cur = Number(localStorage.getItem('fabanki:score_mpsi_semaine')||0)+delta; localStorage.setItem('fabanki:score_mpsi_semaine', String(cur)); const curM = Number(localStorage.getItem('fabanki:score_mpsi_mois')||0)+delta; localStorage.setItem('fabanki:score_mpsi_mois', String(curM)); }catch(e){}
      try{ incLocal('fabanki:cards_since_streak_reset',1); }catch(e){}
      try{ localStorage.setItem('fabanki:consec_correct','0'); localStorage.setItem('fabanki:consec_difficult','0'); localStorage.setItem('fabanki:consec_no_pass','0'); }catch(e){}
      try{ const deltaToday = -6; const curD = Number(localStorage.getItem('fabanki:score_mpsi_today')||0) + deltaToday; localStorage.setItem('fabanki:score_mpsi_today', String(curD)); }catch(e){}
      // remove from due list and show next
      dueCards.splice(currentIndex, 1);
      if(currentIndex >= dueCards.length){ updateStatus('Révision terminée pour aujourd\'hui'); renderEmpty(); }
      else { showNextCard(); }
      const dueEl2 = $('#dueCount'); if(dueEl2) dueEl2.textContent = dueCards.length;
      // In multi-deck mode, update histogram for current deck after moving to next card
      if(multiDeckMode && dueCards.length > 0){
        const nextCardData = dueCards[currentIndex];
        if(nextCardData) updateHistogramForDeck(nextCardData.deckKey);
      } else {
        updateHistogram();
      }
      try{ if(typeof updateProfilePopupIfOpen === 'function') updateProfilePopupIfOpen(); }catch(e){}
      try{ if(typeof syncClassement === 'function') syncClassement(); }catch(e){}
      try{
        // apply penalty XP for pass action
        const section = (typeof window.getDeckSection === 'function') ? window.getDeckSection() : '';
        const pen = (typeof window.computePenaltyForSection === 'function') ? window.computePenaltyForSection(section) : (section? -2 : -2);
        const applied = (typeof window.applyXp === 'function') ? window.applyXp(pen) : 0;
        if(applied) { try{ window.showXpToast(applied); }catch(e){} }
        if(typeof updateProfilePopupIfOpen === 'function') updateProfilePopupIfOpen();
      }catch(e){}
      
      // Restore original storageKey if it was overridden for multi-deck
      if(multiDeckMode && cardData){
        storageKey = origStorageKey;
      }
    }catch(e){ console.warn('pass error', e); }
  }

  function answerCurrent(q){
    const cardData = multiDeckMode ? dueCards[currentIndex] : null;
    const c = cardData ? cardData.card : dueCards[currentIndex];
    const origStorageKey = storageKey; // save original
    
    // If in multi-deck mode, temporarily override storageKey
    if(multiDeckMode && cardData){
      const deckKey = cardData.deckKey;
      storageKey = (s) => `fabanki:${deckKey}:${s}`;
    }
    
    // count this attempt for session progress
    reviewedCount = (reviewedCount || 0) + 1;
    updateProgressDisplay();
    // capture previous review time (hours since last review) to compute XP multiplier
    let prevReviewHours = null;
    try{
      const keyPrev = storageKey('card:'+c.id);
      const stPrev = JSON.parse(localStorage.getItem(keyPrev) || '{}');
      if(stPrev && stPrev.last){ const lastD = new Date(stPrev.last); prevReviewHours = (new Date() - lastD) / (1000*60*60); }
      else if(stPrev && stPrev.due){ const pd = new Date(stPrev.due); prevReviewHours = (new Date() - pd) / (1000*60*60); }
    }catch(e){}
    scheduleCard(c.id, q);
    // update local counters for ranking
    // Robustly update local counters and titles metrics
    try{
      const keyPrev = storageKey('card:'+c.id);
      const stNow = JSON.parse(localStorage.getItem(keyPrev) || '{}');
      // mastered detection: became mastered if reps crossed threshold (>=3)
      try{
        const prevReps = (typeof stPrev !== 'undefined' && stPrev && stPrev.reps) ? Number(stPrev.reps) : 0;
        const nowReps = (stNow && stNow.reps) ? Number(stNow.reps) : 0;
        if(prevReps < 3 && nowReps >= 3){ incLocal('fabanki:mastered_total',1); }
      }catch(e){}

      try{ incLocal('fabanki:cards_since_streak_reset',1); }catch(e){}

      // compute time spent on card for Hadamard (long answers)
      let timeSec = 0;
      try{ timeSec = Math.max(0, (Date.now() - (cardShownAt||Date.now())) / 1000); }catch(e){}
      
            // Accumulate time spent for mission tracking
            try{
              const currentTimeToday = Number(localStorage.getItem('fabanki:time_spent_today') || 0);
              const currentTimeWeek = Number(localStorage.getItem('fabanki:time_spent_week') || 0);
              localStorage.setItem('fabanki:time_spent_today', String(currentTimeToday + Math.floor(timeSec / 60))); // Store in minutes
              localStorage.setItem('fabanki:time_spent_week', String(currentTimeWeek + Math.floor(timeSec / 60)));
            }catch(e){ console.warn('time accumulation error:', e) }
      
      try{ if(timeSec > 20) incLocal('fabanki:long_answer_total', 1); }catch(e){}

      // quality handling
      if(q < 3){
        incLocal('fabanki:fail_total',1);
        try{ localStorage.setItem('fabanki:consec_difficult','0'); }catch(e){}
        try{ localStorage.setItem('fabanki:consec_correct','0'); }catch(e){}
        try{ resetWeeklyIfNeeded(); resetMonthlyIfNeeded(); const delta = -4; localStorage.setItem('fabanki:score_mpsi_semaine', String(Number(localStorage.getItem('fabanki:score_mpsi_semaine')||0)+delta)); localStorage.setItem('fabanki:score_mpsi_today', String(Number(localStorage.getItem('fabanki:score_mpsi_today')||0)+delta)); localStorage.setItem('fabanki:score_mpsi_mois', String(Number(localStorage.getItem('fabanki:score_mpsi_mois')||0)+delta)); }catch(e){}
      } else if(q === 3){
        incLocal('fabanki:difficult_total',1);
        try{ const cd = incLocal('fabanki:consec_difficult',1); if(cd >= 100) localStorage.setItem('fabanki:objective_Feynman','1'); }catch(e){}
        try{ incLocal('fabanki:consec_correct',1); const consec = Number(localStorage.getItem('fabanki:consec_correct')||0); const maxi = Math.max(Number(localStorage.getItem('fabanki:consec_correct_max')||0), consec); localStorage.setItem('fabanki:consec_correct_max', String(maxi)); }catch(e){}
        try{ resetWeeklyIfNeeded(); resetMonthlyIfNeeded(); const delta = 1; localStorage.setItem('fabanki:score_mpsi_semaine', String(Number(localStorage.getItem('fabanki:score_mpsi_semaine')||0)+delta)); localStorage.setItem('fabanki:score_mpsi_today', String(Number(localStorage.getItem('fabanki:score_mpsi_today')||0)+delta)); localStorage.setItem('fabanki:score_mpsi_mois', String(Number(localStorage.getItem('fabanki:score_mpsi_mois')||0)+delta)); }catch(e){}
      } else if(q === 4){
        incLocal('fabanki:good_total',1);
        try{ localStorage.setItem('fabanki:consec_difficult','0'); }catch(e){}
        try{ incLocal('fabanki:consec_correct',1); const consec = Number(localStorage.getItem('fabanki:consec_correct')||0); const maxi = Math.max(Number(localStorage.getItem('fabanki:consec_correct_max')||0), consec); localStorage.setItem('fabanki:consec_correct_max', String(maxi)); }catch(e){}
        try{ resetWeeklyIfNeeded(); resetMonthlyIfNeeded(); const delta = 2; localStorage.setItem('fabanki:score_mpsi_semaine', String(Number(localStorage.getItem('fabanki:score_mpsi_semaine')||0)+delta)); localStorage.setItem('fabanki:score_mpsi_today', String(Number(localStorage.getItem('fabanki:score_mpsi_today')||0)+delta)); localStorage.setItem('fabanki:score_mpsi_mois', String(Number(localStorage.getItem('fabanki:score_mpsi_mois')||0)+delta)); }catch(e){}
      } else if(q === 5){
        incLocal('fabanki:good_total',1);
        try{ localStorage.setItem('fabanki:consec_difficult','0'); }catch(e){}
        try{ incLocal('fabanki:consec_correct',1); const consec = Number(localStorage.getItem('fabanki:consec_correct')||0); const maxi = Math.max(Number(localStorage.getItem('fabanki:consec_correct_max')||0), consec); localStorage.setItem('fabanki:consec_correct_max', String(maxi)); }catch(e){}
        try{ resetWeeklyIfNeeded(); resetMonthlyIfNeeded(); const delta = 3; localStorage.setItem('fabanki:score_mpsi_semaine', String(Number(localStorage.getItem('fabanki:score_mpsi_semaine')||0)+delta)); localStorage.setItem('fabanki:score_mpsi_today', String(Number(localStorage.getItem('fabanki:score_mpsi_today')||0)+delta)); localStorage.setItem('fabanki:score_mpsi_mois', String(Number(localStorage.getItem('fabanki:score_mpsi_mois')||0)+delta)); }catch(e){}
      }
    }catch(e){ console.warn('answerCurrent counters', e) }
    // Anki-like behaviour: on Fail (q<3) reinsert this card later in the session
    if(q < 3){
      // remove current card from list
      dueCards.splice(currentIndex, 1);
      // insert it after a random offset (5..20)
      const offset = randInt(5,20);
      const insertPos = Math.min(dueCards.length, currentIndex + offset);
      // In multi-deck mode, reinsert the full cardData object; otherwise just the card
      const cardToReinsert = multiDeckMode ? cardData : c;
      dueCards.splice(insertPos, 0, cardToReinsert);
      // don't advance index: currentIndex now points to the next card
      if(dueCards.length === 0){ updateStatus('Révision terminée pour aujourd\'hui'); renderEmpty(); }
      else { showNextCard(); }
    } else {
      // remove answered card; next card naturally shifts into currentIndex
      dueCards.splice(currentIndex, 1);
      if(currentIndex >= dueCards.length){ updateStatus('Révision terminée pour aujourd\'hui'); renderEmpty(); }
      else { showNextCard(); }
    }
    const dueEl2 = $('#dueCount'); if(dueEl2) dueEl2.textContent = dueCards.length;
    updateProgressDisplay();
    try{
      // compute XP for this successful review (only for qualities 3/4/5)
      if([3,4,5].includes(q)){
        try{
          const timeSec = Math.max(0, (Date.now() - (cardShownAt||Date.now())) / 1000);
          
                    // Accumulate time spent for mission tracking (also here for quality 3/4/5)
                    try{
                      const currentTimeToday = Number(localStorage.getItem('fabanki:time_spent_today') || 0);
                      const currentTimeWeek = Number(localStorage.getItem('fabanki:time_spent_week') || 0);
                      localStorage.setItem('fabanki:time_spent_today', String(currentTimeToday + Math.floor(timeSec / 60))); // Store in minutes
                      localStorage.setItem('fabanki:time_spent_week', String(currentTimeWeek + Math.floor(timeSec / 60)));
                    }catch(e){}
          
          // track long answers (>20s) for Hadamard titre
          try{ if(timeSec > 20) incLocal('fabanki:long_answer_total', 1); }catch(e){}
          const section = (typeof window.getDeckSection === 'function') ? window.getDeckSection() : '';
          const xp = (typeof window.computeXpForQuality === 'function') ? window.computeXpForQuality(section, q, timeSec, prevReviewHours) : 0;
          const applied = (typeof window.applyXp === 'function') ? window.applyXp(xp) : 0;
          if(applied) { try{ window.showXpToast(applied); }catch(e){} }
        }catch(e){ console.warn('xp calc', e); }
      }
      if(typeof updateProfilePopupIfOpen === 'function') updateProfilePopupIfOpen();
      try{ if(typeof syncClassement === 'function') syncClassement(); }catch(e){}
    }catch(e){}
    // Restore original storageKey if it was overridden for multi-deck
    if(multiDeckMode && cardData){
      storageKey = origStorageKey;
    }
  }

  // Load deck from URL param on start
  function param(key){ const p = new URLSearchParams(location.search); return p.get(key) }
  window.addEventListener('load', async ()=>{
  // Set CSS variable for iOS viewport fix
  function updateVh(){
    try{
      const vh = window.visualViewport?.height ? (window.visualViewport.height / 100) : (window.innerHeight / 100);
      document.documentElement.style.setProperty('--vh', vh + 'px');
    }catch(e){ try{ document.documentElement.style.setProperty('--vh', (window.innerHeight / 100) + 'px'); }catch(e2){} }
  }
  updateVh();
  window.addEventListener('resize', updateVh);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', updateVh);
  
  // wire UI
  try{ ensurePseudo(); resetWeeklyIfNeeded(); resetDailyIfNeeded(); }catch(e){}
    // Load button now opens file picker to add a local deck
    const loadBtn = $('#loadBtn');
    if(loadBtn){
      loadBtn.addEventListener('click', ()=>{
        const picker = document.getElementById('filePicker');
        if(picker) { picker.value = ''; picker.click(); updateStatus('Sélectionnez un fichier XML à charger...') }
      });
    }

    // Hidden file picker: read local XML and parse
    const filePicker = document.getElementById('filePicker');
    if(filePicker){
      filePicker.addEventListener('change', (ev)=>{
        const f = ev.target.files && ev.target.files[0];
        if(!f) return;
        const reader = new FileReader();
        reader.onload = (e)=>{
          try{
            const text = e.target.result;
            const parser = new DOMParser();
            let xml = parser.parseFromString(text,'application/xml');
            let parsererror = xml.querySelector('parsererror');
            if(parsererror){
              // Try lenient HTML parse as fallback for malformed XML (unescaped '<' in TeX)
              updateStatus('XML invalide — utilisation d\u00e9codage permissif pour le fichier local');
              xml = parser.parseFromString(text,'text/html');
              parsererror = null;
            }
            parseXMLDeck(xml, f.name);
            initFSRS();
            updateStatus('Deck chargé depuis fichier local');
            // set deckURL for consistency but do not try to write to ./decks/
            deckURL = './decks/'+f.name;
            history.replaceState(null,'', '?deck='+encodeURIComponent(f.name));
          }catch(err){ console.error(err); updateStatus('Erreur lecture du fichier local'); }
        };
        reader.readAsText(f);
      });
    }
    $('#resetBtn').addEventListener('click', ()=>{ if(confirm('Supprimer toutes les données locales pour ce deck ?')){ // clear keys for this deck
      if(!deckKey) { alert('Aucun deck chargé'); return }
      const prefix = `fabanki:${deckKey}:`;
      for(const k of Object.keys(localStorage)) if(k.startsWith(prefix)) localStorage.removeItem(k);
      alert('Données locales supprimées'); initFSRS(); }});
    
    // Toggle hint box visibility
    const toggleHintBtn = $('#toggleHint');
    if(toggleHintBtn){
      toggleHintBtn.addEventListener('click', ()=>{
        showHintBox = !showHintBox;
        const hint = document.getElementById('histHint');
        if(hint) {
          hint.style.display = showHintBox ? 'block' : 'none';
        }
        const label = showHintBox ? 'Info' : 'Info (masquée)';
        toggleHintBtn.setAttribute('data-label-text', label);
        try{ if(typeof updateTopBarLabels === 'function') updateTopBarLabels(); }catch(e){}
      });
    }
    
    const toggleBtn = $('#toggleTheme');
    if(toggleBtn){
      // ensure document root inherits initial theme
      document.documentElement.setAttribute('data-theme', document.getElementById('app')?.getAttribute('data-theme') || 'light');
        toggleBtn.addEventListener('click', ()=>{
        const appEl = document.getElementById('app');
        if(!appEl) return;
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const t = current === 'light' ? 'dark' : 'light';
        // set on root so CSS variables apply globally, and on app for scoped selectors
        document.documentElement.setAttribute('data-theme', t);
        appEl.setAttribute('data-theme', t);
        localStorage.setItem('fabanki:theme', t);
        const themeLabel = t==='dark' ? 'Mode clair' : 'Mode sombre';
        toggleBtn.setAttribute('data-label-text', themeLabel);
        
        // Auto-switch color to matching theme variant
        const currentColorName = localStorage.getItem('fabanki:current_color_name');
        if (currentColorName) {
          const colors = [
            { name: 'Clair (défaut)', light: '#f6f7fb', dark: '#0f1115', level: 0 },
            { name: 'Bleu', light: '#e8f4f8', dark: '#0a1a2e', level: 5 },
            { name: 'Vert', light: '#e8f5e9', dark: '#0d2818', level: 5 },
            { name: 'Rose', light: '#fce4ec', dark: '#2a0e1f', level: 10 },
            { name: 'Jaune', light: '#fffde7', dark: '#332d00', level: 10 },
            { name: 'Pourpre', light: '#f3e5f5', dark: '#25071a', level: 15 },
            { name: 'Cyan', light: '#e0f7fa', dark: '#0d1b1f', level: 20 },
            { name: 'Orange', light: '#ffe0b2', dark: '#2d1b0a', level: 20 },
            { name: 'Menthe', light: '#e0f2f1', dark: '#0d1816', level: 25 },
            { name: 'Corail', light: '#ffebee', dark: '#2d0a0a', level: 25 },
            { name: 'Lavande', light: '#f3e5f5', dark: '#2a0e3a', level: 30 },
            { name: 'Pêche', light: '#ffd7a8', dark: '#3a1f0a', level: 30 },
            { name: 'Turquoise', light: '#b2dfdb', dark: '#0d3a35', level: 35 },
            { name: 'Gradient Doré', light: 'linear-gradient(135deg, #ffecb3 0%, #ffcc80 100%)', dark: 'linear-gradient(135deg, #3d2d00 0%, #4d2600 100%)', level: 35 },
            { name: 'Gradient Rose-Vert', light: 'linear-gradient(135deg, #f8bbd0 0%, #a5d6a7 100%)', dark: 'linear-gradient(135deg, #4a0e2a 0%, #1d3a1f 100%)', level: 40 },
            { name: 'Gradient Prisma', light: 'linear-gradient(135deg, #e8f4f8 0%, #fce4ec 50%, #f3e5f5 100%)', dark: 'linear-gradient(135deg, #0a1a2e 0%, #2a0e1f 50%, #25071a 100%)', level: 45 },
            { name: 'Gradient Bleu Royal', light: 'linear-gradient(135deg, #64b5f6 0%, #e3f2fd 100%)', dark: 'linear-gradient(135deg, #0a2558 0%, #1a2a3a 100%)', level: 45 },
            { name: 'Gradient Aurora', light: 'linear-gradient(135deg, #e0f2f1 0%, #fffde7 50%, #ffebee 100%)', dark: 'linear-gradient(135deg, #0d1816 0%, #332d00 50%, #2d0a0a 100%)', level: 48 },
            { name: 'Gradient Océan', light: 'linear-gradient(135deg, #e0f7fa 0%, #e3f2fd 100%)', dark: 'linear-gradient(135deg, #0d1b1f 0%, #1a2a3a 100%)', level: 50 },
            { name: 'Gradient Forêt', light: 'linear-gradient(135deg, #e8f5e9 0%, #e0f2f1 100%)', dark: 'linear-gradient(135deg, #1b2d1f 0%, #0d1816 100%)', level: 50 }
          ];
          const color = colors.find(c => c.name === currentColorName);
          if (color) {
            const newColorValue = t === 'dark' ? color.dark : color.light;
            localStorage.setItem('fabanki:bg_color', newColorValue);
          }
        }
        
        // Auto-switch card color to matching theme variant
        const currentCardColorName = localStorage.getItem('fabanki:current_card_color_name');
        if (currentCardColorName) {
          const cardColors = [
            { name: 'Défaut', id: 'default', light: '#fff', dark: '#111319', level: 0 },
            { name: 'Bleu clair', id: 'lightblue', light: '#e3f2fd', dark: '#1a2a3a', level: 5 },
            { name: 'Vert clair', id: 'lightgreen', light: '#e8f5e9', dark: '#1b2d1f', level: 10 },
            { name: 'Rose clair', id: 'lightpink', light: '#fce4ec', dark: '#3a1f2e', level: 15 },
            { name: 'Amber', id: 'amber', light: '#fff8e1', dark: '#3a3000', level: 20 },
            { name: 'Indigo', id: 'indigo', light: '#e8eaf6', dark: '#1a1535', level: 25 },
            { name: 'Cyan', id: 'cyan', light: '#e0f7fa', dark: '#0d1b1f', level: 28 },
            { name: 'Orange pâle', id: 'pale_orange', light: '#ffe0b2', dark: '#2d1b0a', level: 22 },
            { name: 'Menthe', id: 'mint', light: '#e0f2f1', dark: '#0d1816', level: 30 },
            { name: 'Lavande', id: 'lavender', light: '#f3e5f5', dark: '#2a0e3a', level: 32 },
            { name: 'Pêche', id: 'peach', light: '#ffd7a8', dark: '#3a1f0a', level: 35 },
            { name: 'Ciel', id: 'sky', light: '#b3e5fc', dark: '#0a3a4a', level: 38 },
            { name: 'Turquoise', id: 'turquoise', light: '#b2dfdb', dark: '#0d3a35', level: 40 },
            { name: 'Or pâle', id: 'gold', light: '#ffecb3', dark: '#3d2d00', level: 42 },
            { name: 'Vert sapin', id: 'fir', light: '#a5d6a7', dark: '#1d3a1f', level: 45 },
            { name: 'Rose vif', id: 'hotpink', light: '#f8bbd0', dark: '#4a0e2a', level: 45 },
            { name: 'Bleu royal', id: 'royal', light: '#64b5f6', dark: '#0a2558', level: 48 },
            { name: 'Sunrise', id: 'sunrise', light: '#ffcc80', dark: '#4d2600', level: 50 },
            { name: 'Gradient Océan', id: 'gradient_ocean', light: 'linear-gradient(135deg, #e0f7fa 0%, #e3f2fd 100%)', dark: 'linear-gradient(135deg, #0d1b1f 0%, #1a2a3a 100%)', level: 55 },
            { name: 'Gradient Forêt', id: 'gradient_forest', light: 'linear-gradient(135deg, #e8f5e9 0%, #e0f2f1 100%)', dark: 'linear-gradient(135deg, #1b2d1f 0%, #0d1816 100%)', level: 55 }
          ];
          const cardColor = cardColors.find(c => c.name === currentCardColorName);
          if (cardColor) {
            const newCardColorValue = t === 'dark' ? cardColor.dark : cardColor.light;
            localStorage.setItem('fabanki:card_color', newCardColorValue);
          }
        }
        
        // Update card color when theme changes to ensure gradient colors adapt
        try{ if(typeof applyCustomization === 'function') applyCustomization(); }catch(e){}
        try{ if(typeof updateTopBarLabels === 'function') updateTopBarLabels(); }catch(e){}
      });

    }

    // Update app title for mobile vs desktop (mobile shows short title)
    function updateAppTitle(){
      try{
        const el = document.getElementById('appTitle'); if(!el) return;
        if(window.innerWidth <= 640) el.textContent = "Fab'Anki";
        else el.textContent = "Fab'Anki — Flashcards";
      }catch(e){}  
    }
    updateAppTitle();
    window.addEventListener('resize', updateAppTitle);
    // Ensure status/hint positions update on resize
    window.addEventListener('resize', ()=>{ try{ updateStatus(document.getElementById('status')?.textContent || '') }catch(e){} });

    // Move grading buttons into main card area so they appear with the card
    try{
      const resp = document.getElementById('respButtons');
      const mainButtons = document.querySelector('#cardArea .buttons');
      if(resp && mainButtons){
        mainButtons.appendChild(resp);
        resp.style.display = 'none';
        resp.style.marginTop = '8px';
      }
    }catch(e){ /* ignore */ }

    // Swipe gestures: disabled by default. Set `swipeEnabled = true` to re-enable.
    try{
      const swipeEnabled = false;
      let touchStartY = 0, touchStartX = 0, touching = false;
      const cardArea = document.getElementById('cardArea');
      const statsSection = document.getElementById('stats');
      if(swipeEnabled && cardArea && statsSection){
        cardArea.addEventListener('touchstart', (ev)=>{ if(window.innerWidth<=640){ const t = ev.touches[0]; touchStartY = t.clientY; touchStartX = t.clientX; touching = true } });
        cardArea.addEventListener('touchmove', (ev)=>{ if(!touching) return; const t = ev.touches[0]; const dy = t.clientY - touchStartY; const dx = t.clientX - touchStartX; if(dy > 80 && Math.abs(dy) > Math.abs(dx)){ statsSection.classList.add('visible'); touching = false } });
        // allow hiding with swipe up inside stats overlay
        statsSection.addEventListener('touchstart', (ev)=>{ if(window.innerWidth<=640){ const t = ev.touches[0]; touchStartY = t.clientY; touching = true } });
        statsSection.addEventListener('touchmove', (ev)=>{ if(!touching) return; const t = ev.touches[0]; const dy = t.clientY - touchStartY; if(dy < -80){ statsSection.classList.remove('visible'); touching = false } });
      }
    }catch(e){ /* ignore */ }

    // Wire Browse Decks modal
    const browseBtn = document.getElementById('browseDecks');
    const overlay = document.getElementById('deckBrowserOverlay');
    const deckList = document.getElementById('deckList');
    const deckMsg = document.getElementById('deckBrowserMsg');
    const closeBtn = document.getElementById('closeDeckBrowser');
    const refreshBtn = document.getElementById('refreshDeckList');
    async function fetchDirectory(path){
      // Try manifest first (recommended for GitHub Pages)
      try{
        const manifestRes = await fetch((path.replace(/\/$/, '') + '/manifest.json'));
        if(manifestRes && manifestRes.ok){
          const list = await manifestRes.json();
          console.log('[fetchDirectory] Loaded manifest:', list);
          if(Array.isArray(list)){
            manifestMeta = {};
            list.forEach(item => {
              console.log('[fetchDirectory] Processing item:', item);
              if(typeof item === 'string'){
                manifestMeta[item] = { path: item };
              } else if(item && item.path){
                console.log('[fetchDirectory] Storing entry for', item.path, '- full item:', JSON.stringify(item));
                manifestMeta[item.path] = item;
              }
            });
            console.log('[fetchDirectory] Final manifestMeta:', manifestMeta);
            // Support both old format (strings) and new format (objects with path/tags/cost/level)
            return list.map(item => typeof item === 'string' ? item : item.path);
          }
        }
      }catch(e){ console.log('[fetchDirectory] Manifest fetch error:', e); }
      // If no manifest, clear metadata to avoid stale locks
      manifestMeta = {};
      try{
        const res = await fetch(path);
        if(!res.ok) throw new Error('HTTP '+res.status);
        const text = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text,'text/html');
        const anchors = Array.from(doc.querySelectorAll('a'));
        const entries = [];
        for(const a of anchors){
          let href = a.getAttribute('href')||'';
          if(!href) continue;
          // normalize
          if(href.startsWith('./')) href = href.slice(2);
          // ignore parent links
          if(href === '../' || href === '/') continue;
          // trim trailing slash for folders
          if(href.endsWith('/')) href = href;
          entries.push(href);
        }
        return Array.from(new Set(entries));
      }catch(err){
        throw err;
      }
    }

    async function openDeckBrowser(){
      if(!overlay) return;
      
      // Show contextual onboarding on first open
      setTimeout(() => {
        if(typeof showBrowseOnboarding === 'function'){
          showBrowseOnboarding();
        }
      }, 300);
      
      overlay.style.display = 'flex'; overlay.setAttribute('aria-hidden','false'); overlay.classList.add('open');
      overlay.querySelector('.modal')?.classList.add('open');
      deckList.innerHTML = '';
      deckMsg.textContent = 'Recherche de ./decks/ ...';
      try{
        const entries = await fetchDirectory('./decks/');
        if(!entries || entries.length===0){ deckMsg.textContent = 'Aucun fichier trouvé dans ./decks/'; return }
        deckMsg.textContent = '';
        // If manifest contains paths with '/', treat as manifest-mode and build a tree
        const manifestMode = entries.some(e=> typeof e === 'string' && e.includes('/'));
        if(manifestMode){
          // keep entries for navigation
          overlay._manifestEntries = entries.slice();
          renderPath('');
        } else {
          // normal directory listing (server HTML) — render directly
          renderList(entries, './decks/');
        }

        function renderPath(path){
          deckList.innerHTML = '';
          // path is like '' or 'Anglais/' or 'Anglais/Sub/'
          const prefix = path;
          const files = new Set();
          const folders = new Set();
          for(const p of entries){
            if(!p.startsWith(prefix)) continue;
            const tail = p.slice(prefix.length);
            const parts = tail.split('/');
            if(parts.length === 1){ files.add(parts[0]); }
            else { folders.add(parts[0] + '/'); }
          }
          // parent link
          if(prefix){
            const back = document.createElement('div'); back.className='deck-entry';
            const nm = document.createElement('div'); nm.textContent = '..';
            const act = document.createElement('div');
              const b = document.createElement('button'); b.className='secondary'; b.textContent='Retour';
            b.addEventListener('click', ()=>{ const up = prefix.replace(/[^\/]+\/$/,''); renderPath(up); });
            act.appendChild(b); back.appendChild(nm); back.appendChild(act); deckList.appendChild(back);
          }
          // folders with due counts and badge
          Array.from(folders).sort().forEach(folder=>{
            const row = document.createElement('div'); row.className='deck-entry';
            const nm = document.createElement('div'); 
            const folderName = decodeURIComponent((prefix+folder).replace(/\+/g,' ')).replace(/\/$/,'');
            nm.textContent = folderName;
            
            // Calculate folder due count with badge
            const folderPath = prefix + folder;
            const badge = document.createElement('span');
            badge.className = 'due-badge';
            badge.innerHTML = `<div class="due-num"></div><div class="due-label">à faire</div>`;
            
            const act = document.createElement('div');
            const b = document.createElement('button'); b.className='secondary'; b.textContent='Ouvrir';
            b.addEventListener('click', ()=>{ renderPath(prefix+folder); });
            act.appendChild(badge);
            act.appendChild(b); 
            row.appendChild(nm); 
            row.appendChild(act); 
            deckList.appendChild(row);
            
            // Asynchronously calculate total dues for all files in this folder
            (async ()=>{
              try{
                let totalDue = 0;
                for(const p of entries){
                  if(!p.startsWith(folderPath) || !p.toLowerCase().endsWith('.xml')) continue;
                  const n = await countDueNowForDeck('./decks/'+p);
                  if(typeof n === 'number') totalDue += n;
                }
                if(totalDue > 0){
                  badge.querySelector('.due-num').textContent = totalDue;
                  badge.querySelector('.due-label').style.display = 'block';
                } else {
                  badge.querySelector('.due-num').textContent = '';
                  badge.querySelector('.due-label').style.display = 'none';
                }
              }catch(e){ /* ignore */ }
            })();
          });
          // files (limit to first 10)
          Array.from(files).sort().forEach(file=>{
            const row = document.createElement('div'); row.className='deck-entry';
            const dec = decodeURIComponent((prefix+file).replace(/\+/g,' '));
            const nm = document.createElement('div'); nm.textContent = dec.replace(/\.xml$/i,'');
            const act = document.createElement('div');
              if(file.toLowerCase().endsWith('.xml')){ const dueBadge = document.createElement('span'); dueBadge.className = 'due-badge'; dueBadge.innerHTML = '<div class="due-num"></div><div class="due-label">à faire</div>';
                const b=document.createElement('button'); b.className='secondary';
                b.textContent = (window.innerWidth <= 640) ? '▶️' : 'Accéder';
                b.addEventListener('click', async ()=>{ 
                  const deckBrowserOverlay = document.getElementById('deckBrowserOverlay');
                  if(deckBrowserOverlay) deckBrowserOverlay.style.display='none';
                  showDeckOverview('./decks/'+prefix+file);
                });
                act.appendChild(dueBadge); act.appendChild(b);
                // asynchronously compute number of cards due now for this deck and display
                (async ()=>{
                  try{
                    const url = './decks/'+prefix+file;
                    const n = await countDueNowForDeck(url);
                    if(typeof n === 'number' && n>=0){
                      dueBadge.querySelector('.due-num').textContent = n>0? n : '';
                      // hide label when zero
                      dueBadge.querySelector('.due-label').style.display = n>0? 'block' : 'none';
                    } else { dueBadge.querySelector('.due-num').textContent = ''; dueBadge.querySelector('.due-label').style.display = 'none' }
                  }catch(e){ /* ignore */ }
                })();
              }
            row.appendChild(nm); row.appendChild(act); deckList.appendChild(row);
          });
          
          // Add "Review all decks in this folder" button if there are any XML files
          const xmlFiles = Array.from(files).filter(f => f.toLowerCase().endsWith('.xml'));
          if(xmlFiles.length > 0){
            const allBtn = document.createElement('div'); allBtn.className = 'deck-entry'; allBtn.style.marginTop = '12px'; allBtn.style.borderTop = '1px solid rgba(0,0,0,0.06)'; allBtn.style.paddingTop = '12px';
            const allBtnText = document.createElement('div'); allBtnText.textContent = '📚 Réviser tous les decks du dossier'; allBtnText.style.fontWeight = '600';
            const allBtnAct = document.createElement('div');
            const reviewAllBtn = document.createElement('button'); reviewAllBtn.className = 'secondary'; reviewAllBtn.textContent = 'Commencer';
            reviewAllBtn.addEventListener('click', async ()=>{
              try{
                // Collect all XML files from this folder
                const deckURLs = xmlFiles.map(f => './decks/' + prefix + f);
                // Close modal
                await removeWelcome();
                overlay.querySelector('.modal')?.classList.remove('open');
                overlay.classList.remove('open');
                overlay.style.display='none';
                overlay.setAttribute('aria-hidden','true');
                // Start multi-deck review
                await loadMultipleDeckCards(deckURLs);
              }catch(e){ console.warn('Review all error:', e); }
            });
            allBtnAct.appendChild(reviewAllBtn);
            allBtn.appendChild(allBtnText);
            allBtn.appendChild(allBtnAct);
            deckList.appendChild(allBtn);
          }
          
          deckMsg.textContent = '';
        }

        async function renderList(list, base){
          deckList.innerHTML = '';
          for(const e of (list.slice ? list : list)){
            const row = document.createElement('div'); row.className='deck-entry';
            const decoded = (()=>{ try{ return decodeURIComponent(e.replace(/\+/g,' ')) }catch(x){ return e } })();
            const name = document.createElement('div'); name.textContent = decoded.replace(/\.xml$/i,'');
            const dueBadge = document.createElement('span'); dueBadge.className = 'due-badge'; dueBadge.innerHTML = '<div class="due-num"></div><div class="due-label">à faire</div>';
            name.appendChild(dueBadge);
            const actions = document.createElement('div');
            if(e.endsWith('.xml')){ const dueBadge2 = document.createElement('span'); dueBadge2.className = 'due-badge'; dueBadge2.innerHTML = '<div class="due-num"></div><div class="due-label">à faire</div>';
              const btn = document.createElement('button'); btn.className='secondary';
              try{
                const relPath = normalizeDeckPath(base+e);
                const lockState = evaluateDeckLock(relPath);
                if(lockState.locked){
                  if(lockState.lockedByLevel){
                    btn.textContent = `🔒 Niveau ${lockState.levelReq}`;
                    btn.disabled = true;
                    btn.title = 'Atteignez le niveau requis pour débloquer ce deck';
                  } else if(lockState.lockedByCost){
                    btn.textContent = `Acheter ${lockState.cost}💳`;
                    btn.disabled = lockState.currentCredits < lockState.cost;
                    btn.title = lockState.currentCredits < lockState.cost ? 'Crédits insuffisants' : 'Débloquer ce deck';
                    btn.addEventListener('click', ()=>{
                      const freshState = evaluateDeckLock(relPath);
                      if(freshState.lockedByLevel) return;
                      if(freshState.currentCredits < freshState.cost) return;
                      if(typeof addCredits === 'function') addCredits(-freshState.cost);
                      setDeckUnlocked(relPath);
                      renderList(list, base);
                    });
                  }
                } else {
                  btn.textContent = (window.innerWidth <= 640) ? '📂' : 'Accéder';
                  btn.addEventListener('click', async ()=>{ 
                    const deckBrowserOverlay = document.getElementById('deckBrowserOverlay');
                    if(deckBrowserOverlay) deckBrowserOverlay.style.display='none';
                    showDeckOverview(base+e);
                  });
                }
              }catch(err){
                console.warn('Lock check error for', e, err);
                btn.textContent = (window.innerWidth <= 640) ? '📂' : 'Accéder';
                btn.addEventListener('click', async ()=>{ 
                  const deckBrowserOverlay = document.getElementById('deckBrowserOverlay');
                  if(deckBrowserOverlay) deckBrowserOverlay.style.display='none';
                  showDeckOverview(base+e);
                });
              }
              actions.appendChild(dueBadge2); actions.appendChild(btn);
                (async ()=>{ try{ const n = await countDueNowForDeck(base+e); if(typeof n === 'number' && n>=0){ dueBadge2.querySelector('.due-num').textContent = n>0? n : ''; dueBadge2.querySelector('.due-label').style.display = n>0? 'block' : 'none'; }else{ dueBadge2.querySelector('.due-num').textContent=''; dueBadge2.querySelector('.due-label').style.display='none'; } }catch(err){} })();
            }
            else { const btn = document.createElement('button'); btn.className='secondary'; btn.textContent='Ouvrir'; btn.addEventListener('click', async ()=>{ deckMsg.textContent = 'Exploration de '+base+e+' ...'; try{ const sub = await fetchDirectory(base+e); renderList(sub, base+e); }catch(err){ deckMsg.textContent = 'Impossible d\'explorer le dossier: '+err.message } }); actions.appendChild(btn); }
            row.appendChild(name); row.appendChild(actions); deckList.appendChild(row);
          }
        }
      }catch(err){ deckMsg.textContent = 'Impossible d\'accéder à ./decks/ — invoquez via un serveur HTTP (non supporté en file://)'; }
    }
    if(browseBtn) browseBtn.addEventListener('click', openDeckBrowser);
    // show tooltip first-time to indicate where to change deck
    function showDeckTooltipOnce(){
      try{
        const key = 'fabanki_seenDeckTooltip_v1';
        if(localStorage.getItem(key)) return;
        const btn = document.getElementById('browseDecks');
        if(!btn) return;
        const r = btn.getBoundingClientRect();
        const tip = document.createElement('div'); tip.className='tooltip'; tip.id='deckTooltip';
        tip.textContent = 'Cliquer ici pour choisir un deck';
        document.body.appendChild(tip);
        // position above the button
        tip.style.left = (r.left + window.scrollX) + 'px';
        tip.style.top = (r.bottom + window.scrollY + 8) + 'px';
        setTimeout(()=>{ try{ tip.style.opacity='0'; tip.remove(); localStorage.setItem(key,'1') }catch(e){} }, 3800);
      }catch(e){}
    }
    showDeckTooltipOnce();
    if(closeBtn) closeBtn.addEventListener('click', ()=>{ if(overlay){ overlay.querySelector('.modal')?.classList.remove('open'); overlay.classList.remove('open'); overlay.style.display='none'; overlay.setAttribute('aria-hidden','true'); } });
    if(overlay){ overlay.addEventListener('click', (ev)=>{ if(ev.target === overlay){ overlay.querySelector('.modal')?.classList.remove('open'); overlay.classList.remove('open'); overlay.style.display='none'; overlay.setAttribute('aria-hidden','true'); } }); }
    if(refreshBtn) refreshBtn.addEventListener('click', ()=>{ openDeckBrowser(); });
    
    // Helper: parse card ids from an XML document (lightweight, used by deck browser counts)
    function parseCardIdsFromXML(xml){
      const cardNodes = Array.from(xml.getElementsByTagName('card'));
      const candidates = cardNodes.length ? cardNodes : Array.from(xml.querySelectorAll('card, note, item, entry, record'));
      const ids = [];
      let idx = 0;
      for(const node of candidates){
        try{ const id = node.getAttribute('id') || node.getAttribute('guid') || ('card-'+(idx++)); ids.push(id); }catch(e){ continue }
      }
      return ids;
    }

    // Count number of cards due now for a deck URL (considers localStorage state for that deck)
    async function countDueNowForDeck(url){
      try{
        const res = await fetch(url);
        if(!res.ok) return 0;
        const text = await res.text();
        const parser = new DOMParser();
        let xml = parser.parseFromString(text,'application/xml');
        if(xml.querySelector && xml.querySelector('parsererror')) xml = parser.parseFromString(text,'text/html');
        const ids = parseCardIdsFromXML(xml);
        const keyPrefix = 'fabanki:' + fallbackSha1(url).slice(0,10) + ':';
        const now = new Date();
        let cnt = 0;
        for(const id of ids){
          try{
            const key = keyPrefix + 'card:' + id;
            const st = JSON.parse(localStorage.getItem(key) || '{}');
            const isNew = (!st || (!st.last && (st.reps===0 || st.reps===undefined)));
            if(isNew) continue;
            const due = st && st.due ? new Date(st.due) : now;
            if(due <= now) cnt++;
          }catch(e){ continue }
        }
        return cnt;
      }catch(e){ return 0 }
    }
    // toggle histogram button (mobile: overlay, desktop: scroll)
    const toggleStatsBtn = document.getElementById('toggleStats');
    if(toggleStatsBtn){
      toggleStatsBtn.addEventListener('click', ()=>{
        const stats = document.getElementById('stats');
        if(!stats) return;
        if(window.innerWidth <= 640){ stats.classList.toggle('visible'); }
        else { stats.scrollIntoView({behavior:'smooth'}); }
      });
    }

    // Mobile-only: replace top-bar button labels with emojis.
    function updateTopBarLabels(){
      try{
        const isMobile = window.innerWidth <= 640;
        const buttons = document.querySelectorAll('header .controls button[data-label-text]');
        buttons.forEach(btn=>{
          const text = btn.getAttribute('data-label-text') || btn.textContent;
          const emoji = btn.getAttribute('data-label-emoji') || text;
          btn.textContent = isMobile ? emoji : text;
        });
        // no inline profile badge; profile info shown in popup on click
      }catch(e){}
    }
    updateTopBarLabels();
    window.addEventListener('resize', updateTopBarLabels);

    // Hide status and hint when mobile stats overlay is visible
    (function(){
      try{
        const statsEl = document.getElementById('stats');
        if(!statsEl) return;
        const handle = ()=>{
          const isVis = statsEl.classList.contains('visible');
          const isMobile = window.innerWidth <= 640;
          const s = document.getElementById('status');
          const hint = document.getElementById('histHint');
          if(isMobile && isVis){ if(s) s.style.display='none'; if(hint) hint.style.display='none'; }
          else { if(s) s.style.display=''; if(hint) hint.style.display=''; try{ updateStatus(s?.textContent || '') }catch(e){} }
        };
        // observe class changes
        const mo = new MutationObserver(handle);
        mo.observe(statsEl, { attributes: true, attributeFilter: ['class'] });
        // also run once to sync initial state
        window.addEventListener('load', handle);
        window.addEventListener('resize', handle);
      }catch(e){}
    })();
    // Hide card status when any modal or stats overlay is visible
    (function(){
      function anyModalOpen(){
        try{
          const overlays = Array.from(document.querySelectorAll('.modal-overlay'));
          for(const o of overlays){
            const aria = o.getAttribute('aria-hidden');
            const disp = (o.style && o.style.display) || getComputedStyle(o).display;
            if(aria === 'false' || disp !== 'none') return true;
          }
          const stats = document.getElementById('stats'); if(stats && stats.classList.contains('visible')) return true;
        }catch(e){}
        return false;
      }
      function syncCardStatus(){
        try{
          const st = document.getElementById('cardStatus'); if(!st) return;
          if(anyModalOpen()) st.style.display = 'none'; else st.style.display = '';
        }catch(e){}
      }
      try{
        const mo = new MutationObserver(syncCardStatus);
        mo.observe(document.body, {subtree:true, childList:true, attributes:true, attributeFilter:['style','aria-hidden','class']});
      }catch(e){}
      setTimeout(syncCardStatus, 120);
      window.addEventListener('resize', syncCardStatus);
    })();

    // Also hide status/hint when the deck browser overlay is visible on mobile
    (function(){
      try{
        const deckOverlay = document.getElementById('deckBrowserOverlay');
        if(!deckOverlay) return;
        const handleDeck = ()=>{
          const isOpen = deckOverlay.style.display === 'flex' || deckOverlay.getAttribute('aria-hidden') === 'false';
          const isMobile = window.innerWidth <= 640;
          const s = document.getElementById('status');
          const hint = document.getElementById('histHint');
          if(isMobile && isOpen){ if(s) s.style.display='none'; if(hint) hint.style.display='none'; }
          else { if(s) s.style.display=''; if(hint) hint.style.display=''; try{ updateStatus(s?.textContent || '') }catch(e){} }
        };
        const mo2 = new MutationObserver(handleDeck);
        mo2.observe(deckOverlay, { attributes:true, attributeFilter:['style','aria-hidden'] });
        window.addEventListener('resize', handleDeck);
        window.addEventListener('load', handleDeck);
      }catch(e){}
    })();
    // close button for mobile histogram overlay
    const closeStatsBtn = document.getElementById('closeStatsMobile');
    if(closeStatsBtn){
      closeStatsBtn.addEventListener('click', ()=>{
        const stats = document.getElementById('stats'); if(!stats) return; stats.classList.remove('visible');
      });
    }

    // check URL param
    const pdeck = param('deck');
    // Profile & XP helpers
    function getProfileStats(){
      let total = 0, today = 0;
      const now = new Date();
      for(const k of Object.keys(localStorage)){
        // support keys like 'fabanki:<deckKey>:card:<id>' and older 'fabanki:card:<id>'
        if(!k.includes(':card:')) continue;
        try{
          const st = JSON.parse(localStorage.getItem(k) || '{}');
          // Count as reviewed if it has reps>0 OR it was seen (has last) — include Pass actions
          if(st && ((st.reps && st.reps>0) || st.last)) total++;
          if(st && st.last){ const d = new Date(st.last); if(d.toDateString() === now.toDateString()) today++; }
        }catch(e){}
      }
      const xp = Number(localStorage.getItem('fabanki:xp_total') || 0);
      return {totalReviewed: total, todayReviewed: today, xpTotal: xp};
    }

    function showProfilePopup(){
      try{
        // prevent duplicates
        if(document.getElementById('profileOverlay')) return;
        
        // Show contextual onboarding on first open
        setTimeout(() => {
          if(typeof showProfileOnboarding === 'function'){
            showProfileOnboarding();
          }
        }, 300);
        
        const stats = getProfileStats();
        const ov = document.createElement('div'); ov.id='profileOverlay'; ov.className='modal-overlay'; ov.style.display='flex'; ov.style.alignItems='center'; ov.style.justifyContent='center'; ov.style.zIndex='1200';
        const m = document.createElement('div'); m.className='modal'; m.style.maxWidth='420px'; m.style.width='90%';
        const h = document.createElement('h3'); h.textContent='👤 Profil'; h.style.marginTop='0'; h.style.marginBottom='16px'; h.style.fontSize='1.5rem'; m.appendChild(h);
        // Pseudo display (from localStorage)
        const userPseudo = localStorage.getItem('pseudo') || '';
        const p0 = document.createElement('div'); p0.id='profilePseudo'; p0.className='muted small'; p0.style.marginBottom='6px'; p0.textContent = `Pseudo: ${userPseudo}`;
        // modifier button
        const editBtn = document.createElement('button'); editBtn.className='secondary'; editBtn.style.marginLeft='8px'; editBtn.textContent = 'Modifier';
        editBtn.addEventListener('click', ()=>{
          try{
            const cur = localStorage.getItem('pseudo') || '';
            const input = document.createElement('input'); input.type='text'; input.value = cur; input.style.width='60%'; input.style.marginLeft='8px';
            const save = document.createElement('button'); save.className='secondary'; save.textContent='Enregistrer'; save.style.marginLeft='6px';
            const cancel = document.createElement('button'); cancel.className='secondary'; cancel.textContent='Annuler'; cancel.style.marginLeft='6px';
            p0.textContent = 'Pseudo : '; p0.appendChild(input); p0.appendChild(save); p0.appendChild(cancel);
            save.addEventListener('click', ()=>{ const v = (input.value||'').trim(); if(!v) return input.focus(); localStorage.setItem('pseudo', v); if(typeof updateProfilePopupIfOpen === 'function') updateProfilePopupIfOpen(); try{ if(typeof syncClassement === 'function') syncClassement(); }catch(e){} });
            cancel.addEventListener('click', ()=>{ p0.textContent = `Pseudo: ${localStorage.getItem('pseudo') || ''}` });
          }catch(e){ console.warn('edit pseudo', e) }
        });
        const pWrap = document.createElement('div'); pWrap.style.display='flex'; pWrap.style.alignItems='center'; pWrap.appendChild(p0); pWrap.appendChild(editBtn); m.appendChild(pWrap);
        
        // Stats box with dark theme
        const statsBox = document.createElement('div');
        statsBox.style.cssText = 'padding:16px;background:linear-gradient(135deg, #1e293b 0%, #334155 100%);color:white;border-radius:8px;margin:16px 0;box-shadow:0 2px 8px rgba(0,0,0,0.2);';
        
        const p1 = document.createElement('div'); p1.className='profile-total'; p1.style.marginBottom='8px'; p1.innerHTML = `<strong>📚 Cartes lues:</strong> ${stats.totalReviewed}`; statsBox.appendChild(p1);
        const p2 = document.createElement('div'); p2.className='profile-today'; p2.style.marginBottom='8px'; p2.innerHTML = `<strong>📅 Aujourd'hui:</strong> ${stats.todayReviewed}`; statsBox.appendChild(p2);
        const p3 = document.createElement('div'); p3.className='profile-xp'; p3.style.marginBottom='8px'; p3.innerHTML = `<strong>✨ XP:</strong> ${stats.xpTotal}`; statsBox.appendChild(p3);
        const p4 = document.createElement('div'); p4.className='profile-streak'; p4.innerHTML = `<strong>🔥 Série:</strong> ${Number(localStorage.getItem('fabanki:streak_current')||0)} jours`; statsBox.appendChild(p4);
        
        m.appendChild(statsBox);

        // Classement button
        const rankBtnWrap = document.createElement('div'); 
        rankBtnWrap.style.marginTop = '10px'; 
        rankBtnWrap.style.display = 'flex'; 
        rankBtnWrap.style.gap = '8px';
        rankBtnWrap.style.flexWrap = 'wrap';
        const rankBtn = document.createElement('button'); rankBtn.className = 'secondary'; rankBtn.textContent = 'Classement';
        rankBtn.addEventListener('click', ()=>{ try{ showLeaderboardPopup(); }catch(e){ console.warn(e) } });
        rankBtnWrap.appendChild(rankBtn);
        // Titres button
        const titlesBtn = document.createElement('button'); titlesBtn.className='secondary'; titlesBtn.textContent = 'Titres';
        titlesBtn.addEventListener('click', ()=>{ try{ showTitlesPopup(); }catch(e){ console.warn(e) } });
        rankBtnWrap.appendChild(titlesBtn);
        // Tutorial button
        const tutorialBtn = document.createElement('button'); tutorialBtn.className='secondary'; tutorialBtn.textContent='📖';
        tutorialBtn.title = 'Tutoriel';
        tutorialBtn.addEventListener('click', ()=>{
          try{
            // Close profile popup first
            const profileOverlay = document.getElementById('profileOverlay');
            if(profileOverlay) profileOverlay.remove();
            // Start tutorial after a short delay
            setTimeout(() => {
              if(typeof showOnboarding === 'function'){
                showOnboarding();
              }
            }, 200);
          }catch(e){ console.warn('tutorial error', e) }
        });
        rankBtnWrap.appendChild(tutorialBtn);
        // Customization button
        const customizeBtn = document.createElement('button'); customizeBtn.className='secondary'; customizeBtn.textContent='⚙️';
        customizeBtn.title = 'Personnaliser';
        customizeBtn.addEventListener('click', ()=>{
          try{
            if(typeof showCustomizationModal === 'function'){
              showCustomizationModal();
            }
          }catch(e){ console.warn('customize error', e) }
        });
        rankBtnWrap.appendChild(customizeBtn);
        m.appendChild(rankBtnWrap);

        // Level box: ring + info
        try{
          const lvl = computeLevelAndProgress(stats.xpTotal || 0);
          const levelBox = document.createElement('div'); levelBox.className = 'level-box';
          const ring = document.createElement('div'); ring.className = 'level-ring';
          const circ = 2 * Math.PI * 42;
          const pct = Math.max(0, Math.min(100, Math.round(lvl.pct || 0)));
          const offset = Math.round(circ * (1 - pct/100));
          const color = getLevelColor(lvl.level);
          ring.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" stroke="#eee" stroke-width="8" fill="none"></circle><circle class="ring-fill" cx="50" cy="50" r="42" stroke="${color}" stroke-width="8" fill="none" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"></circle></svg><div class="level-num">${lvl.level}</div>`;
          const info = document.createElement('div'); info.className='level-info';
          const next = document.createElement('div'); next.className='next muted small'; next.textContent = `Prochain niveau dans ${lvl.toNext} XP`;
          const rem = document.createElement('div'); rem.className='progress-remaining'; rem.textContent = `${lvl.progress}/${lvl.need} (${pct}%)`;
          info.appendChild(next); info.appendChild(rem);
          levelBox.appendChild(ring); levelBox.appendChild(info);
          m.appendChild(levelBox);
        }catch(e){ /* ignore level rendering errors */ }

        const close = document.createElement('div'); close.style.display='flex'; close.style.justifyContent='flex-end'; close.style.marginTop='12px';
        const cb = document.createElement('button'); cb.className='secondary'; cb.textContent='Fermer'; cb.addEventListener('click', ()=>{ ov.remove(); }); close.appendChild(cb);
        m.appendChild(close);
        ov.appendChild(m); document.body.appendChild(ov);
        // mark overlay open so CSS fade can run, then animate modal open
        try{ ov.classList.add('open'); ov.setAttribute('aria-hidden','false'); m.classList.add('open');
          const anim = localStorage.getItem('fabanki:popup_animation') || 'none';
          if(anim !== 'none') m.setAttribute('data-animation', anim);
        }catch(e){}
        ov.addEventListener('click', (ev)=>{ if(ev.target === ov) ov.remove(); });
      }catch(e){ console.warn('profile popup error', e); }
    }

    function updateProfilePopupIfOpen(){
      try{
        const ov = document.getElementById('profileOverlay');
        if(!ov) return;
        const stats = getProfileStats();
        const pseudoNode = ov.querySelector('#profilePseudo'); if(pseudoNode) pseudoNode.textContent = `Pseudo: ${localStorage.getItem('pseudo') || ''}`;
        const totalNode = ov.querySelector('.profile-total'); if(totalNode) totalNode.textContent = `Cartes lues: ${stats.totalReviewed}`;
        const todayNode = ov.querySelector('.profile-today'); if(todayNode) todayNode.textContent = `Cartes lues aujourd'hui: ${stats.todayReviewed}`;
        const xpNode = ov.querySelector('.profile-xp'); if(xpNode) xpNode.innerHTML = `<strong>XP:</strong> ${stats.xpTotal}`;
        // update level ring if present
        try{
          const lvl = computeLevelAndProgress(stats.xpTotal || 0);
          const ringFill = ov.querySelector('.level-ring .ring-fill');
          const levelNum = ov.querySelector('.level-ring .level-num');
          const nextTxt = ov.querySelector('.level-info .next');
          const remTxt = ov.querySelector('.level-info .progress-remaining');
          if(ringFill){ const circ = 2 * Math.PI * 42; const pct = Math.max(0, Math.min(100, Math.round(lvl.pct || 0))); ringFill.style.stroke = getLevelColor(lvl.level); ringFill.setAttribute('stroke-dasharray', String(circ)); ringFill.setAttribute('stroke-dashoffset', String(Math.round(circ * (1 - pct/100)))); }
          if(levelNum) levelNum.textContent = String(lvl.level);
          if(nextTxt) nextTxt.textContent = `Prochain niveau dans ${lvl.toNext} XP`;
          if(remTxt) remTxt.textContent = `${lvl.progress}/${lvl.need} (${Math.round(lvl.pct||0)}%)`;
        }catch(e){}
        // refresh pseudo display (target the specific element, not the first div)
        try{ const p0 = ov.querySelector('#profilePseudo'); if(p0) p0.textContent = `Pseudo: ${localStorage.getItem('pseudo') || ''}` }catch(e){}
        try{ const s = ov.querySelector('.profile-streak'); if(s) s.textContent = `Jours consécutifs: ${Number(localStorage.getItem('fabanki:streak_current')||0)}` }catch(e){}
      }catch(e){}
    }

    // expose helpers globally so other handlers (outside load) can use them
    try{ window.applyXp = applyXp; window.computeXpForQuality = computeXpForQuality; window.getDeckSection = getDeckSection; window.showXpToast = showXpToast; window.getXpTotal = getXpTotal; window.updateProfilePopupIfOpen = updateProfilePopupIfOpen; window.computePenaltyForSection = computePenaltyForSection; window.computeLevelAndProgress = computeLevelAndProgress; window.getLevelColor = getLevelColor; }catch(e){}

    // expose leaderboard helpers
    try{ window.ensurePseudo = ensurePseudo; window.syncClassement = syncClassement; window.showLeaderboardPopup = showLeaderboardPopup; }catch(e){}

    const profileBtn = document.getElementById('profileBtn');
    if(profileBtn) profileBtn.addEventListener('click', ()=>{ showProfilePopup(); updateProfilePopupIfOpen(); });

    // === Optional Account + Synchronization System ===
    // Unified user state used for both local-only and synced modes.
    // Guarded: if Firebase Auth/Firestore are not configured, app remains local-only.
    
    // In-memory state
    window.userState = null;

    function defaultUserState(){
      const xp = getXpTotal();
      const lvl = computeLevelAndProgress(xp).level;
      return {
        mode: (localStorage.getItem('fabanki:mode') || 'local'),
        userId: localStorage.getItem('fabanki:user_id') || null,
        pseudo: localStorage.getItem('pseudo') || 'Anonyme',
        xp: xp,
        level: lvl,
        credits: getCredits(),
        decks: collectDeckStates(),
        quests: collectQuestState(),
        lastUpdated: Date.now()
      };
    }

    function collectDeckStates(){
      const decks = {};
      try{
        for(const k of Object.keys(localStorage)){
          // keys like: fabanki:{deckKey}:card:{cardId}
          const m = k.match(/^fabanki:([^:]+):card:(.+)$/);
          if(!m) continue;
          const dKey = m[1];
          const cId = m[2];
          let st = null; 
          try{ st = JSON.parse(localStorage.getItem(k) || 'null'); }catch(e){ st = null }
          if(!st) continue;
          if(!decks[dKey]) decks[dKey] = { cards: {} };
          decks[dKey].cards[cId] = st;
        }
      }catch(e){ /* ignore */ }
      return decks;
    }

    function collectQuestState(){
      try{
        const daily = JSON.parse(localStorage.getItem('fabanki:daily_missions') || '[]');
        const weekly = JSON.parse(localStorage.getItem('fabanki:weekly_missions') || '[]');
        const missions_date = localStorage.getItem('fabanki:missions_date') || null;
        return { daily, weekly, missions_date };
      }catch(e){ return { daily:[], weekly:[], missions_date:null } }
    }

    function applyStateToLocalStorage(state){
      try{
        // Core profile
        if(state.pseudo) localStorage.setItem('pseudo', state.pseudo);
        if(Number.isFinite(state.xp)) localStorage.setItem('fabanki:xp_total', String(state.xp));
        if(Number.isFinite(state.credits)) localStorage.setItem('fabanki:credits', String(state.credits));
        // Quests
        if(state.quests){
          localStorage.setItem('fabanki:daily_missions', JSON.stringify(state.quests.daily||[]));
          localStorage.setItem('fabanki:weekly_missions', JSON.stringify(state.quests.weekly||[]));
          if(state.quests.missions_date) localStorage.setItem('fabanki:missions_date', state.quests.missions_date);
        }
        // Deck cards
        if(state.decks){
          for(const dKey of Object.keys(state.decks)){
            const cards = state.decks[dKey]?.cards || {};
            for(const cardId of Object.keys(cards)){
              const k = `fabanki:${dKey}:card:${cardId}`;
              localStorage.setItem(k, JSON.stringify(cards[cardId]));
            }
          }
        }
      }catch(e){ console.warn('applyStateToLocalStorage', e) }
    }

    function initUserState(){
      try{
        const saved = loadState();
        if(saved){ window.userState = saved; }
        else { window.userState = defaultUserState(); }
        // Persist baseline
        saveState(window.userState);
      }catch(e){ console.warn('initUserState', e) }
    }

    function loadState(){
      try{
        const raw = localStorage.getItem('fabanki:user_state');
        if(!raw) return null;
        const st = JSON.parse(raw);
        // Lightweight validation
        if(!st || typeof st !== 'object') return null;
        return st;
      }catch(e){ return null }
    }

    async function saveState(state){
      try{
        const toSave = { ...state, lastUpdated: Date.now() };
        window.userState = toSave;
        localStorage.setItem('fabanki:user_state', JSON.stringify(toSave));
        localStorage.setItem('fabanki:mode', toSave.mode || 'local');
        if(toSave.userId) localStorage.setItem('fabanki:user_id', toSave.userId);

        // Cloud push (optional)
        if((toSave.mode === 'synced') && window.__fabanki_firestore){
          try{
            const uid = toSave.userId;
            if(uid){
              await window.__fabanki_firestore.collection('users').doc(uid).set(toSave, { merge: true });
            }
          }catch(e){ console.warn('saveState cloud', e) }
        }
      }catch(e){ console.warn('saveState', e) }
    }

    async function createAccountAndSync(emailArg, passwordArg){
      try{
        const db = window.__fabanki_firestore;
        const auth = firebase?.auth?.();
        if(!db || !auth){ alert('La synchronisation nécessite une configuration Firebase (Auth + Firestore).'); return; }
        const email = emailArg ?? prompt('Email pour créer un compte (Firebase)');
        if(!email) return;
        const password = passwordArg ?? prompt('Mot de passe');
        if(!password) return;
        const { user } = await auth.createUserWithEmailAndPassword(email, password);
        // Switch to synced mode and push current state
        const st = defaultUserState();
        st.mode = 'synced';
        st.userId = user.uid;
        await saveState(st);
        alert('✅ Compte créé et progrès synchronisés.');
      }catch(e){ 
        alert('❌ Échec création:\n\n' + (e?.message || e));
      }
    }

    async function loginAndSync(emailArg, passwordArg){
      try{
        const db = window.__fabanki_firestore;
        const auth = firebase?.auth?.();
        if(!db || !auth){ alert('La synchronisation nécessite une configuration Firebase (Auth + Firestore).'); return; }
        const email = emailArg ?? prompt('Email de connexion'); if(!email) return;
        const password = passwordArg ?? prompt('Mot de passe'); if(!password) return;
        const { user } = await auth.signInWithEmailAndPassword(email, password);
        const uid = user.uid;

        const localSt = loadState() || defaultUserState();
        const docRef = db.collection('users').doc(uid);
        const snap = await docRef.get();
        const remoteSt = snap.exists ? (snap.data() || null) : null;

        let chosen = localSt;
        if(remoteSt && Number(remoteSt.lastUpdated||0) > Number(localSt.lastUpdated||0)){
          // Remote newer → apply to local
          applyStateToLocalStorage(remoteSt);
          chosen = { ...remoteSt, mode: 'synced', userId: uid };
        } else {
          // Local newer or no remote → push local
          chosen.mode = 'synced';
          chosen.userId = uid;
        }
        await saveState(chosen);
        alert('✅ Connexion et synchronisation terminées.');
      }catch(e){ 
        alert('❌ Échec connexion:\n\n' + (e?.message || e));
      }
    }

    async function logoutAndSync(){
      try{
        const auth = firebase?.auth?.();
        if(!auth) return;
        await auth.signOut();
        const st = defaultUserState();
        st.mode = 'local';
        st.userId = null;
        await saveState(st);
        alert('✅ Déconnexion réussie. Vos données locales sont conservées.');
      }catch(e){
        alert('❌ Échec déconnexion:\n\n' + (e?.message || e));
      }
    }

    function showSyncPopup(){
      try{
        if(document.getElementById('syncOverlay')) return;
        
        const db = window.__fabanki_firestore;
        const auth = firebase?.auth?.();

        // Check if Firebase is configured
        if(!db || !auth){
          alert('❌ La synchronisation n\'est pas disponible.\n\nLa configuration Firebase est manquante ou invalide.');
          return;
        }

        const ov = document.createElement('div');
        ov.id = 'syncOverlay';
        ov.className = 'modal-overlay open';
        ov.style.display = 'flex';
        ov.style.alignItems = 'center';
        ov.style.justifyContent = 'center';
        ov.style.zIndex = '2500';

        const m = document.createElement('div');
        m.className = 'modal open';
        m.setAttribute('role', 'dialog');
        m.setAttribute('aria-modal', 'true');
        m.style.maxWidth = '480px';
        m.style.padding = '24px';

        const h = document.createElement('h3');
        h.textContent = '☁️ Synchronisation';
        h.style.marginTop = '0';
        h.style.marginBottom = '12px';
        h.style.fontSize = '1.5rem';
        m.appendChild(h);

        // Check if user is already logged in
        const currentUser = auth.currentUser;
        
        if(currentUser){
          // User is logged in - show logged in state
          const loggedInfo = document.createElement('div');
          loggedInfo.style.padding = '16px';
          loggedInfo.style.background = 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
          loggedInfo.style.color = 'white';
          loggedInfo.style.borderRadius = '8px';
          loggedInfo.style.marginBottom = '16px';
          loggedInfo.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
          
          const emailLabel = document.createElement('div');
          emailLabel.style.fontSize = '0.85rem';
          emailLabel.style.opacity = '0.8';
          emailLabel.textContent = 'Connecté en tant que';
          emailLabel.style.marginBottom = '4px';
          loggedInfo.appendChild(emailLabel);
          
          const emailText = document.createElement('div');
          emailText.textContent = currentUser.email || 'Utilisateur connecté';
          emailText.style.fontWeight = 'bold';
          emailText.style.fontSize = '1.1rem';
          emailText.style.color = '#60a5fa';
          loggedInfo.appendChild(emailText);
          
          m.appendChild(loggedInfo);
          
          const syncInfo = document.createElement('div');
          syncInfo.className = 'muted small';
          syncInfo.style.marginBottom = '20px';
          syncInfo.style.lineHeight = '1.5';
          syncInfo.innerHTML = '✅ Vos progrès sont automatiquement synchronisés.<br>Connectez-vous sur un autre appareil pour retrouver vos données.';
          m.appendChild(syncInfo);

          const actions = document.createElement('div');
          actions.style.display = 'flex';
          actions.style.gap = '8px';
          actions.style.justifyContent = 'flex-end';

          const closeBtn = document.createElement('button');
          closeBtn.className = 'secondary';
          closeBtn.textContent = 'Fermer';
          closeBtn.addEventListener('click', ()=> ov.remove());

          const logoutBtn = document.createElement('button');
          logoutBtn.textContent = 'Se déconnecter';
          logoutBtn.style.background = 'var(--danger, #dc3545)';
          logoutBtn.addEventListener('click', async ()=>{
            if(confirm('Êtes-vous sûr de vouloir vous déconnecter ?')){
              await logoutAndSync();
              ov.remove();
            }
          });

          actions.appendChild(closeBtn);
          actions.appendChild(logoutBtn);
          m.appendChild(actions);
        } else {
          // User is not logged in - show login form
          const info = document.createElement('div');
          info.className = 'muted small';
          info.style.marginBottom = '16px';
          info.style.lineHeight = '1.5';
          info.textContent = 'Connectez-vous ou créez un compte pour synchroniser vos progrès sur tous vos appareils.';
          m.appendChild(info);

          const form = document.createElement('div');
          form.style.display = 'grid';
          form.style.gridTemplateColumns = '1fr';
          form.style.gap = '12px';

          const email = document.createElement('input');
          email.id = 'syncEmail';
          email.name = 'email';
          email.type = 'email';
          email.placeholder = 'Email';
          email.style.padding = '12px';
          email.style.fontSize = '1rem';
          email.style.borderRadius = '8px';
          email.style.border = '1px solid var(--border, #ddd)';
          email.required = true;
          email.autocomplete = 'email';
          form.appendChild(email);

          const passWrap = document.createElement('div');
          passWrap.style.display = 'flex';
          passWrap.style.gap = '8px';

          const password = document.createElement('input');
          password.id = 'syncPassword';
          password.name = 'password';
          password.type = 'password';
          password.placeholder = 'Mot de passe (min 6 caractères)';
          password.style.padding = '12px';
          password.style.fontSize = '1rem';
          password.style.flex = '1';
          password.style.borderRadius = '8px';
          password.style.border = '1px solid var(--border, #ddd)';
          password.required = true;
          password.autocomplete = 'current-password';
          passWrap.appendChild(password);

          const toggle = document.createElement('button');
          toggle.className = 'secondary';
          toggle.textContent = '👁️';
          toggle.title = 'Afficher/Masquer';
          toggle.style.padding = '12px 16px';
          toggle.addEventListener('click', (e)=>{ e.preventDefault(); password.type = (password.type==='password'?'text':'password'); });
          passWrap.appendChild(toggle);

          form.appendChild(passWrap);

          const status = document.createElement('div');
          status.className = 'muted small';
          status.style.minHeight = '20px';
          status.style.color = 'var(--danger, #dc3545)';
          status.style.fontWeight = '500';
          form.appendChild(status);

          m.appendChild(form);

          const actions = document.createElement('div');
          actions.style.display = 'flex';
          actions.style.gap = '8px';
          actions.style.justifyContent = 'space-between';
          actions.style.marginTop = '20px';

          const closeBtn = document.createElement('button');
          closeBtn.className = 'secondary';
          closeBtn.textContent = 'Fermer';

          const btnGroup = document.createElement('div');
          btnGroup.style.display = 'flex';
          btnGroup.style.gap = '8px';

          const createBtn = document.createElement('button');
          createBtn.className = 'secondary';
          createBtn.textContent = 'Créer un compte';
          
          const loginBtn = document.createElement('button');
          loginBtn.textContent = 'Se connecter';

          function setBusy(b){ 
            createBtn.disabled=b; 
            loginBtn.disabled=b; 
            email.disabled=b; 
            password.disabled=b; 
            toggle.disabled=b;
            closeBtn.disabled=b;
          }
          
          function validate(){
            const em = (email.value||'').trim();
            const pw = (password.value||'').trim();
            if(!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { status.textContent = '⚠️ Email invalide'; return null; }
            if(!pw || pw.length < 6){ status.textContent = '⚠️ Mot de passe trop court (min 6 caractères)'; return null; }
            status.textContent = '';
            return { em, pw };
          }

          createBtn.addEventListener('click', async ()=>{
            const v = validate(); if(!v) return; 
            setBusy(true); 
            status.textContent = '⏳ Création du compte...';
            status.style.color = 'var(--muted)';
            try{
              await createAccountAndSync(v.em, v.pw);
              ov.remove();
            }catch(e){ 
              status.textContent = '❌ ' + (e?.message||e);
              status.style.color = 'var(--danger, #dc3545)';
            } finally { 
              setBusy(false);
            }
          });

          loginBtn.addEventListener('click', async ()=>{
            const v = validate(); if(!v) return; 
            setBusy(true); 
            status.textContent = '⏳ Connexion...';
            status.style.color = 'var(--muted)';
            try{
              await loginAndSync(v.em, v.pw);
              ov.remove();
            }catch(e){ 
              status.textContent = '❌ ' + (e?.message||e);
              status.style.color = 'var(--danger, #dc3545)';
            } finally { 
              setBusy(false);
            }
          });

          closeBtn.addEventListener('click', ()=> ov.remove());
          ov.addEventListener('click', (ev)=>{ if(ev.target === ov) ov.remove(); });

          btnGroup.appendChild(createBtn);
          btnGroup.appendChild(loginBtn);
          actions.appendChild(closeBtn);
          actions.appendChild(btnGroup);
          m.appendChild(actions);

          // Focus email by default
          setTimeout(()=> email.focus(), 50);
        }

        ov.appendChild(m);
        document.body.appendChild(ov);
      }catch(e){ 
        alert('❌ Erreur lors de l\'affichage du formulaire:\n\n' + (e?.message || String(e)));
      }
    }

    // Debounced snapshot + save on important local changes
    let __saveTimer = null;
    let __isSaving = false;
    function scheduleSave(){
      try{
        if(__isSaving) return; // Prevent loop during save
        if(__saveTimer) clearTimeout(__saveTimer);
        __saveTimer = setTimeout(async ()=>{
          __isSaving = true;
          try{
            const st = defaultUserState();
            await saveState(st);
          } finally {
            __isSaving = false;
          }
        }, 800);
      }catch(e){}
    }

    // Monkey-patch localStorage.setItem to schedule sync without touching existing logic
    (function(){
      try{
        const origSet = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(key, value){
          origSet(key, value);
          // Schedule save on our keys (but not during an active save)
          if(!__isSaving && (/^fabanki:/.test(key) || key === 'pseudo')){ scheduleSave(); }
        };
      }catch(e){ /* ignore */ }
    })();

    // Wire up Sync button
    const syncBtn = document.getElementById('syncBtn');
    if(syncBtn){
      syncBtn.addEventListener('click', ()=>{ 
        try{
          showSyncPopup();
        }catch(err){
          console.error('Sync button click error:', err);
          alert('❌ Erreur lors de l\'ouverture du formulaire de synchronisation:\n\n' + (err?.message || String(err)));
        }
      });
    }

    // Initialize on startup
    initUserState();
    // refresh periodically
    setInterval(()=>{ try{ updateProfilePopupIfOpen(); }catch(e){} }, 30*1000);

    // XP helpers
    function getXpTotal(){ return Number(localStorage.getItem('fabanki:xp_total') || 0); }
    function applyXp(delta){
      try{
        let total = getXpTotal();
        const prevLevel = computeLevelAndProgress(total).level;
        if(delta < 0){ if(total <= 0) return 0; const remove = Math.min(total, Math.abs(delta)); total -= remove; localStorage.setItem('fabanki:xp_total', total); return -remove; }
        total += delta; localStorage.setItem('fabanki:xp_total', total);
        try{ resetWeeklyIfNeeded(); const curWeekXp = Number(localStorage.getItem('fabanki:xp_semaine') || 0) + Math.max(0, delta); localStorage.setItem('fabanki:xp_semaine', String(curWeekXp)); }catch(e){}
        const newLevel = computeLevelAndProgress(total).level;
        // If level increased, show notification
        if(newLevel > prevLevel){ try{ showLevelUpNotification(newLevel, prevLevel); }catch(e){} }
        return delta;
      }catch(e){ return 0 }
    }

    function getDeckSection(){
      try{
        const u = (deckURL || '').toLowerCase(); const t = (deck.title || '').toLowerCase();
        const s = u || t;
        if(!s) return '';
        if(s.includes('math')) return 'maths';
        if(s.includes('phys')) return 'physique';
        if(s.includes('sciences') || s.includes('industri')) return 'si';
        if(s.includes('informat')) return 'info';
        if(s.includes('anglais')) return 'anglais';
        if(s.includes('fran')) return 'francais';
        return '';
      }catch(e){ return '' }
    }

    // === CREDIT SYSTEM ===
    function getCredits(){ return Number(localStorage.getItem('fabanki:credits') || 0); }
    function addCredits(amount){
      try{
        if(amount <= 0) return 0;
        let total = getCredits() + amount;
        localStorage.setItem('fabanki:credits', String(total));
        return amount;
      }catch(e){ return 0 }
    }
    
    // === MISSIONS SYSTEM ===
    const missionsData = {
      daily: [
        { id: 'study_20', name: 'Réviser 20 cartes aujourd\'hui', type: 'cards', target: 20, goal: 20, reward: { xp: 50, credits: 5 }, difficulty: 'easy' },
        { id: 'session_1', name: 'Compléter une session d\'étude', type: 'sessions', target: 1, goal: 1, reward: { xp: 40, credits: 4 }, difficulty: 'easy' },
        { id: 'accuracy_70', name: 'Atteindre 70% de précision', type: 'accuracy', target: 70, goal: 70, reward: { xp: 50, credits: 5 }, difficulty: 'easy' },
        { id: 'study_10m', name: 'Réviser au moins 10 minutes', type: 'time', target: 10, goal: 10, reward: { xp: 40, credits: 4 }, difficulty: 'easy' },
        { id: 'review_1', name: 'Réviser au moins un deck', type: 'decks', target: 1, goal: 1, reward: { xp: 40, credits: 4 }, difficulty: 'easy' },
        { id: 'study_50', name: 'Réviser 50 cartes aujourd\'hui', type: 'cards', target: 50, goal: 50, reward: { xp: 100, credits: 10 }, difficulty: 'medium' },
        { id: 'accuracy_80', name: 'Atteindre 80% de précision', type: 'accuracy', target: 80, goal: 80, reward: { xp: 120, credits: 12 }, difficulty: 'medium' },
        { id: 'no_overdue', name: 'Terminer sans cartes en retard', type: 'overdue', target: 0, goal: 1, reward: { xp: 130, credits: 15 }, difficulty: 'medium' },
        { id: 'session_2', name: 'Faire deux sessions séparées', type: 'sessions', target: 2, goal: 2, reward: { xp: 100, credits: 10 }, difficulty: 'medium' },
        { id: 'backlog_20', name: 'Réduire le retard de 20%', type: 'backlog', target: 20, goal: 20, reward: { xp: 140, credits: 16 }, difficulty: 'medium' },
        { id: 'study_100', name: 'Réviser 100 cartes aujourd\'hui', type: 'cards', target: 100, goal: 100, reward: { xp: 200, credits: 25 }, difficulty: 'hard' },
        { id: 'accuracy_90', name: 'Atteindre 90% de précision', type: 'accuracy_high', target: 90, goal: 90, reward: { xp: 220, credits: 28 }, difficulty: 'hard' },
        { id: 'perfect_day', name: 'Journée parfaite: 0 retard + 80%', type: 'perfect', target: 80, goal: 100, reward: { xp: 250, credits: 30 }, difficulty: 'hard' },
        { id: 'study_45m', name: 'Réviser au moins 45 minutes', type: 'time', target: 45, goal: 45, reward: { xp: 220, credits: 25 }, difficulty: 'hard' },
        { id: 'backlog_50', name: 'Réduire le retard de 50%', type: 'backlog', target: 50, goal: 50, reward: { xp: 260, credits: 32 }, difficulty: 'hard' }
      ],
      weekly: [
        { id: 'study_4days', name: 'Réviser 4 jours différents', type: 'days_active', target: 4, goal: 4, reward: { xp: 300, credits: 30 }, difficulty: 'easy' },
        { id: 'study_300', name: 'Réviser 300 cartes cette semaine', type: 'cards', target: 300, goal: 300, reward: { xp: 320, credits: 35 }, difficulty: 'easy' },
        { id: 'accuracy_75w', name: 'Atteindre 75% de précision moyenne', type: 'avg_accuracy', target: 75, goal: 75, reward: { xp: 300, credits: 30 }, difficulty: 'easy' },
        { id: 'no_overdue_3', name: 'Terminer 3 jours sans retard', type: 'perfect_days', target: 3, goal: 3, reward: { xp: 350, credits: 40 }, difficulty: 'easy' },
        { id: 'study_6days', name: 'Réviser 6 jours différents', type: 'days_active', target: 6, goal: 6, reward: { xp: 500, credits: 60 }, difficulty: 'medium' },
        { id: 'study_600', name: 'Réviser 600 cartes cette semaine', type: 'cards', target: 600, goal: 600, reward: { xp: 520, credits: 65 }, difficulty: 'medium' },
        { id: 'accuracy_85w', name: 'Atteindre 85% de précision moyenne', type: 'avg_accuracy', target: 85, goal: 85, reward: { xp: 550, credits: 70 }, difficulty: 'medium' },
        { id: 'backlog_50w', name: 'Réduire le retard de 50%', type: 'backlog', target: 50, goal: 50, reward: { xp: 580, credits: 75 }, difficulty: 'medium' },
        { id: 'week_no_overdue', name: 'Terminer la semaine sans retard', type: 'overdue', target: 0, goal: 1, reward: { xp: 600, credits: 80 }, difficulty: 'medium' },
        { id: 'study_7days', name: 'Réviser tous les jours', type: 'days_active', target: 7, goal: 7, reward: { xp: 700, credits: 100 }, difficulty: 'hard' },
        { id: 'study_1000', name: 'Réviser 1 000 cartes', type: 'cards', target: 1000, goal: 1000, reward: { xp: 750, credits: 110 }, difficulty: 'hard' },
        { id: 'accuracy_90w', name: 'Atteindre 90% de précision', type: 'avg_accuracy', target: 90, goal: 90, reward: { xp: 800, credits: 120 }, difficulty: 'hard' },
        { id: 'consecutive_7', name: 'Zéro retard pendant 7 jours', type: 'consecutive_perfect', target: 7, goal: 7, reward: { xp: 850, credits: 130 }, difficulty: 'hard' },
        { id: 'study_5h', name: 'Réviser au moins 5 heures', type: 'time', target: 300, goal: 300, reward: { xp: 780, credits: 115 }, difficulty: 'hard' }
      ]
    };
    
    function initializeMissions(){
      try{
        const today = new Date().toISOString().split('T')[0];
        const savedDate = localStorage.getItem('fabanki:missions_date');
        
        // Reset daily missions if date changed
        if(savedDate !== today){
          localStorage.setItem('fabanki:missions_date', today);
          localStorage.setItem('fabanki:daily_missions', JSON.stringify(
            missionsData.daily.map(m => ({ id: m.id, completed: false, progress: 0 }))
          ));
          // Reset daily selected missions
          localStorage.removeItem('fabanki:daily_selected_missions');
        }
        
        // Initialize weekly missions if needed
        if(!localStorage.getItem('fabanki:weekly_missions')){
          localStorage.setItem('fabanki:weekly_missions', JSON.stringify(
            missionsData.weekly.map(m => ({ id: m.id, completed: false, progress: 0 }))
          ));
          // Reset weekly selected missions
          localStorage.removeItem('fabanki:weekly_selected_missions');
        }
      }catch(e){ console.warn('initializeMissions error:', e) }
    }
    
    function updateMissionProgress(){
      try{
        const stats = getProfileStats();
        const dailyKey = 'fabanki:daily_missions';
        const weeklyKey = 'fabanki:weekly_missions';
        const dailyMissions = JSON.parse(localStorage.getItem(dailyKey) || '[]');
        const weeklyMissions = JSON.parse(localStorage.getItem(weeklyKey) || '[]');
        
        // Helper to update a mission's progress
        const updateMission = (missions, missionId, progress) => {
          const mission = missions.find(m => m.id === missionId);
          if(!mission) return false;
          mission.progress = progress;
          // Auto-complete if target reached
          const missionData = [...missionsData.daily, ...missionsData.weekly].find(m => m.id === missionId);
          if(missionData && progress >= missionData.target && !mission.completed){
            mission.completed = true;
            // Grant rewards
            if(!mission.rewards_given){
              applyXp(missionData.reward.xp);
              addCredits(missionData.reward.credits);
              mission.rewards_given = true;
              // Show toast
              const toast = document.createElement('div');
              toast.style.position = 'fixed';
              toast.style.top = '50%';
              toast.style.left = '50%';
              toast.style.transform = 'translate(-50%, -50%)';
              toast.style.background = '#22c55e';
              toast.style.color = 'white';
              toast.style.padding = '16px 32px';
              toast.style.borderRadius = '8px';
              toast.style.fontWeight = '600';
              toast.style.zIndex = '9999';
              toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              toast.textContent = '✅ Quête remplie: ' + missionData.name;
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 3000);
            }
          }
          return true;
        };
        
          // Get today's and this week's card counts
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        let todayCards = 0, weekCards = 0;
        
        for(const k of Object.keys(localStorage)){
          if(!k.includes(':card:')) continue;
          try{
            const st = JSON.parse(localStorage.getItem(k) || '{}');
            if(st && st.last){
              const d = new Date(st.last);
              if(d.toDateString() === now.toDateString()) todayCards++;
              if(d >= weekStart) weekCards++;
            }
          }catch(e){}
        }
        
        // Update daily missions with today's cards
        updateMission(dailyMissions, 'study_20', todayCards);
        updateMission(dailyMissions, 'study_50', todayCards);
        updateMission(dailyMissions, 'study_100', todayCards);
        
        // Update weekly missions with this week's cards
        updateMission(weeklyMissions, 'study_300', weekCards);
        updateMission(weeklyMissions, 'study_600', weekCards);
        updateMission(weeklyMissions, 'study_1000', weekCards);
        
        // Update streak mission
        const streakCount = Number(localStorage.getItem('fabanki:streak_current') || 0);
        updateMission(dailyMissions, 'streak_7', Math.min(streakCount, 7));
        updateMission(weeklyMissions, 'consecutive_7', Math.min(streakCount, 7));
        
        // For time spent - track from review sessions
        try{
          const timeSpent = Number(localStorage.getItem('fabanki:time_spent_today') || 0);
          updateMission(dailyMissions, 'study_10m', timeSpent);
          updateMission(dailyMissions, 'study_45m', timeSpent);
          
          const timeSpentWeek = Number(localStorage.getItem('fabanki:time_spent_week') || 0);
          updateMission(weeklyMissions, 'study_5h', timeSpentWeek);
        
                // For backlog reduction missions
                try{
                  // Count current overdue cards
                  let currentOverdue = 0;
                  const todayStart = new Date();
                  todayStart.setHours(0, 0, 0, 0);
          
                  for(const k of Object.keys(localStorage)){
                    if(!k.includes(':card:')) continue;
                    try{
                      const st = JSON.parse(localStorage.getItem(k) || '{}');
                      if(st && st.due){
                        const due = new Date(st.due);
                        if(due < todayStart) currentOverdue++;
                      }
                    }catch(e){}
                  }
          
                  // Get or set initial overdue count for today
                  const initialKey = 'fabanki:backlog_initial_' + new Date().toISOString().split('T')[0];
                  let initialOverdue = Number(localStorage.getItem(initialKey) || 0);
          
                  if(initialOverdue === 0 && currentOverdue > 0){
                    // First time checking today, set the baseline
                    initialOverdue = currentOverdue;
                    localStorage.setItem(initialKey, String(initialOverdue));
                  }
          
                  // Calculate reduction percentage
                  const reductionPercent = initialOverdue > 0 ? Math.round(((initialOverdue - currentOverdue) / initialOverdue) * 100) : 0;
          
                  // Update backlog missions with the reduction percentage
                  updateMission(dailyMissions, 'backlog_20', Math.max(0, reductionPercent));
                  updateMission(dailyMissions, 'backlog_50', Math.max(0, reductionPercent));
                  updateMission(weeklyMissions, 'backlog_50w', Math.max(0, reductionPercent));
                }catch(e){ console.warn('backlog tracking error:', e) }
        }catch(e){}
        
        // Save updated missions
        localStorage.setItem(dailyKey, JSON.stringify(dailyMissions));
        localStorage.setItem(weeklyKey, JSON.stringify(weeklyMissions));
      }catch(e){ console.warn('updateMissionProgress error:', e) }
    }
    
    function getMissions(type = 'daily'){
      try{
        initializeMissions();
        updateMissionProgress(); // Auto-update progress based on stats
        const key = type === 'daily' ? 'fabanki:daily_missions' : 'fabanki:weekly_missions';
        const saved = JSON.parse(localStorage.getItem(key) || '[]');
        const data = type === 'daily' ? missionsData.daily : missionsData.weekly;
        
        return data.map(mission => {
          const completedData = saved.find(s => s.id === mission.id);
          return { ...mission, completed: completedData?.completed || false, progress: completedData?.progress || 0 };
        });
      }catch(e){ return [] }
    }
    
    function completeMission(missionId, type = 'daily'){
      try{
        const key = type === 'daily' ? 'fabanki:daily_missions' : 'fabanki:weekly_missions';
        const missions = JSON.parse(localStorage.getItem(key) || '[]');
        const mission = missions.find(m => m.id === missionId);
        if(!mission) return;
        
        mission.completed = true;
        localStorage.setItem(key, JSON.stringify(missions));
        
        // Grant rewards
        const missionData = missionsData[type].find(m => m.id === missionId);
        if(missionData && !mission.rewards_given){
          applyXp(missionData.reward.xp);
          addCredits(missionData.reward.credits);
          mission.rewards_given = true;
          localStorage.setItem(key, JSON.stringify(missions));
        }
      }catch(e){ console.warn('completeMission error:', e) }
    }
    
    function getMissionCompletionStats(type = 'daily'){
      try{
        const missions = getMissions(type);
        const difficulties = { easy: 0, medium: 0, hard: 0 };
        const completed = { easy: 0, medium: 0, hard: 0 };
        
        missions.forEach(m => {
          difficulties[m.difficulty]++;
          if(m.completed) completed[m.difficulty]++;
        });
        
        return {
          easy: { completed: completed.easy, total: difficulties.easy, pct: difficulties.easy > 0 ? Math.round((completed.easy / difficulties.easy) * 100) : 0 },
          medium: { completed: completed.medium, total: difficulties.medium, pct: difficulties.medium > 0 ? Math.round((completed.medium / difficulties.medium) * 100) : 0 },
          hard: { completed: completed.hard, total: difficulties.hard, pct: difficulties.hard > 0 ? Math.round((completed.hard / difficulties.hard) * 100) : 0 }
        };
      }catch(e){ return { easy: { completed: 0, total: 0, pct: 0 }, medium: { completed: 0, total: 0, pct: 0 }, hard: { completed: 0, total: 0, pct: 0 } } }
    }

    // --- CUSTOMIZATION MODAL ---
    function showCustomizationModal() {
      try {
        // Remove any existing overlay first
        const existing = document.getElementById('customizationOverlay');
        if (existing) existing.remove();
        
        const overlay = document.createElement('div');
        overlay.id = 'customizationOverlay';
        overlay.className = 'customization-overlay';
        overlay.style.display = 'flex';
        
        const modal = document.createElement('div');
        modal.className = 'customization-modal';
        
        // Get current level for unlocking features
        const stats = getProfileStats();
        const currentLevel = computeLevelAndProgress(stats.xpTotal || 0).level;
        
        const title = document.createElement('h3');
        title.textContent = 'Personnalisation du thème';
        modal.appendChild(title);
        
        // Get current settings
        const currentBgColor = localStorage.getItem('fabanki:bg_color') || '#f6f7fb';
        const currentPattern = localStorage.getItem('fabanki:bg_pattern') || 'none';
        const currentFont = localStorage.getItem('fabanki:font_family') || 'system';
        const currentCardColor = localStorage.getItem('fabanki:card_color') || 'default';
        const currentFontSize = localStorage.getItem('fabanki:font_size') || '1';
        const currentAnimation = localStorage.getItem('fabanki:popup_animation') || 'none';
        
        // Background color section
        const colorSection = document.createElement('div');
        colorSection.className = 'customization-section';
        const colorTitle = document.createElement('div');
        colorTitle.className = 'customization-section-title';
        colorTitle.textContent = 'Couleur de fond';
        colorSection.appendChild(colorTitle);
        
        const colors = [
          { name: 'Clair (défaut)', light: '#f6f7fb', dark: '#0f1115', level: 0 },
          { name: 'Bleu', light: '#e8f4f8', dark: '#0a1a2e', level: 5 },
          { name: 'Vert', light: '#e8f5e9', dark: '#0d2818', level: 5 },
          { name: 'Rose', light: '#fce4ec', dark: '#2a0e1f', level: 10, credit: 30 },
          { name: 'Jaune', light: '#fffde7', dark: '#332d00', level: 10 },
          { name: 'Pourpre', light: '#f3e5f5', dark: '#25071a', level: 15 },
          { name: 'Cyan', light: '#e0f7fa', dark: '#0d1b1f', level: 20, credit: 40 },
          { name: 'Orange', light: '#ffe0b2', dark: '#2d1b0a', level: 20 },
          { name: 'Menthe', light: '#e0f2f1', dark: '#0d1816', level: 25, credit: 50 },
          { name: 'Corail', light: '#ffebee', dark: '#2d0a0a', level: 25 },
          { name: 'Lavande', light: '#f3e5f5', dark: '#2a0e3a', level: 30 },
          { name: 'Pêche', light: '#ffd7a8', dark: '#3a1f0a', level: 30, credit: 60 },
          { name: 'Turquoise', light: '#b2dfdb', dark: '#0d3a35', level: 35 },
          { name: 'Gradient Doré', light: 'linear-gradient(135deg, #ffecb3 0%, #ffcc80 100%)', dark: 'linear-gradient(135deg, #3d2d00 0%, #4d2600 100%)', level: 35, credit: 80 },
          { name: 'Gradient Rose-Vert', light: 'linear-gradient(135deg, #f8bbd0 0%, #a5d6a7 100%)', dark: 'linear-gradient(135deg, #4a0e2a 0%, #1d3a1f 100%)', level: 40 },
          { name: 'Gradient Prisma', light: 'linear-gradient(135deg, #e8f4f8 0%, #fce4ec 50%, #f3e5f5 100%)', dark: 'linear-gradient(135deg, #0a1a2e 0%, #2a0e1f 50%, #25071a 100%)', level: 45 },
          { name: 'Gradient Bleu Royal', light: 'linear-gradient(135deg, #64b5f6 0%, #e3f2fd 100%)', dark: 'linear-gradient(135deg, #0a2558 0%, #1a2a3a 100%)', level: 45 },
          { name: 'Gradient Aurora', light: 'linear-gradient(135deg, #e0f2f1 0%, #fffde7 50%, #ffebee 100%)', dark: 'linear-gradient(135deg, #0d1816 0%, #332d00 50%, #2d0a0a 100%)', level: 48 },
          { name: 'Gradient Océan', light: 'linear-gradient(135deg, #e0f7fa 0%, #e3f2fd 100%)', dark: 'linear-gradient(135deg, #0d1b1f 0%, #1a2a3a 100%)', level: 50 },
          { name: 'Gradient Forêt', light: 'linear-gradient(135deg, #e8f5e9 0%, #e0f2f1 100%)', dark: 'linear-gradient(135deg, #1b2d1f 0%, #0d1816 100%)', level: 50 }
        ];
        
        const colorGrid = document.createElement('div');
        colorGrid.className = 'color-grid';
        
        colors.forEach(color => {
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          const colorValue = isDark ? color.dark : color.light;
          const currentCredits = getCredits ? getCredits() : Number(localStorage.getItem('fabanki:credits') || 0);
          
          // Check if locked by level or credit
          const isLockedByLevel = color.level > currentLevel;
          const isLockedByCredit = color.credit && color.credit > currentCredits;
          const isLocked = isLockedByLevel || isLockedByCredit;
          
          const colorOption = document.createElement('div');
          colorOption.className = 'color-option';
          colorOption.style.backgroundColor = colorValue;
          
          // Set title with unlock requirement
          if (isLocked) {
            if (isLockedByLevel) {
              colorOption.title = `${color.name} (Niveau ${color.level})`;
            } else if (isLockedByCredit) {
              colorOption.title = `${color.name} (${color.credit} Credits)`;
            }
          } else {
            colorOption.title = color.name;
          }
          
          if (isLocked) {
            colorOption.style.opacity = '0.4';
            colorOption.style.cursor = 'not-allowed';
            // Show lock with cost below
            const lockHTML = '<div style="font-size:1.5rem;line-height:1">🔒</div>';
            const costHTML = isLockedByCredit ? `<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">${color.credit}💳</div>` : '';
            colorOption.innerHTML = lockHTML + costHTML;
          }
          
          if (colorValue === currentBgColor) {
            colorOption.classList.add('selected');
          }
          
          if (!isLocked) {
            colorOption.addEventListener('click', () => {
              document.querySelectorAll('.color-option').forEach(c => c.classList.remove('selected'));
              colorOption.classList.add('selected');
              
              // Deduct credits if needed
              if (color.credit && currentCredits > 0) {
                addCredits(-color.credit);
              }
              
              localStorage.setItem('fabanki:bg_color', colorValue);
              localStorage.setItem('fabanki:current_color_name', color.name);
              applyCustomization();
            });
          }
          
          colorGrid.appendChild(colorOption);
        });
        
        colorSection.appendChild(colorGrid);
        modal.appendChild(colorSection);
        
        // Background pattern section
        const patternSection = document.createElement('div');
        patternSection.className = 'customization-section';
        const patternTitle = document.createElement('div');
        patternTitle.className = 'customization-section-title';
        patternTitle.textContent = 'Motif de fond';
        patternSection.appendChild(patternTitle);
        
        const patterns = [
          { name: 'Aucun', id: 'none', pattern: 'none', level: 0 },
          { name: 'Points', id: 'dots', pattern: 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)', level: 5 },
          { name: 'Grille', id: 'grid', pattern: 'linear-gradient(0deg, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)', level: 10, credit: 25 },
          { name: 'Rayures', id: 'stripes', pattern: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.02) 10px, rgba(0,0,0,0.02) 20px)', level: 15 },
          { name: 'Zigzag', id: 'zigzag', pattern: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 2px, transparent 2px, transparent 8px)', level: 20 },
          { name: 'Vagues', id: 'waves', pattern: 'repeating-radial-gradient(circle at 0 0, rgba(0,0,0,0.02) 0, rgba(0,0,0,0.02) 2px, transparent 2px, transparent 40px)', level: 30, credit: 35 },
          { name: 'Hexagone', id: 'hexagon', pattern: 'radial-gradient(circle at 20px 20px, rgba(0,0,0,0.04) 8px, transparent 8px)', level: 25 },
          { name: 'Carrés', id: 'squares', pattern: 'linear-gradient(45deg, rgba(0,0,0,0.03) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.03) 75%, rgba(0,0,0,0.03))', level: 35, credit: 45 },
          { name: 'Croix', id: 'cross', pattern: 'linear-gradient(0deg, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)', level: 28 },
          { name: 'Chevrons', id: 'chevron', pattern: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.02), rgba(0,0,0,0.02) 2px, transparent 2px, transparent 8px, rgba(0,0,0,0.02) 8px, rgba(0,0,0,0.02) 10px, transparent 10px, transparent 16px)', level: 32, credit: 40 },
          { name: 'Cercles', id: 'circles', pattern: 'radial-gradient(circle, rgba(0,0,0,0.05) 2px, transparent 2px)', level: 38 },
          { name: 'Mailles', id: 'mesh', pattern: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px)', level: 22 },
          { name: 'Losange', id: 'diamond', pattern: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(0,0,0,0.04) 35px, rgba(0,0,0,0.04) 70px)', level: 24 },
          { name: 'Spirale', id: 'spiral', pattern: 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(0,0,0,0.02) 0deg 10deg, transparent 10deg 20deg)', level: 26 },
          { name: 'Cible', id: 'target', pattern: 'radial-gradient(circle, rgba(0,0,0,0.06) 3px, transparent 3px, transparent 12px, rgba(0,0,0,0.03) 12px, transparent 12px)', level: 29 },
          { name: 'Écailles', id: 'scales', pattern: 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(0,0,0,0.04) 50%, transparent 51%)', level: 31 },
          { name: 'Feuilles', id: 'leaves', pattern: 'radial-gradient(ellipse 30% 60% at 20% 50%, rgba(0,0,0,0.03) 50%, transparent 51%)', level: 33 },
          { name: 'Triangles', id: 'triangles', pattern: 'linear-gradient(135deg, rgba(0,0,0,0.03) 25%, transparent 25%), linear-gradient(225deg, rgba(0,0,0,0.03) 25%, transparent 25%), linear-gradient(315deg, rgba(0,0,0,0.03) 25%, transparent 25%), linear-gradient(45deg, rgba(0,0,0,0.03) 25%, transparent 25%)', level: 36 },
          { name: 'Nid d\'abeille', id: 'honeycomb', pattern: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 10px)', level: 37 },
          { name: 'Pluie', id: 'rain', pattern: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(0,0,0,0.01) 8px, rgba(0,0,0,0.01) 16px)', level: 39 },
          { name: 'Toile d\'araignée', id: 'web', pattern: 'repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg 5deg, rgba(0,0,0,0.02) 5deg 10deg)', level: 41 },
          { name: '42', id: 'fortytwo', pattern: `
    repeating-linear-gradient(
      45deg,
      rgba(102,160,255,0.18) 0,
      rgba(102,160,255,0.18) 2px,
      transparent 2px,
      transparent 24px
    )
  `, level: 42 }
        ];
        
        const patternGrid = document.createElement('div');
        patternGrid.className = 'pattern-grid';
        
        patterns.forEach(p => {
          const currentCredits = getCredits ? getCredits() : Number(localStorage.getItem('fabanki:credits') || 0);
          const isLockedByLevel = p.level > currentLevel;
          const isLockedByCredit = p.credit && p.credit > currentCredits;
          const isLocked = isLockedByLevel || isLockedByCredit;
          
          const patternOption = document.createElement('div');
          patternOption.className = 'pattern-option';
          
          // Set title with unlock requirement
          if (isLocked) {
            if (isLockedByLevel) {
              patternOption.title = `${p.name} (Niveau ${p.level})`;
            } else if (isLockedByCredit) {
              patternOption.title = `${p.name} (${p.credit} Credits)`;
            }
          } else {
            patternOption.title = p.name;
          }
          
          if (isLocked) {
            patternOption.style.opacity = '0.4';
            patternOption.style.cursor = 'not-allowed';
            // Show lock with cost below
            const lockHTML = '<div style="font-size:1.5rem;line-height:1">🔒</div>';
            const costHTML = isLockedByCredit ? `<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">${p.credit}💳</div>` : '';
            patternOption.innerHTML = lockHTML + costHTML;
          } else {
            if (p.pattern !== 'none') {
              const bgColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#0f1115' : '#f6f7fb';
              patternOption.style.backgroundImage = p.pattern;
              patternOption.style.backgroundColor = bgColor;
            }
            patternOption.textContent = p.name;
          }
          
          if (p.id === currentPattern) {
            patternOption.classList.add('selected');
          }
          
          if (!isLocked) {
            patternOption.addEventListener('click', () => {
              document.querySelectorAll('.pattern-option').forEach(c => c.classList.remove('selected'));
              patternOption.classList.add('selected');
              
              // Deduct credits if needed
              if (p.credit && currentCredits > 0) {
                addCredits(-p.credit);
              }
              
              localStorage.setItem('fabanki:bg_pattern', p.id);
              applyCustomization();
            });
          }
          
          patternGrid.appendChild(patternOption);
        });
        
        patternSection.appendChild(patternGrid);
        modal.appendChild(patternSection);
        
        // Font section
        const fontSection = document.createElement('div');
        fontSection.className = 'customization-section';
        const fontTitle = document.createElement('div');
        fontTitle.className = 'customization-section-title';
        fontTitle.textContent = 'Police de caractère';
        fontSection.appendChild(fontTitle);
        
        const fonts = [
          { name: 'Classique (défaut)', id: 'system', stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial', level: 0 },
          { name: 'Élégant', id: 'elegant', stack: '"Georgia", "Times New Roman", serif', level: 5 },
          { name: 'Moderne', id: 'modern', stack: '"Inter", "Helvetica", "Arial", sans-serif', level: 10, credit: 30 },
          { name: 'Monospace', id: 'mono', stack: '"Courier New", "Monaco", monospace', level: 15 },
          { name: 'Lisible', id: 'readable', stack: '"Trebuchet MS", sans-serif', level: 20 },
          { name: 'Confortable', id: 'comfortable', stack: '"Segoe UI", "Tahoma", sans-serif', level: 25, credit: 35 },
          { name: 'Minimaliste', id: 'minimal', stack: '"Helvetica Neue", "Arial", sans-serif', level: 30 },
          { name: 'Littéraire', id: 'literary', stack: '"Cambria", "Palatino", serif', level: 35 },
          { name: 'Futuriste', id: 'futuristic', stack: '"Trebuchet MS", "Lucida Grande", sans-serif', level: 40, credit: 50 },
          { name: 'Manuscrit', id: 'script', stack: '"Comic Sans MS", "Brush Script MT", cursive', level: 45 }
        ];
        
        const fontGrid = document.createElement('div');
        fontGrid.className = 'font-grid';
        
        fonts.forEach(f => {
          const currentCredits = getCredits ? getCredits() : Number(localStorage.getItem('fabanki:credits') || 0);
          const isLockedByLevel = f.level > currentLevel;
          const isLockedByCredit = f.credit && f.credit > currentCredits;
          const isLocked = isLockedByLevel || isLockedByCredit;
          
          const fontOption = document.createElement('div');
          fontOption.className = 'font-option';
          
          // Set title with unlock requirement
          if (isLocked) {
            if (isLockedByLevel) {
              fontOption.title = `${f.name} (Niveau ${f.level})`;
            } else if (isLockedByCredit) {
              fontOption.title = `${f.name} (${f.credit} Credits)`;
            }
          } else {
            fontOption.title = f.name;
          }
          
          fontOption.textContent = f.name;
          fontOption.style.fontFamily = f.stack;
          
          if (isLocked) {
            fontOption.style.opacity = '0.4';
            fontOption.style.cursor = 'not-allowed';
            // Show lock with cost below
            const lockHTML = '<div style="font-size:1.5rem;line-height:1">🔒</div>';
            const costHTML = isLockedByCredit ? `<div style="font-size:0.6rem;color:var(--muted);margin-top:2px">${f.credit}💳</div>` : '';
            fontOption.innerHTML = lockHTML + costHTML;
          }
          
          if (f.id === currentFont) {
            fontOption.classList.add('selected');
          }
          
          if (!isLocked) {
            fontOption.addEventListener('click', () => {
              document.querySelectorAll('.font-option').forEach(c => c.classList.remove('selected'));
              fontOption.classList.add('selected');
              
              // Deduct credits if needed
              if (f.credit && currentCredits > 0) {
                addCredits(-f.credit);
              }
              
              localStorage.setItem('fabanki:font_family', f.id);
              localStorage.setItem('fabanki:font_stack', f.stack);
              applyCustomization();
            });
          }
          
          fontGrid.appendChild(fontOption);
        });
        
        fontSection.appendChild(fontGrid);
        modal.appendChild(fontSection);
        
        // Font size section
        const fontSizeSection = document.createElement('div');
        fontSizeSection.className = 'customization-section';
        const fontSizeTitle = document.createElement('div');
        fontSizeTitle.className = 'customization-section-title';
        fontSizeTitle.textContent = `Taille de police (${Math.round(currentFontSize * 100)}%)`;
        fontSizeSection.appendChild(fontSizeTitle);
        
        const fontSizeContainer = document.createElement('div');
        fontSizeContainer.style.display = 'flex';
        fontSizeContainer.style.gap = '10px';
        fontSizeContainer.style.alignItems = 'center';
        fontSizeContainer.style.padding = '10px 0';
        
        const fontSizeSlider = document.createElement('input');
        fontSizeSlider.type = 'range';
        fontSizeSlider.min = '0.8';
        fontSizeSlider.max = '1.5';
        fontSizeSlider.step = '0.05';
        fontSizeSlider.value = currentFontSize;
        fontSizeSlider.style.flex = '1';
        fontSizeSlider.style.cursor = 'pointer';
        
        const fontSizeValue = document.createElement('span');
        fontSizeValue.textContent = `${Math.round(currentFontSize * 100)}%`;
        fontSizeValue.style.minWidth = '50px';
        fontSizeValue.style.textAlign = 'right';
        
        fontSizeSlider.addEventListener('input', (e) => {
          const size = parseFloat(e.target.value);
          localStorage.setItem('fabanki:font_size', size);
          document.documentElement.style.setProperty('--font-size', size + 'rem');
          fontSizeValue.textContent = `${Math.round(size * 100)}%`;
          fontSizeTitle.textContent = `Taille de police (${Math.round(size * 100)}%)`;
        });
        
        fontSizeContainer.appendChild(fontSizeSlider);
        fontSizeContainer.appendChild(fontSizeValue);
        fontSizeSection.appendChild(fontSizeContainer);
        modal.appendChild(fontSizeSection);
        
        // Card color section
        const cardColorSection = document.createElement('div');
        cardColorSection.className = 'customization-section';
        const cardColorTitle = document.createElement('div');
        cardColorTitle.className = 'customization-section-title';
        cardColorTitle.textContent = 'Couleur des cartes';
        cardColorSection.appendChild(cardColorTitle);
        
        const cardColors = [
          { name: 'Défaut', id: 'default', light: '#fff', dark: '#111319', level: 0 },
          { name: 'Bleu clair', id: 'lightblue', light: '#e3f2fd', dark: '#1a2a3a', level: 5 },
          { name: 'Vert clair', id: 'lightgreen', light: '#e8f5e9', dark: '#1b2d1f', level: 10 },
          { name: 'Rose clair', id: 'lightpink', light: '#fce4ec', dark: '#3a1f2e', level: 15 },
          { name: 'Amber', id: 'amber', light: '#fff8e1', dark: '#3a3000', level: 20 },
          { name: 'Indigo', id: 'indigo', light: '#e8eaf6', dark: '#1a1535', level: 25 },
          { name: 'Cyan', id: 'cyan', light: '#e0f7fa', dark: '#0d1b1f', level: 28 },
          { name: 'Orange pâle', id: 'pale_orange', light: '#ffe0b2', dark: '#2d1b0a', level: 22 },
          { name: 'Menthe', id: 'mint', light: '#e0f2f1', dark: '#0d1816', level: 30 },
          { name: 'Lavande', id: 'lavender', light: '#f3e5f5', dark: '#2a0e3a', level: 32 },
          { name: 'Pêche', id: 'peach', light: '#ffd7a8', dark: '#3a1f0a', level: 35 },
          { name: 'Ciel', id: 'sky', light: '#b3e5fc', dark: '#0a3a4a', level: 38 },
          { name: 'Turquoise', id: 'turquoise', light: '#b2dfdb', dark: '#0d3a35', level: 40 },
          { name: 'Or pâle', id: 'gold', light: '#ffecb3', dark: '#3d2d00', level: 42 },
          { name: 'Vert sapin', id: 'fir', light: '#a5d6a7', dark: '#1d3a1f', level: 45 },
          { name: 'Rose vif', id: 'hotpink', light: '#f8bbd0', dark: '#4a0e2a', level: 45 },
          { name: 'Bleu royal', id: 'royal', light: '#64b5f6', dark: '#0a2558', level: 48 },
          { name: 'Sunrise', id: 'sunrise', light: '#ffcc80', dark: '#4d2600', level: 50 },
          { name: 'Gradient Océan', id: 'gradient_ocean', light: 'linear-gradient(135deg, #e0f7fa 0%, #e3f2fd 100%)', dark: 'linear-gradient(135deg, #0d1b1f 0%, #1a2a3a 100%)', level: 55 },
          { name: 'Gradient Forêt', id: 'gradient_forest', light: 'linear-gradient(135deg, #e8f5e9 0%, #e0f2f1 100%)', dark: 'linear-gradient(135deg, #1b2d1f 0%, #0d1816 100%)', level: 55 }
        ];
        
        const cardColorGrid = document.createElement('div');
        cardColorGrid.className = 'color-grid';
        
        cardColors.forEach(color => {
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          const colorValue = isDark ? color.dark : color.light;
          const isLocked = color.level > currentLevel;
          
          const cardColorOption = document.createElement('div');
          cardColorOption.className = 'color-option';
          cardColorOption.setAttribute('data-card-color-option', '1');
          
          // Handle gradient colors
          if (colorValue.includes('gradient')) {
            cardColorOption.style.backgroundImage = colorValue;
            cardColorOption.style.backgroundColor = 'transparent';
          } else {
            cardColorOption.style.backgroundColor = colorValue;
          }
          
          cardColorOption.title = isLocked ? `${color.name} (Niveau ${color.level})` : color.name;
          
          if (isLocked) {
            cardColorOption.style.opacity = '0.4';
            cardColorOption.style.cursor = 'not-allowed';
            cardColorOption.innerHTML = '<span style="font-size:1.5rem">🔒</span>';
          }
          
          if (colorValue === currentCardColor) {
            cardColorOption.classList.add('selected');
          }
          
          if (!isLocked) {
            cardColorOption.addEventListener('click', () => {
              document.querySelectorAll('[data-card-color-option]').forEach(c => c.classList.remove('selected'));
              cardColorOption.classList.add('selected');
              // Store the actual color value (light or dark depending on current theme)
              localStorage.setItem('fabanki:card_color', colorValue);
              localStorage.setItem('fabanki:current_card_color_name', color.name);
              applyCustomization();
            });
          }
          
          cardColorOption.setAttribute('data-card-color-option', 'true');
          cardColorGrid.appendChild(cardColorOption);
        });
        
        cardColorSection.appendChild(cardColorGrid);
        modal.appendChild(cardColorSection);
        
        // Card pattern section (super transparent patterns)
        const cardPatternSection = document.createElement('div');
        cardPatternSection.className = 'customization-section';
        const cardPatternTitle = document.createElement('div');
        cardPatternTitle.className = 'customization-section-title';
        cardPatternTitle.textContent = 'Motif des cartes (très transparent)';
        cardPatternSection.appendChild(cardPatternTitle);
        
        const cardPatterns = [
          { name: 'Aucun', id: 'none', class: '', level: 0 },
          { name: 'Points', id: 'dots', class: 'card-pattern-dots', level: 10 },
          { name: 'Grille', id: 'grid', class: 'card-pattern-grid', level: 20 },
          { name: 'Rayures', id: 'stripes', class: 'card-pattern-stripes', level: 30 },
          { name: 'Zigzag', id: 'zigzag', class: 'card-pattern-zigzag', level: 40 },
          { name: 'Vagues', id: 'waves', class: 'card-pattern-waves', level: 50 }
        ];
        
        const cardPatternGrid = document.createElement('div');
        cardPatternGrid.className = 'pattern-grid';
        
        cardPatterns.forEach(p => {
          const isLocked = p.level > currentLevel;
          const patternOption = document.createElement('div');
          patternOption.className = 'pattern-option ' + p.class;
          patternOption.title = isLocked ? `${p.name} (Niveau ${p.level})` : p.name;
          
          if (isLocked) {
            patternOption.style.opacity = '0.4';
            patternOption.style.cursor = 'not-allowed';
            patternOption.innerHTML = '<span style="font-size:1.5rem">🔒</span>';
          } else {
            patternOption.textContent = p.name;
            patternOption.style.backgroundColor = document.documentElement.getAttribute('data-theme') === 'dark' ? '#111319' : '#fff';
          }
          
          const currentCardPattern = localStorage.getItem('fabanki:card_pattern') || 'none';
          if (p.id === currentCardPattern) {
            patternOption.classList.add('selected');
          }
          
          if (!isLocked) {
            patternOption.addEventListener('click', () => {
              document.querySelectorAll('.pattern-grid .pattern-option').forEach(c => c.classList.remove('selected'));
              patternOption.classList.add('selected');
              localStorage.setItem('fabanki:card_pattern', p.id);
              applyCardPattern();
            });
          }
          
          cardPatternGrid.appendChild(patternOption);
        });
        
        cardPatternSection.appendChild(cardPatternGrid);
        modal.appendChild(cardPatternSection);
        
        // Animations section
        const animationSection = document.createElement('div');
        animationSection.className = 'customization-section';
        const animationTitle = document.createElement('div');
        animationTitle.className = 'customization-section-title';
        animationTitle.textContent = 'Style d\'animations';
        animationSection.appendChild(animationTitle);
        
        const animations = [
          { name: 'Aucune', id: 'none', level: 0 },
          { name: 'Fondu', id: 'fade', level: 5 },
          { name: 'Glissade Bas', id: 'slidedown', level: 10 },
          { name: 'Glissade Haut', id: 'slideup', level: 15 },
          { name: 'Rebond', id: 'bounce', level: 20, credit: 25 },
          { name: 'Rotation', id: 'rotate', level: 25 },
          { name: 'Ressort', id: 'spring', level: 30, credit: 30 }
        ];
        
        const animationGrid = document.createElement('div');
        animationGrid.className = 'animation-grid';
        animationGrid.style.display = 'grid';
        animationGrid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
        animationGrid.style.gap = '8px';
        animationGrid.style.marginTop = '8px';
        
        animations.forEach(anim => {
          const currentCredits = getCredits ? getCredits() : Number(localStorage.getItem('fabanki:credits') || 0);
          const isLockedByLevel = anim.level > currentLevel;
          const isLockedByCredit = anim.credit && anim.credit > currentCredits;
          const isLocked = isLockedByLevel || isLockedByCredit;
          
          const animOption = document.createElement('div');
          animOption.className = 'animation-option';
          animOption.style.padding = '8px';
          animOption.style.borderRadius = '6px';
          animOption.style.cursor = isLocked ? 'not-allowed' : 'pointer';
          animOption.style.border = '2px solid transparent';
          animOption.style.textAlign = 'center';
          animOption.style.background = 'rgba(0,0,0,0.02)';
          animOption.style.transition = 'all 0.2s';
          
          animOption.title = isLocked ? (isLockedByLevel ? `${anim.name} (Niveau ${anim.level})` : `${anim.name} (${anim.credit} Credits)`) : anim.name;
          animOption.textContent = anim.name;
          
          if (isLocked) {
            animOption.style.opacity = '0.4';
            animOption.innerHTML = '<div style="font-size:1.5rem">🔒</div><div style="font-size:0.6rem;color:var(--muted);margin-top:2px">' + (isLockedByCredit ? anim.credit + '💳' : '') + '</div>';
          }
          
          if (anim.id === currentAnimation) {
            animOption.style.borderColor = 'var(--accent)';
            animOption.style.background = 'rgba(102, 160, 255, 0.1)';
          }
          
          if (!isLocked) {
            animOption.addEventListener('click', () => {
              document.querySelectorAll('.animation-option').forEach(opt => {
                opt.style.borderColor = 'transparent';
                opt.style.background = 'rgba(0,0,0,0.02)';
              });
              animOption.style.borderColor = 'var(--accent)';
              animOption.style.background = 'rgba(102, 160, 255, 0.1)';
              
              // Deduct credits if needed
              if (anim.credit && currentCredits > 0) {
                addCredits(-anim.credit);
              }
              
              localStorage.setItem('fabanki:popup_animation', anim.id);
            });
            animOption.addEventListener('mouseover', () => {
              if (anim.id !== currentAnimation) {
                animOption.style.opacity = '0.8';
              }
            });
            animOption.addEventListener('mouseout', () => {
              animOption.style.opacity = '1';
            });
          }
          
          animationGrid.appendChild(animOption);
        });
        
        animationSection.appendChild(animationGrid);
        modal.appendChild(animationSection);
        
        // Action buttons
        const actions = document.createElement('div');
        actions.className = 'customization-actions';
        
        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-btn';
        resetBtn.textContent = 'Réinitialiser';
        resetBtn.addEventListener('click', () => {
          localStorage.removeItem('fabanki:bg_color');
          localStorage.removeItem('fabanki:bg_pattern');
          localStorage.removeItem('fabanki:font_family');
          localStorage.removeItem('fabanki:font_stack');
          applyCustomization();
          overlay.remove();
        });
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.textContent = 'Fermer';
        closeBtn.addEventListener('click', () => overlay.remove());
        
        actions.appendChild(resetBtn);
        actions.appendChild(closeBtn);
        modal.appendChild(actions);
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Apply popup animation
        try {
          const anim = localStorage.getItem('fabanki:popup_animation') || 'none';
          if(anim !== 'none') modal.setAttribute('data-animation', anim);
        } catch(e) {}
        
        // Allow click outside to close
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) overlay.remove();
        });
        
      } catch (e) {
        console.warn('showCustomizationModal error:', e);
      }
    }
    
    function applyCustomization() {
      try {
        const root = document.documentElement;
        const bgColor = localStorage.getItem('fabanki:bg_color');
        const bgPattern = localStorage.getItem('fabanki:bg_pattern') || 'dots';
        const fontFamily = localStorage.getItem('fabanki:font_stack');
        
        if (bgColor) {
          root.style.setProperty('--bg', bgColor);
        }
        
        // Apply background pattern
        const patterns = {
          'none': 'none',
          'dots': 'radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)',
          'grid': 'linear-gradient(0deg, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
          'stripes': 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.02) 10px, rgba(0,0,0,0.02) 20px)',
          'zigzag': 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 2px, transparent 2px, transparent 8px)',
          'waves': 'repeating-radial-gradient(circle at 0 0, rgba(0,0,0,0.02) 0, rgba(0,0,0,0.02) 2px, transparent 2px, transparent 40px)',
          'hexagon': 'radial-gradient(circle at 20px 20px, rgba(0,0,0,0.04) 8px, transparent 8px)',
          'squares': 'linear-gradient(45deg, rgba(0,0,0,0.03) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.03) 75%, rgba(0,0,0,0.03))',
          'cross': 'linear-gradient(0deg, rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)',
          'chevron': 'repeating-linear-gradient(45deg, rgba(0,0,0,0.02), rgba(0,0,0,0.02) 2px, transparent 2px, transparent 8px, rgba(0,0,0,0.02) 8px, rgba(0,0,0,0.02) 10px, transparent 10px, transparent 16px)',
          'circles': 'radial-gradient(circle, rgba(0,0,0,0.05) 2px, transparent 2px)',
          'mesh': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px)',
          'diamond': 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(0,0,0,0.04) 35px, rgba(0,0,0,0.04) 70px)',
          'spiral': 'repeating-conic-gradient(from 0deg at 50% 50%, rgba(0,0,0,0.02) 0deg 10deg, transparent 10deg 20deg)',
          'target': 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.04) 5px, transparent 5px, transparent 15px, rgba(0,0,0,0.02) 15px, transparent 15px)',
          'scales': 'radial-gradient(ellipse 100% 50% at 50% 0%, rgba(0,0,0,0.04) 50%, transparent 51%)',
          'leaves': 'radial-gradient(ellipse 30% 60% at 20% 50%, rgba(0,0,0,0.03) 50%, transparent 51%)',
          'triangles': 'linear-gradient(135deg, rgba(0,0,0,0.03) 25%, transparent 25%), linear-gradient(225deg, rgba(0,0,0,0.03) 25%, transparent 25%), linear-gradient(315deg, rgba(0,0,0,0.03) 25%, transparent 25%), linear-gradient(45deg, rgba(0,0,0,0.03) 25%, transparent 25%)',
          'honeycomb': 'repeating-linear-gradient(0deg, rgba(0,0,0,0.02) 0px, rgba(0,0,0,0.02) 1px, transparent 1px, transparent 10px)',
          'rain': 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(0,0,0,0.01) 8px, rgba(0,0,0,0.01) 16px)',
          'web': 'repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg 5deg, rgba(0,0,0,0.02) 5deg 10deg)',
          'target': 'radial-gradient(circle, rgba(0,0,0,0.06) 3px, transparent 3px, transparent 12px, rgba(0,0,0,0.03) 12px, transparent 12px)',
          'fortytwo': 'repeating-linear-gradient(45deg, transparent 0, transparent calc(50% - 8px), rgba(102,160,255,0.12) calc(50% - 8px), rgba(102,160,255,0.12) calc(50% + 8px), transparent calc(50% + 8px), transparent 100%)'
        };
        
        const body = document.body;
        const html = document.documentElement;
        body.style.backgroundImage = patterns[bgPattern] || patterns['dots'];
        html.style.backgroundImage = patterns[bgPattern] || patterns['dots'];
        
        if (bgPattern !== 'none') {
          const bgSize = bgPattern === 'grid' ? '4px 4px' : 
                         bgPattern === 'dots' ? '4px 4px' :
                         bgPattern === 'stripes' ? 'auto' :
                         bgPattern === 'zigzag' ? 'auto' :
                         bgPattern === 'waves' ? 'auto' :
                         bgPattern === 'fortytwo' ? 'auto' :
                         'auto';
          body.style.backgroundSize = bgSize;
          html.style.backgroundSize = bgSize;
          body.style.backgroundAttachment = 'fixed';
          html.style.backgroundAttachment = 'fixed';
        }
        
        if (fontFamily) {
          root.style.setProperty('--font', fontFamily);
          document.body.style.fontFamily = fontFamily;
        }
        
        // Apply font size
        const fontSize = localStorage.getItem('fabanki:font_size') || '1';
        root.style.setProperty('--font-size', fontSize + 'rem');
        
        // Apply card color - handle gradient and theme-aware colors
        const cardColor = localStorage.getItem('fabanki:card_color');
        if (cardColor) {
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
          
          // Check if it's a gradient (contains 'linear-gradient' or similar)
          if (cardColor.includes('gradient')) {
            // Gradient colors are theme-aware (light gradient at start, dark at end)
            // Split by )/ pattern for dual gradients, otherwise use as-is
            let appliedGradient = cardColor;
            if (cardColor.includes(', light:') || cardColor.includes('), dark:')) {
              // Parse light/dark gradient pairs if stored that way
              const parts = cardColor.split('), ');
              if (parts.length >= 2) {
                appliedGradient = isDark ? parts[1] : parts[0];
              }
            }
            root.style.setProperty('--card', appliedGradient);
            document.querySelectorAll('.card').forEach(card => {
              card.style.backgroundImage = appliedGradient;
              card.style.backgroundColor = 'transparent';
            });
          } else {
            // Solid color
            root.style.setProperty('--card', cardColor);
            document.querySelectorAll('.card').forEach(card => {
              card.style.backgroundColor = cardColor;
              card.style.backgroundImage = 'none';
            });
          }
        }
        
        // Apply card patterns
        applyCardPattern();
        
      } catch (e) {
        console.warn('applyCustomization error:', e);
      }
    }
    
    // Load customization on page load and initialize theme properly
    try {
      // First ensure theme is properly set based on localStorage or user preference
      const savedTheme = localStorage.getItem('fabanki:theme') || 'light';
      const prefersLight = !window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = localStorage.getItem('fabanki:theme') || (prefersLight ? 'light' : 'dark');
      document.documentElement.setAttribute('data-theme', theme);
      const appEl = document.getElementById('app');
      if (appEl) appEl.setAttribute('data-theme', theme);
      
      // Initialize missions system
      initializeMissions();
      
      // Then apply customization
      applyCustomization();
      window.applyCustomization = applyCustomization;
      window.showCustomizationModal = showCustomizationModal;
    } catch (e) {}
    
    // Apply card pattern styling
    function applyCardPattern() {
      try {
        const cardPattern = localStorage.getItem('fabanki:card_pattern') || 'none';
        const cards = document.querySelectorAll('.card');
        const patternClasses = ['card-pattern-dots', 'card-pattern-grid', 'card-pattern-stripes', 'card-pattern-zigzag', 'card-pattern-waves'];
        
        cards.forEach(card => {
          // Remove all pattern classes
          patternClasses.forEach(cls => card.classList.remove(cls));
          
          // Add the new pattern class
          if (cardPattern !== 'none') {
            const patternMap = {
              'dots': 'card-pattern-dots',
              'grid': 'card-pattern-grid',
              'stripes': 'card-pattern-stripes',
              'zigzag': 'card-pattern-zigzag',
              'waves': 'card-pattern-waves'
            };
            if (patternMap[cardPattern]) {
              card.classList.add(patternMap[cardPattern]);
            }
          }
        });
      } catch (e) {
        console.warn('applyCardPattern error:', e);
      }
    }
    window.applyCardPattern = applyCardPattern;

    // --- SECURITY: Anti-cheat validation and data sanitization ---
    // This prevents console-based injection attacks by validating all user data
    // before storing to Firestore. Validates against reasonable game limits.
    function sanitizeAndValidateUserData(rawData) {
      try {
        // Reasonable limits based on normal gameplay:
        // - Max level ~60 (would require ~150k+ XP over months)
        // - Max MPSI score ~5000 (computed from reasonable stats)
        // - Max streak ~400 days (over a year)
        // - Max cards reviewed ~50k (very active player over months)
        
        const MAX_LEVEL = 60;
        const MAX_MPSI_SCORE = 5000;
        const MAX_STREAK = 400;
        const MAX_CARDS_REVIEWED = 50000;
        const MAX_MASTERED = 50000;
        const MAX_GOOD_ANSWERS = 100000;
        const MAX_XP = 500000;
        const MAX_XP_WEEK = 50000;
        const MAX_XP_SCORE_WEEK = 5000;
        const MAX_CONSECUTIVE_CORRECT = 1000;
        const MAX_CONSECUTIVE_NO_PASS = 1000;
        
        const sanitized = {};
        
        // String fields: validate type and length
        sanitized.Pseudo = String(rawData.Pseudo || 'Anonyme').slice(0, 50);
        sanitized['Niveau Prépa'] = String(rawData['Niveau Prépa'] || 'Débutant').slice(0, 50);
        
        // Numeric fields: coerce to number, validate range, cap at max
        const getValidNumber = (val, min = 0, max = Infinity) => {
          let n = Number(val) || 0;
          if (isNaN(n) || !isFinite(n)) n = 0;
          return Math.max(min, Math.min(max, n));
        };
        
        sanitized.XP = getValidNumber(rawData.XP, 0, MAX_XP);
        sanitized.Niveau = getValidNumber(rawData.Niveau, 1, MAX_LEVEL);
        sanitized['Cartes révisées'] = getValidNumber(rawData['Cartes révisées'], 0, MAX_CARDS_REVIEWED);
        sanitized['Bonnes réponses'] = getValidNumber(rawData['Bonnes réponses'], 0, MAX_GOOD_ANSWERS);
        sanitized['Ratés'] = getValidNumber(rawData['Ratés'], -1000, 100000);
        sanitized['Passer'] = getValidNumber(rawData['Passer'], -1000, 100000);
        sanitized['Streak_max'] = getValidNumber(rawData['Streak_max'], 0, MAX_STREAK);
        sanitized['Cartes maîtrisées'] = getValidNumber(rawData['Cartes maîtrisées'], 0, MAX_MASTERED);
        sanitized.Score_MPSI = getValidNumber(rawData.Score_MPSI, -10000, MAX_MPSI_SCORE);
        sanitized.XP_semaine = getValidNumber(rawData.XP_semaine, 0, MAX_XP_WEEK);
        sanitized.Score_MPSI_semaine = getValidNumber(rawData.Score_MPSI_semaine, -1000, MAX_XP_SCORE_WEEK);
        sanitized.Score_MPSI_mois = getValidNumber(rawData.Score_MPSI_mois, -1000, MAX_XP_SCORE_WEEK);
        
        // Arrays: validate and sanitize
        if (Array.isArray(rawData.Titres)) {
          sanitized.Titres = rawData.Titres.slice(0, 50).filter(t => t && typeof t === 'object').map(t => ({
            nom: String(t.nom || '').slice(0, 50),
            tier: getValidNumber(t.tier, 0, 5)
          }));
        } else {
          sanitized.Titres = [];
        }
        
        if (Array.isArray(rawData.Objectifs)) {
          sanitized.Objectifs = rawData.Objectifs.slice(0, 50).filter(o => typeof o === 'string').map(o => String(o).slice(0, 50));
        } else {
          sanitized.Objectifs = [];
        }
        
        if (Array.isArray(rawData.Badges)) {
          sanitized.Badges = rawData.Badges.slice(0, 10).filter(b => typeof b === 'string' && !b.toLowerCase().includes('cheat')).map(b => String(b).slice(0, 50));
        } else {
          sanitized.Badges = [];
        }
        
        // ISO timestamp validation
        sanitized['Dernière mise à jour'] = String(rawData['Dernière mise à jour'] || new Date().toISOString());
        sanitized['Dernière synchronisation'] = String(rawData['Dernière synchronisation'] || new Date().toISOString());
        
        // IDs
        sanitized.Semaine_ID = String(rawData.Semaine_ID || '');
        sanitized.Mois_ID = String(rawData.Mois_ID || '');
        
        return sanitized;
      } catch (e) {
        console.warn('sanitizeAndValidateUserData error:', e);
        return rawData; // fallback
      }
    }

    // --- Pseudo & Leaderboard (cloud sync) ---
    function generateUserId(){
      try{ if(window.crypto && crypto.getRandomValues){ const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a).map(b=>b.toString(16).padStart(2,'0')).join(''); } }catch(e){}
      return 'u-' + Date.now() + '-' + Math.floor(Math.random()*100000);
    }

    function ensurePseudo(){
      try{
        // Detect if app is opened in external/embedded browser
        const ua = navigator.userAgent || '';
        const isEmbedded = ua.includes('Instagram') || ua.includes('FBAN') || ua.includes('FBAV') || 
                          ua.includes('Snapchat') || ua.includes('Twitter') || ua.includes('Line');
        
        if(isEmbedded){
          // Try to open in default browser
          try{
            window.open(window.location.href, '_system');
          }catch(e){}
          // Skip pseudo requirement for embedded browsers
          return true;
        }
        
        let p = localStorage.getItem('pseudo');
        let uid = localStorage.getItem('userId');
        if(!uid){ uid = generateUserId(); localStorage.setItem('userId', uid); }
        if(!p){ showPseudoModal(); return false; }
        return true;
      }catch(e){ return false }
    }

    function showPseudoModal(){
      try{
        if(document.getElementById('pseudoOverlay')) return;
        const ov = document.createElement('div'); ov.id='pseudoOverlay'; ov.className='modal-overlay'; ov.style.display='flex'; ov.style.alignItems='center'; ov.style.justifyContent='center'; ov.style.zIndex='2500';
        const m = document.createElement('div'); m.className='modal'; m.style.maxWidth='520px'; m.style.width='94%';
        const h = document.createElement('h3'); h.textContent = "Entre ton Pseudo"; m.appendChild(h);
        const inp = document.createElement('input'); inp.type='text'; inp.placeholder='Ton Pseudo'; inp.style.width='100%'; inp.style.padding='8px'; inp.style.fontSize='1rem'; inp.style.marginTop='8px';
        m.appendChild(inp);
        const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='flex-end'; row.style.gap='8px'; row.style.marginTop='12px';
        const btn = document.createElement('button'); btn.className='secondary'; btn.textContent='Valider';
        btn.addEventListener('click', ()=>{
          const v = (inp.value || '').trim(); if(!v) return inp.focus();
          localStorage.setItem('pseudo', v);
          if(!localStorage.getItem('userId')) localStorage.setItem('userId', generateUserId());
          try{ if(typeof updateProfilePopupIfOpen === 'function') updateProfilePopupIfOpen(); }catch(e){}
          try{ if(typeof syncClassement === 'function') syncClassement(); }catch(e){}
          ov.remove();
        });
        row.appendChild(btn); m.appendChild(row); ov.appendChild(m); document.body.appendChild(ov);
        try{ m.classList.add('open'); ov.classList.add('open'); }catch(e){}
        ov.addEventListener('click', (ev)=>{ if(ev.target === ov) ov.remove(); });
      }catch(e){ console.warn('pseudo modal error', e) }
    }

    // Weekly helpers
    function getWeekId(d){ // ISO-like YYYY-WW
      try{
        const dt = d ? new Date(d) : new Date();
        const y = dt.getFullYear();
        // get ISO week number approximation
        const onejan = new Date(y,0,1);
        const days = Math.floor((dt - onejan) / 86400000);
        const week = String(Math.floor((days + onejan.getDay()+1)/7)+1).padStart(2,'0');
        return `${y}-${week}`;
      }catch(e){ return (new Date()).toISOString().slice(0,8) }
    }

    function resetWeeklyIfNeeded(){
      try{
        const currentWeek = getWeekId();
        const stored = localStorage.getItem('fabanki:week_id');
        if(stored !== currentWeek){
          localStorage.setItem('fabanki:week_id', currentWeek);
          localStorage.setItem('fabanki:xp_semaine', '0');
          localStorage.setItem('fabanki:score_mpsi_semaine', '0');
        }
      }catch(e){}
    }

    function getDayId(d){ try{ return (d? new Date(d): new Date()).toISOString().slice(0,10); }catch(e){ return (new Date()).toISOString().slice(0,10) } }

    function resetDailyIfNeeded(){
      try{
        const currentDay = getDayId();
        const stored = localStorage.getItem('fabanki:day_id');
        if(stored !== currentDay){
          localStorage.setItem('fabanki:day_id', currentDay);
          localStorage.setItem('fabanki:score_mpsi_today', '0');
        }
      }catch(e){}
    }

    function getMonthId(d){ try{ const dt = d? new Date(d): new Date(); return dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0'); }catch(e){ return (new Date()).toISOString().slice(0,7) } }

    function resetMonthlyIfNeeded(){
      try{
        const current = getMonthId();
        const stored = localStorage.getItem('fabanki:month_id');
        if(stored !== current){
          localStorage.setItem('fabanki:month_id', current);
          localStorage.setItem('fabanki:score_mpsi_mois','0');
        }
      }catch(e){}
    }

    function incLocal(key, n){ try{ const v = Number(localStorage.getItem(key) || 0) + (n||1); localStorage.setItem(key, String(v)); return v; }catch(e){ return 0 } }

    function getLocalNum(key){ return Number(localStorage.getItem(key) || 0) }

    function countMasteredCards(){
      try{
        let cnt = 0;
        for(const k of Object.keys(localStorage)){
          if(!k.includes(':card:')) continue;
          try{ const st = JSON.parse(localStorage.getItem(k) || '{}'); if(st && st.reps && st.reps >= 3) cnt++; }catch(e){}
        }
        return cnt;
      }catch(e){ return 0 }
    }

    function computeBadges(stats){
      // Backwards-compatible wrapper: compute titles and return top textual badges
      try{
        const out = [];
        const computed = computeTitles(stats || {});
        const titres = computed.titres || [];
        for(const t of titres.slice(0,3)){
          const roman = tierToRoman(t.tier || 0);
          out.push(`${t.nom} ${roman}`);
        }
        // if none, fall back to some simple legacy badges
        if(out.length === 0){
          const legacy = [];
          const streak = Number(localStorage.getItem('fabanki:streak_max') || 0);
          const good = Number(localStorage.getItem('fabanki:good_total') || 0);
          const reviewed = stats.totalReviewed || 0;
          const pass = Number(localStorage.getItem('fabanki:pass_total') || 0);
          if(streak >= 5) legacy.push('Régularité');
          if(good >= 200) legacy.push('Précision');
          if(reviewed >= 1000) legacy.push('Endurance');
          if((reviewed - pass) >= 50) legacy.push('Zéro gaspillage');
          return legacy;
        }
        return out;
      }catch(e){ return [] }
    }

    function tierToRoman(t){ const map=['','I','II','III','IV','V']; return map[Number(t)||0]||String(t); }

    function computeTitles(stats){
      // stats should include totalReviewed, todayReviewed, xpTotal
      try{
        const titres = [];
        const objectifs = [];
        const bonnes = Number(localStorage.getItem('fabanki:good_total') || 0);
        const reviewed = Number(stats.totalReviewed || 0);
        const passes = Number(localStorage.getItem('fabanki:pass_total') || 0);
        const mastered = Number(localStorage.getItem('fabanki:mastered_total') || countMasteredCards());
        const streakMax = Number(localStorage.getItem('fabanki:streak_max') || 0);
        const streakCurrent = Number(localStorage.getItem('fabanki:streak_current') || 0);
        const longCount = Number(localStorage.getItem('fabanki:long_answer_total') || 0);
        
        // Get consec counters for Newton and Noether
        const consecCorrectMax = Number(localStorage.getItem('fabanki:consec_correct_max') || 0);
        const consecNoPassMax = Number(localStorage.getItem('fabanki:consec_no_pass_max') || 0);

        // Helper to compute highest tier from thresholds array
        const highestTier = (value, thresholds)=>{
          let tier = 0; for(let i=0;i<thresholds.length;i++){ if(value >= thresholds[i]) tier = i+1; }
          return tier;
        };

        // Define title thresholds
        const defs = [
          {nom:'Gauss', th:[100,300,600,1000,2000], val: bonnes},
          {nom:'Fourier', th:[200,600,1200,2500,5000], val: reviewed},
          {nom:'Euler', th:[200,500,1000,2000,4000], val: (reviewed>0? Math.round((bonnes/reviewed)*100):0), isPercent:true, percentDefs:[0.75,0.80,0.85,0.90,0.92]},
          {nom:'Newton', th:[20,50,100,200,365], val: consecCorrectMax},
          {nom:'Maxwell', th:[3,7,21,60,120], val: streakCurrent},
          {nom:'Noether', th:[50,150,400,1000,3000], val: consecNoPassMax},
          {nom:'Hadamard', th:[50,150,400,1000,3000], val: longCount}
        ];
        for(const d of defs){
          let tier = 0;
          if(d.isPercent){
            for(let i=0;i<d.percentDefs.length;i++){ if(reviewed >= d.th[i] && (bonnes/reviewed) >= d.percentDefs[i]) tier = i+1; }
          } else {
            tier = highestTier(d.val, d.th);
          }
          titres.push({nom: d.nom, tier});
        }

        // Special one-shot objectifs
        try{
          // Lagrange: 95% de bonnes réponses sur 500 cartes
          if(reviewed >= 500 && reviewed>0 && (bonnes / reviewed) >= 0.95){ objectifs.push('Lagrange'); localStorage.setItem('fabanki:objective_Lagrange','1'); }
          // Cauchy: aucune 'Passer' sur 300 cartes
          if(reviewed >= 300 && passes === 0){ objectifs.push('Cauchy'); localStorage.setItem('fabanki:objective_Cauchy','1'); }
          // Laplace, Feynman, Ramanujan: detect via explicit flags if present (allow server/backfill)
          if(localStorage.getItem('fabanki:objective_Laplace') === '1') objectifs.push('Laplace');
          if(localStorage.getItem('fabanki:objective_Feynman') === '1') objectifs.push('Feynman');
          if(localStorage.getItem('fabanki:objective_Ramanujan') === '1') objectifs.push('Ramanujan');
        }catch(e){}

        return { titres, objectifs };
      }catch(e){ return {titres:[], objectifs:[]} }
    }

    // Synchronize local profile/Xp to Firestore under collection 'Classement'
    async function syncClassement(){
      try{
        const db = window.__fabanki_firestore;
        if(!db) return false;
        const userId = localStorage.getItem('userId') || generateUserId();
        const pseudo = localStorage.getItem('pseudo') || 'Anonyme';
        const xp = Number(localStorage.getItem('fabanki:xp_total') || 0);
        const lvl = (typeof computeLevelAndProgress === 'function') ? computeLevelAndProgress(xp).level : 1;
        // ensure weekly counters are current
        resetWeeklyIfNeeded();
        // update daily streak information
        try{
          const today = (new Date()).toDateString();
          const last = localStorage.getItem('fabanki:last_active_date');
          if(last === today){ /* already recorded today */ }
          else {
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
            if(last === yesterday.toDateString()){
              const cur = Number(localStorage.getItem('fabanki:streak_current')||0) + 1; localStorage.setItem('fabanki:streak_current', String(cur));
              const maxi = Math.max(Number(localStorage.getItem('fabanki:streak_max')||0), cur); localStorage.setItem('fabanki:streak_max', String(maxi));
            } else {
              localStorage.setItem('fabanki:streak_current', '1');
              const maxi = Math.max(Number(localStorage.getItem('fabanki:streak_max')||0), 1); localStorage.setItem('fabanki:streak_max', String(maxi));
            }
            localStorage.setItem('fabanki:last_active_date', today);
          }
        }catch(e){}
        const stats = getProfileStats();
        const cartes = stats.totalReviewed || 0;
        const bonnes = Number(localStorage.getItem('fabanki:good_total') || 0);
        const rates = Number(localStorage.getItem('fabanki:fail_total') || 0);
        const passes = Number(localStorage.getItem('fabanki:pass_total') || 0);
        const mastered = Number(localStorage.getItem('fabanki:mastered_total') || countMasteredCards());
        const streakMax = Number(localStorage.getItem('fabanki:streak_max') || 0);
        const xpS = Number(localStorage.getItem('fabanki:xp_semaine') || 0);
        const scoreWeekLocal = Number(localStorage.getItem('fabanki:score_mpsi_semaine') || 0);
        const scoreMonthLocal = Number(localStorage.getItem('fabanki:score_mpsi_mois') || 0);
        // compute Score MPSI
        const scoreMPSI = (mastered * 6) + (bonnes * 2) + (streakMax * 10) - (rates * 4) - (passes * 6);
        // determine friendly Niveau label (happy-medium tone)
        let niveauPrep = 'Débutant';
        if(scoreMPSI >= 7000) niveauPrep = 'Expert';
        else if(scoreMPSI >= 4000) niveauPrep = 'Avancé';
        else if(scoreMPSI >= 2000) niveauPrep = 'Équilibré';
        else if(scoreMPSI >= 800) niveauPrep = 'Progression';
        else niveauPrep = 'Débutant';

        const computedTitles = (typeof computeTitles === 'function') ? computeTitles(stats) : {titres:[], objectifs:[]};
        const titres = computedTitles.titres || [];
        const objectifs = computedTitles.objectifs || [];
        // prepare textual badges for backward compatibility (top 3)
        const badges = (titres.length>0) ? titres.slice(0,3).map(t=> (t.nom || '') + ' ' + tierToRoman(t.tier || 0)) : computeBadges(stats);

        // prepare daily stats and objectives persistence
        try{
          // ensure daily counters are current
          resetDailyIfNeeded();
          // cards since last streak reset: if streak was reset now (not consecutive), reset counter
          try{
            const today = (new Date()).toDateString();
            const last = localStorage.getItem('fabanki:last_active_date');
            const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
            if(!(last === yesterday.toDateString())){
              // streak reset occurred
              localStorage.setItem('fabanki:cards_since_streak_reset','0');
            }
          }catch(e){}
          // handle Ramanujan: consecutive days with score_mpsi_today > 200
          try{
            const todayScore = Number(localStorage.getItem('fabanki:score_mpsi_today') || 0);
            const lastOver = localStorage.getItem('fabanki:last_score_over200_date');
            const daysStreak = Number(localStorage.getItem('fabanki:days_score_over200_streak') || 0);
            const todayDate = getDayId();
            const yesterdayDate = getDayId(new Date(Date.now() - 86400000));
            let newDays = daysStreak;
            if(todayScore > 200){
              if(lastOver === yesterdayDate) newDays = daysStreak + 1; else newDays = 1;
              localStorage.setItem('fabanki:last_score_over200_date', todayDate);
            } else {
              newDays = 0; localStorage.removeItem('fabanki:last_score_over200_date');
            }
            localStorage.setItem('fabanki:days_score_over200_streak', String(newDays));
            // persist objective if reached
            if(newDays >= 10) localStorage.setItem('fabanki:objective_Ramanujan','1');
              // Laplace: cards reviewed since last streak reset
              try{ const cardsSince = Number(localStorage.getItem('fabanki:cards_since_streak_reset')||0); if(cardsSince >= 1000) localStorage.setItem('fabanki:objective_Laplace','1'); }catch(e){}
          }catch(e){}
        }catch(e){}

        // prepare doc
        const nowIso = (new Date()).toISOString();
        const weekId = getWeekId();
        const monthId = getMonthId();
        // Calculate daily quest completion count
        let dailyQuestsCompleted = 0;
        try{
          const missions = JSON.parse(localStorage.getItem('fabanki:daily_missions') || '[]');
          dailyQuestsCompleted = missions.filter(m => m.completed).length;
        }catch(e){}
        
        const doc = {
          Pseudo: pseudo,
          XP: xp,
          Niveau: lvl,
          ['Cartes révisées']: cartes,
          ['Dernière mise à jour']: nowIso,
          ['Dernière synchronisation']: nowIso,
          Score_MPSI: Math.max(0, scoreMPSI),
          ['Bonnes réponses']: bonnes,
          ['Ratés']: rates,
          ['Passer']: passes,
          ['Streak_max']: streakMax,
          ['Cartes maîtrisées']: mastered,
          Badges: badges,
          Titres: titres,
          Objectifs: objectifs,
          Titres: titres,
          Objectifs: objectifs,
          XP_semaine: xpS,
          Score_MPSI_semaine: Math.max(0, scoreWeekLocal),
          Semaine_ID: weekId,
          Score_MPSI_mois: Math.max(0, scoreMonthLocal),
          Mois_ID: monthId,
          ['Niveau Prépa']: niveauPrep,
          ['Quêtes_quotidiennes']: dailyQuestsCompleted
        };

        // Anti-cheat: Validate all data before sending to Firestore
        const validatedDoc = sanitizeAndValidateUserData(doc);
        
        // Anti-cheat: fetch previous doc and compare deltas
        try{
          const ref = db.collection('Classement').doc(userId);
          const prev = await ref.get();
          if(prev && prev.exists){
            const pd = prev.data() || {};
            const prevScore = Number(pd.Score_MPSI || 0);
            const prevCards = Number(pd['Cartes révisées'] || 0);
            const prevSync = pd['Dernière synchronisation'] || pd['Dernière mise à jour'] || null;
            if(prevSync){
              const prevDate = new Date(prevSync);
              const mins = (Date.now() - prevDate.getTime()) / 60000;
              if((scoreMPSI - prevScore) > 400 && mins < 10){ console.warn('Synchronisation bloquée (progression irréaliste)'); return false }
              if((cartes - prevCards) > 80 && mins < 10){ console.warn('Synchronisation bloquée (progression irréaliste)'); return false }
            }
          }
        }catch(e){ console.warn('syncClassement anti-cheat check failed', e) }

        try{
          // detect title upgrades compared to local cache and show toasts
          try{
            const prevCacheRaw = localStorage.getItem('fabanki:titles_cache') || '{}';
            const prevCache = JSON.parse(prevCacheRaw || '{}');
            const newCache = prevCache || {};
            (titres || []).forEach(tt => {
              try{
                const name = tt.nom || '';
                const newTier = Number(tt.tier || 0);
                const oldTier = Number(prevCache[name] || 0);
                if(newTier > oldTier){ try{ showTitleUpNotification(name, newTier, oldTier); }catch(e){} }
                newCache[name] = newTier;
              }catch(e){}
            });
            try{ localStorage.setItem('fabanki:titles_cache', JSON.stringify(newCache)); }catch(e){}
          }catch(e){ /* ignore cache errors */ }
        }catch(e){}
        await db.collection('Classement').doc(userId).set(validatedDoc, {merge:true});
        return true;
      }catch(e){ console.warn('syncClassement', e); return false }
    }

    // Leaderboard popup (real-time listener)
    function showLeaderboardPopup(){
      try{
        if(document.getElementById('leaderboardOverlay')) return;
        const db = window.__fabanki_firestore;
        const ov = document.createElement('div'); ov.id='leaderboardOverlay'; ov.className='modal-overlay'; ov.style.display='flex'; ov.style.alignItems='center'; ov.style.justifyContent='center'; ov.style.zIndex='2200';
        const m = document.createElement('div'); m.className='modal'; m.style.maxWidth='860px'; m.style.width='94%'; m.style.maxHeight='80vh'; m.style.overflow='auto';
        const h = document.createElement('h3'); h.textContent = 'Classement'; m.appendChild(h);
        // tabs
        const tabs = document.createElement('div'); tabs.style.display='flex'; tabs.style.gap='8px'; tabs.style.marginBottom='8px';
        const tabGlobal = document.createElement('button'); tabGlobal.className='secondary'; tabGlobal.textContent='Classement global';
        const tabWeek = document.createElement('button'); tabWeek.className='secondary'; tabWeek.textContent='Classement du mois';
        tabs.appendChild(tabGlobal); tabs.appendChild(tabWeek); m.appendChild(tabs);
        const table = document.createElement('table'); table.className = 'leaderboard-table'; table.style.width='100%'; table.style.borderCollapse='collapse';
        const thead = document.createElement('thead'); thead.innerHTML = '<tr><th>Rang</th><th>Pseudo</th><th>Niveau</th><th>Titres</th><th>Score MPSI</th><th>Cartes</th><th>Quêtes quotidiennes</th></tr>';
        table.appendChild(thead);
        const tbody = document.createElement('tbody'); table.appendChild(tbody);
        m.appendChild(table);
        const closeDiv = document.createElement('div'); closeDiv.style.display='flex'; closeDiv.style.justifyContent='flex-end'; closeDiv.style.marginTop='8px';
        const cb = document.createElement('button'); cb.className='secondary'; cb.textContent='Fermer'; cb.addEventListener('click', ()=>{ try{ if(typeof unsubGlobal === 'function') unsubGlobal(); if(typeof unsubWeek === 'function') unsubWeek(); }catch(e){} ov.remove(); }); closeDiv.appendChild(cb); m.appendChild(closeDiv);
        ov.appendChild(m); document.body.appendChild(ov);
        try{ m.classList.add('open'); ov.classList.add('open');
          const anim = localStorage.getItem('fabanki:popup_animation') || 'none';
          if(anim !== 'none') m.setAttribute('data-animation', anim);
        }catch(e){}
        if(!db){ tbody.innerHTML = '<tr><td colspan="6">Le service Classement n\'est pas configuré. Ajoutez la configuration Firebase dans index.html.</td></tr>'; return; }
        let unsubGlobal = null, unsubWeek = null;
        
        // SECURITY: Filter function to remove suspicious entries from leaderboard
        function isValidLeaderboardEntry(d) {
          try {
            const level = Number(d.Niveau || 0);
            const score = Number(d.Score_MPSI || 0);
            const scoreMonth = Number(d.Score_MPSI_mois || 0);
            const scoreWeek = Number(d.Score_MPSI_semaine || 0);
            
            // Block entries with unrealistic stats
            if (level > 60) return false;              // Max reasonable level ~60
            if (score > 5000) return false;           // Max reasonable MPSI score ~5000
            if (scoreMonth > 5000) return false;      // Monthly score cap
            if (scoreWeek > 5000) return false;       // Weekly score cap
            if (score < -10000) return false;         // Negative score injection
            
            return true;
          } catch (e) {
            return false;
          }
        }
        
        function renderRow(d, rank){
          // Skip users with 0 cards seen
          const cardsReviewed = Number(d['Cartes révisées'] || 0);
          if(cardsReviewed === 0) return null;
          
          const tr = document.createElement('tr');
          const tdRank = document.createElement('td'); tdRank.textContent = String(rank);
          const tdPseudo = document.createElement('td'); tdPseudo.textContent = d.Pseudo || '';
          const tdNiv = document.createElement('td'); tdNiv.textContent = d['Niveau'] || d['Niveau Prépa'] || '';
          const tdScore = document.createElement('td'); tdScore.textContent = d.Score_MPSI || d.Score_MPSI || 0;
          const tdBadges = document.createElement('td'); tdBadges.style.display='flex'; tdBadges.style.gap='6px';
          try{
            const t = d.Titres || d.titres || [];
            try{
              // take only titres with tier>0, sort by tier desc, show top 3
              if(Array.isArray(t) && t.length){
                const sorted = t.filter(x=> (x && Number(x.tier||0) > 0)).sort((a,b)=> Number(b.tier||0) - Number(a.tier||0)).slice(0,3);
                sorted.forEach(obj=>{
                  const name = obj.nom || obj.name || '';
                  const tier = obj.tier || 0;
                  const sp = document.createElement('span'); sp.className='badge-chip'; sp.textContent = name + ' ' + tierToRoman(tier);
                  sp.style.fontSize='0.8rem'; sp.style.padding='4px 6px'; sp.style.borderRadius='6px'; sp.style.background='rgba(0,0,0,0.04)'; tdBadges.appendChild(sp);
                });
              } else {
                const b = d.Badges || [];
                b.forEach(bn=>{ const sp = document.createElement('span'); sp.className='badge-chip'; sp.textContent = bn; sp.style.fontSize='0.8rem'; sp.style.padding='4px 6px'; sp.style.borderRadius='6px'; sp.style.background='rgba(0,0,0,0.04)'; tdBadges.appendChild(sp); });
              }
            }catch(e){}
          }catch(e){}
          const tdCartes = document.createElement('td'); tdCartes.textContent = d['Cartes révisées'] || 0;
          const tdQuests = document.createElement('td'); tdQuests.textContent = d['Quêtes_quotidiennes'] || 0;
          tr.appendChild(tdRank); tr.appendChild(tdPseudo); tr.appendChild(tdNiv); tr.appendChild(tdBadges); tr.appendChild(tdScore); tr.appendChild(tdCartes); tr.appendChild(tdQuests);
          return tr;
        }

        function attachGlobal(){
          if(unsubGlobal) return;
          const qg = db.collection('Classement').orderBy('Score_MPSI','desc');
          unsubGlobal = qg.onSnapshot(snapshot=>{
            try{ tbody.innerHTML=''; let r=1; snapshot.forEach(doc=>{ const d=doc.data()||{}; if(isValidLeaderboardEntry(d)) { const row = renderRow(d, r); if(row) { tbody.appendChild(row); r++; } } }); }catch(e){ console.warn('leaderboard render', e); }
          }, err=>{ console.warn('leaderboard snapshot error', err); tbody.innerHTML = '<tr><td colspan="7">Erreur lecture du classement</td></tr>'; });
        }

        function attachWeek(){
          if(unsubWeek) return;
          const m = getMonthId();
          const qw = db.collection('Classement').orderBy('Score_MPSI_mois','desc');
          unsubWeek = qw.onSnapshot(snapshot=>{
            try{ 
              const allData = [];
              snapshot.forEach(doc=>{ const d=doc.data()||{}; if(isValidLeaderboardEntry(d) && d.Mois_ID === m) { allData.push(d); } });
              // Sort by Score_MPSI_mois descending to ensure proper ranking
              allData.sort((a,b) => (Number(b.Score_MPSI_mois || 0) - Number(a.Score_MPSI_mois || 0)));
              tbody.innerHTML=''; let r=1; allData.forEach(d=>{ const row = renderRow(d, r); if(row) { tbody.appendChild(row); r++; } });
            }catch(e){ console.warn('leaderboard render', e); }
          }, err=>{ console.warn('leaderboard snapshot error', err); tbody.innerHTML = '<tr><td colspan="7">Erreur lecture du classement</td></tr>'; });
        }

        tabGlobal.addEventListener('click', ()=>{ try{ if(unsubWeek){ unsubWeek(); unsubWeek = null; } if(!unsubGlobal) attachGlobal(); tabGlobal.disabled=true; tabWeek.disabled=false; }catch(e){} });
        tabWeek.addEventListener('click', ()=>{ try{ if(unsubGlobal){ unsubGlobal(); unsubGlobal = null; } if(!unsubWeek) attachWeek(); tabWeek.disabled=true; tabGlobal.disabled=false; }catch(e){} });
        // start on global
        tabGlobal.disabled = true; attachGlobal();
        // ensure listeners removed when overlay removed
        ov.addEventListener('remove', ()=>{ try{ if(unsubGlobal) unsubGlobal(); if(unsubWeek) unsubWeek(); }catch(e){} });
      }catch(e){ console.warn('showLeaderboardPopup', e); }
    }

    function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min }

    // Titles popup: show all Titres and Objectifs computed locally
    function showTitlesPopup(){
      try{
        if(document.getElementById('titlesOverlay')) return;
        const stats = getProfileStats();
        const computed = (typeof computeTitles === 'function') ? computeTitles(stats) : {titres:[], objectifs:[]};
        const ov = document.createElement('div'); ov.id='titlesOverlay'; ov.className='modal-overlay'; ov.style.display='flex'; ov.style.alignItems='center'; ov.style.justifyContent='center'; ov.style.zIndex='2300';
        const m = document.createElement('div'); m.className='modal'; m.style.maxWidth='640px'; m.style.width='94%';
        const h = document.createElement('h3'); h.textContent = 'Titres obtenus'; m.appendChild(h);
        const list = document.createElement('div'); list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='8px';
        // Titres
        const tbox = document.createElement('div'); tbox.style.marginTop='6px';
        // definitions for titles: thresholds and descriptions
        const defs = {
          'Gauss': {th:[100,300,600,1000,2000], desc:'Rigueur — nombre total de bonnes réponses.' , metric: ()=> Number(localStorage.getItem('fabanki:good_total')||0) },
          'Fourier': {th:[200,600,1200,2500,5000], desc:'Travail massif — cartes révisées au total.', metric: ()=> Number(stats.totalReviewed||0) },
          'Euler': {th:[75,80,85,90,92], desc:'Précision — pourcentage de bonnes réponses (sur un grand échantillon).', metric: ()=>{ const tot = Number(stats.totalReviewed||0); const good=Number(localStorage.getItem('fabanki:good_total')||0); return tot>0? Math.round((good/tot)*100):0 }, requiredCards: [200,500,1000,2000,4000] },
          'Newton': {th:[20,50,100,200,365], desc:'Séquence de cartes consécutives sans "Raté" (cartes correctes d\'affilée).', metric: ()=> Number(localStorage.getItem('fabanki:consec_correct_max')||0) },
          'Maxwell': {th:[3,7,21,60,120], desc:'Endurance — jours consécutifs d\'activité.', metric: ()=> Number(localStorage.getItem('fabanki:streak_current')||0) },
          'Noether': {th:[50,150,400,1000,3000], desc:'Zéro gaspillage — cartes révisées sans "Passer".', metric: ()=> Number(localStorage.getItem('fabanki:consec_no_pass_max')||0) },
          'Hadamard': {th:[50,150,400,1000,3000], desc:'Réponses longues (>20s) — temps passé par réponse.', metric: ()=> Number(localStorage.getItem('fabanki:long_answer_total')||0) }
        };
        if(computed.titres && computed.titres.length){
          computed.titres.forEach(t=>{
            const def = defs[t.nom] || null;
            const row = document.createElement('div'); row.style.display='flex'; row.style.flexDirection='column'; row.style.gap='6px'; row.style.padding='8px'; row.style.borderBottom='1px solid rgba(0,0,0,0.04)';
            const top = document.createElement('div'); top.style.display='flex'; top.style.justifyContent='space-between'; top.style.alignItems='center';
            const left = document.createElement('div'); left.style.fontWeight='700'; left.textContent = t.nom || '';
            const right = document.createElement('div'); right.className='muted small'; right.textContent = 'Tier ' + tierToRoman(t.tier || 0);
            top.appendChild(left); top.appendChild(right);
            row.appendChild(top);
            // description
            const desc = document.createElement('div'); desc.className='muted small'; desc.textContent = def? def.desc : '';
            row.appendChild(desc);
            // progress bar -> show progress toward NEXT tier; if at max tier, show 'Niveau max atteint'
            if(def){
              const cur = def.metric();
              const th = def.th;
              const curTier = Number(t.tier || 0);
              const maxTier = th.length;
              const barWrap = document.createElement('div'); barWrap.style.display='flex'; barWrap.style.alignItems='center'; barWrap.style.gap='8px';
              if(curTier >= maxTier){
                const done = document.createElement('div'); done.className='muted small'; done.textContent = 'Niveau max atteint';
                barWrap.appendChild(done);
              } else {
                const prevThreshold = curTier > 0 ? th[curTier-1] : 0;
                const nextThreshold = th[curTier];
                const progress = nextThreshold > prevThreshold ? Math.min(100, Math.max(0, Math.round((cur - prevThreshold) / (nextThreshold - prevThreshold) * 100))) : 100;
                const bar = document.createElement('div'); bar.style.flex='1'; bar.style.height='10px'; bar.style.background='#eee'; bar.style.borderRadius='6px';
                const fill = document.createElement('div'); fill.style.height='100%'; fill.style.width = progress + '%'; fill.style.background = getLevelColor(Math.min(50, Math.max(1, curTier+1))); fill.style.borderRadius='6px'; bar.appendChild(fill);
                const label = document.createElement('div'); label.className='muted small'; label.style.minWidth='140px';
                if(typeof def.metric === 'function' && t.nom === 'Euler'){
                  // For Euler, show percentage and required cards for next tier
                  const requiredCards = def.requiredCards ? def.requiredCards[curTier] : nextThreshold;
                  label.textContent = `${cur}% — besoin de ${requiredCards} cartes vues`;
                } else {
                  label.textContent = `${cur} / ${nextThreshold}`;
                }
                barWrap.appendChild(bar); barWrap.appendChild(label);
              }
              row.appendChild(barWrap);
            }
            tbox.appendChild(row);
          });
        } else { const none = document.createElement('div'); none.className='muted small'; none.textContent='Aucun titre débloqué pour le moment.'; tbox.appendChild(none); }
        list.appendChild(tbox);

        // Objectifs
        const obox = document.createElement('div'); obox.style.marginTop='12px';
        const oh = document.createElement('h4'); oh.textContent='Objectifs spéciaux'; obox.appendChild(oh);
        if(computed.objectifs && computed.objectifs.length){
          computed.objectifs.forEach(o=>{ const d = document.createElement('div'); d.textContent = o; obox.appendChild(d); });
        } else { const none = document.createElement('div'); none.className='muted small'; none.textContent='Aucun objectif spécial atteint.'; obox.appendChild(none); }
        list.appendChild(obox);

        m.appendChild(list);
        const closeDiv = document.createElement('div'); closeDiv.style.display='flex'; closeDiv.style.justifyContent='flex-end'; closeDiv.style.marginTop='12px';
        const cb = document.createElement('button'); cb.className='secondary'; cb.textContent='Fermer'; cb.addEventListener('click', ()=>{ ov.remove(); }); closeDiv.appendChild(cb); m.appendChild(closeDiv);
        ov.appendChild(m); document.body.appendChild(ov);
        try{ ov.classList.add('open'); m.classList.add('open'); ov.setAttribute('aria-hidden','false');
          const anim = localStorage.getItem('fabanki:popup_animation') || 'none';
          if(anim !== 'none') m.setAttribute('data-animation', anim);
        }catch(e){}
        ov.addEventListener('click', (ev)=>{ if(ev.target === ov) ov.remove(); });
      }catch(e){ console.warn('showTitlesPopup', e); }
    }

    function computeXpForQuality(section, quality, timeSec, prevReviewHours){
      // quality: 3=Difficile,4=Bon,5=Facile ; timeSec adjusts slightly
      let low=0, high=0, penalty=0;
      if(section === 'maths' || section === 'physique'){
        if(quality===3){ low=7; high=10 } else if(quality===4){ low=10; high=15 } else if(quality===5){ low=12; high=20 } else return 0;
        penalty = -5;
      } else if(section === 'si' || section === 'info'){
        if(quality===3){ low=5; high=8 } else if(quality===4){ low=8; high=12 } else if(quality===5){ low=10; high=15 } else return 0;
        penalty = -3;
      } else if(section === 'anglais' || section === 'francais'){
        if(quality===3){ low=3; high=5 } else if(quality===4){ low=5; high=8 } else if(quality===5){ low=8; high=12 } else return 0;
        penalty = -2;
      } else {
        // default small gains
        if(quality===3){ low=3; high=6 } else if(quality===4){ low=5; high=8 } else if(quality===5){ low=8; high=10 } else return 0;
        penalty = -2;
      }
      const base = randInt(low, high);
      // time factor: short <5s -> 0.8, 5-20s ->1, >20s ->1.2
      let factor = 1;
      if(timeSec < 5) factor = 0.8; else if(timeSec > 20) factor = 1.2;
      // previous-review multiplier: old reviews give more XP
      let prevMult = 1;
      try{
        if(prevReviewHours === null || prevReviewHours === undefined) prevMult = 0.9; // new card
        else if(prevReviewHours >= 24*7) prevMult = 1.4; // long time
        else if(prevReviewHours >= 24) prevMult = 1.15;
        else if(prevReviewHours >= 12) prevMult = 1.05;
        else prevMult = 1;
      }catch(e){ prevMult = 1 }
      return Math.max(0, Math.round(base * factor * prevMult));
    }

    function computePenaltyForSection(section){ if(section==='maths' || section==='physique') return -5; if(section==='si' || section==='info') return -3; if(section==='anglais' || section==='francais') return -2; return -2 }

    // Level / XP helpers
    function xpForLevel(level){
      // exponential growth per level: base * mult^(level-1)
      const base = 50; const mult = 1.1;
      return Math.floor(base * Math.pow(mult, Math.max(0, level-1)));
    }

    function computeLevelAndProgress(totalXp){
      // returns { level, progress, need, toNext, pct }
      let remaining = Math.max(0, Math.floor(totalXp || 0));
      let level = 1;
      while(true){
        const need = xpForLevel(level);
        if(remaining < need){
          const progress = remaining;
          const toNext = need - remaining;
          const pct = need>0 ? (progress / need * 100) : 100;
          return { level, progress, need, toNext, pct };
        }
        remaining -= need;
        level++;
        // safety cap
        if(level > 200) return { level:200, progress:0, need: xpForLevel(200), toNext: xpForLevel(200), pct:0 };
      }
    }

    function getLevelColor(level){
      // grade colors by level ranges
       if(level < 3) return '#c70d00'; // dark-red
      if(level < 5) return '#eb4034'; // red
      if(level < 10) return '#ff771c'; // orange-red
      if(level < 15) return '#d1c70f'; // yellow
      if(level < 20) return '#7bc30f'; // lime-green
      if(level < 30) return '#0fa3b1'; // teal
      if(level < 40) return '#0f7ad1'; // blue
      if(level < 50) return '#263af0'; // indigo
      return '#9b5cff'; // purple
    }

    // show a centered level-up notification
    function showLevelUpNotification(newLevel, oldLevel){
      try{
        const id = 'levelUpNotify';
        if(document.getElementById(id)) document.getElementById(id).remove();
        const ov = document.createElement('div'); ov.id = id; ov.className = 'level-up-notify';
        const icon = document.createElement('div'); icon.style.fontSize='22px'; icon.textContent = '✨'; icon.style.marginBottom='6px'; icon.style.textAlign='center';
        const h = document.createElement('div'); h.style.fontWeight='700'; h.style.fontSize='1.05rem'; h.style.textAlign='center'; h.textContent = `Niveau ${newLevel} !`;
        const sub = document.createElement('div'); sub.className='muted small'; sub.style.textAlign='center'; sub.textContent = oldLevel? `Félicitations — vous êtes passé de ${oldLevel} à ${newLevel}` : `Nouveau niveau : ${newLevel}`;
        ov.appendChild(icon); ov.appendChild(h); ov.appendChild(sub);
        // Apply animation
        try { const anim = localStorage.getItem('fabanki:popup_animation') || 'none'; if(anim !== 'none') ov.setAttribute('data-animation', anim); }catch(e){}
        document.body.appendChild(ov);
        // animate in
        requestAnimationFrame(()=> ov.classList.add('show'));
        // remove after a short display, animate out first
        setTimeout(()=>{
          try{ ov.classList.remove('show'); setTimeout(()=>{ try{ ov.remove(); }catch(e){} }, 360); }catch(e){}
        }, 4200);
      }catch(e){ console.warn('levelUpNotify', e); }
    }

    // show a small centered title-up notification (toast)
    function showTitleUpNotification(name, newTier, oldTier){
      try{
        const id = 'titleUpNotify-'+name.replace(/\s+/g,'_');
        if(document.getElementById(id)) document.getElementById(id).remove();
        const ov = document.createElement('div'); ov.id = id; ov.className = 'title-up-notify';
        const icon = document.createElement('div'); icon.style.fontSize='18px'; icon.textContent = '🏅'; icon.style.marginBottom='6px'; icon.style.textAlign='center';
        const h = document.createElement('div'); h.style.fontWeight='700'; h.style.fontSize='0.98rem'; h.style.textAlign='center'; h.textContent = `${name} ${tierToRoman(newTier)}`;
        const sub = document.createElement('div'); sub.className='muted small'; sub.style.textAlign='center'; sub.textContent = oldTier? `Amélioration : ${tierToRoman(oldTier)} → ${tierToRoman(newTier)}` : `Titre débloqué : ${tierToRoman(newTier)}`;
        ov.appendChild(icon); ov.appendChild(h); ov.appendChild(sub);
        // Apply animation
        try { const anim = localStorage.getItem('fabanki:popup_animation') || 'none'; if(anim !== 'none') ov.setAttribute('data-animation', anim); }catch(e){}
        document.body.appendChild(ov);
        requestAnimationFrame(()=> ov.classList.add('show'));
        setTimeout(()=>{ try{ ov.classList.remove('show'); setTimeout(()=>{ try{ ov.remove(); }catch(e){} }, 360); }catch(e){} }, 3800);
      }catch(e){ console.warn('titleUpNotify', e); }
    }

    // create transient XP badge on main card
    function showXpToast(delta){
      try{
        if(!delta) return;
        const card = document.querySelector('.card#cardArea') || document.querySelector('.card');
        if(!card) return;
        const t = document.createElement('div');
        t.className = 'xp-toast';
        // position via CSS inline for placement but animation via classes
        t.style.position = 'absolute'; t.style.right = '14px'; t.style.top = '14px'; t.style.zIndex = '1500';
        if(delta>0){ t.style.background = 'rgba(30,160,80,0.12)'; t.style.color = 'green'; t.textContent = `+${delta} XP`; }
        else { t.style.background = 'rgba(255,80,80,0.08)'; t.style.color = 'crimson'; t.textContent = `${delta} XP`; }
        // Apply animation
        try { const anim = localStorage.getItem('fabanki:popup_animation') || 'none'; if(anim !== 'none') t.setAttribute('data-animation', anim); }catch(e){}
        card.style.position = card.style.position || 'relative'; card.appendChild(t);
        // animate in
        requestAnimationFrame(()=> t.classList.add('show'));
        // animate out and remove
        setTimeout(()=>{
          try{ t.classList.add('leave'); t.classList.remove('show'); setTimeout(()=>{ try{ t.remove(); }catch(e){} }, 320); }catch(e){}
        }, 1800);
      }catch(e){}
    }
    // Render welcome decks view when no deck is loaded
    async function removeWelcome(){
      try{
        const w = document.getElementById('welcomeDecks'); if(w) w.remove();
        const mainEl = document.querySelector('main'); if(mainEl) mainEl.style.display='block';
        const stats = document.getElementById('stats'); if(stats) stats.style.display='block';
        const hint = document.getElementById('histHint'); if(hint) { hint.style.display='block'; hint.style.position=''; hint.style.marginBottom=''; }
        // restore body scrolling to previous behavior (desktop: hidden, mobile: default)
        try{ document.body.style.overflowY = (window.innerWidth >= 641) ? 'hidden' : ''; }catch(e){}
      }catch(e){}
    }

    async function renderWelcomeDecks(){
      try{
        // remove any existing welcome first
        await removeWelcome();
        updateStatus("Bienvenue sur Fab'Anki");
        // hide existing main/stats but keep DOM so handlers remain
        const mainEl = document.querySelector('main'); if(!mainEl) return;
        mainEl.style.display = 'none';
        const stats = document.getElementById('stats'); if(stats) stats.style.display='none';
        const hint = document.getElementById('histHint');
        const container = document.createElement('div'); container.id = 'welcomeDecks'; container.style.padding = '18px';

        // allow vertical scrolling on welcome page
        try{ document.body.style.overflowY = 'auto'; }catch(e){}

        // Level summary card (above the decks list)
        try{
          // if a hint exists, clone it and place the clone above the level card so it's not overlaying
          try{
            if(hint){
              const clone = hint.cloneNode(true);
              clone.id = 'histHint_welcome';
              clone.style.position = 'static';
              clone.style.top = '';
              clone.style.left = '';
              clone.style.right = '';
              clone.style.zIndex = '';
              clone.style.marginBottom = '10px';
              container.appendChild(clone);
              // hide original to prevent overlap
              hint.style.display = 'none';
            }
          }catch(e){}
          const lvlStats = computeLevelAndProgress(getXpTotal());
          const levelCard = document.createElement('div'); levelCard.className = 'card level-summary'; levelCard.style.marginBottom = '12px'; levelCard.style.padding = '16px';
          const lvlBox = document.createElement('div'); lvlBox.style.display='flex'; lvlBox.style.alignItems='center'; lvlBox.style.gap='12px';
          const circ = 2 * Math.PI * 28;
          const offset = Math.round(circ * (1 - Math.max(0, Math.min(100, lvlStats.pct))/100));
          const color = getLevelColor(lvlStats.level);
          const ringHtml = `<div class="level-ring" style="flex:0 0 64px"><svg viewBox=\"0 0 100 100\"><circle cx=\"50\" cy=\"50\" r=\"28\" stroke=\"#eee\" stroke-width=\"8\" fill=\"none\"></circle><circle class="ring-fill" cx=\"50\" cy=\"50\" r=\"28\" stroke=\"${color}\" stroke-width=\"8\" fill=\"none\" stroke-linecap=\"round\" stroke-dasharray=\"${circ}\" stroke-dashoffset=\"${offset}\"></circle></svg><div class=\"level-num\">${lvlStats.level}</div></div>`;
          const info = document.createElement('div'); info.style.display='flex'; info.style.flexDirection='column';
          const t = document.createElement('div'); t.style.fontWeight='700'; t.textContent = `Level ${lvlStats.level}`;
          const s = document.createElement('div'); s.className='muted small'; s.textContent = `${lvlStats.progress}/${lvlStats.need} XP avant le prochain niveau`;
          info.appendChild(t); info.appendChild(s);
          lvlBox.innerHTML = ringHtml; lvlBox.appendChild(info);
          
          // Create main content wrapper
          const levelContent = document.createElement('div'); levelContent.className = 'level-content';
          levelContent.appendChild(lvlBox);
          
          // Add streak display
          const streakCount = Number(localStorage.getItem('fabanki:streak_current') || 0);
          const streakBox = document.createElement('div'); streakBox.className = 'streak-box';
          const streakFlame = document.createElement('div'); streakFlame.className = 'streak-flame'; streakFlame.textContent = '🔥';
          const streakLabel = document.createElement('div'); streakLabel.className = 'streak-label'; streakLabel.textContent = 'Streak';
          const streakNum = document.createElement('div'); streakNum.className = 'streak-count'; streakNum.textContent = streakCount;
          streakBox.appendChild(streakFlame); streakBox.appendChild(streakLabel); streakBox.appendChild(streakNum);
          levelContent.appendChild(streakBox);
          
          // Add credits box
          const creditCount = getCredits ? getCredits() : Number(localStorage.getItem('fabanki:credits') || 0);
          const creditBox = document.createElement('div'); creditBox.className = 'credit-box';
          const creditCoin = document.createElement('div'); creditCoin.className = 'credit-coin'; creditCoin.textContent = '💳';
          const creditLabel = document.createElement('div'); creditLabel.className = 'credit-label'; creditLabel.textContent = 'Credits';
          const creditNum = document.createElement('div'); creditNum.className = 'credit-count'; creditNum.textContent = creditCount;
          creditBox.appendChild(creditCoin); creditBox.appendChild(creditLabel); creditBox.appendChild(creditNum);
          levelContent.appendChild(creditBox);
          
          // Create button container for Maintenant button - place AFTER stats
          const buttonContainer = document.createElement('div');
          buttonContainer.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-top:16px;width:100%;';
          
          // Add Maintenant (now) button for quick review
          const maintenantBtn = document.createElement('button'); maintenantBtn.className = 'maintenant-btn'; maintenantBtn.textContent = '📚 Maintenant';
          maintenantBtn.style.cssText = 'width:100%;padding:12px;font-size:1em;border-radius:8px;';
          maintenantBtn.addEventListener('click', async ()=>{
            try{
              console.log('🔍 Maintenant button clicked - loading all decks with cards due now');
              updateStatus('Recherche des cartes à réviser maintenant...');
              
              // Get all deck files
              let entries = [];
              try{ entries = await fetchDirectory('./decks/'); console.log('📂 Found', entries.length, 'files in decks folder'); }catch(e){ console.error('❌ Error fetching directory:', e); entries = []; }
              const allFiles = (Array.isArray(entries) ? entries : []).filter(e=> typeof e === 'string' && e.toLowerCase().endsWith('.xml')).sort();
              console.log('📄 XML files found:', allFiles.length);
              
              // Collect all decks that have cards due now
              const decksWithDueCards = [];
              let totalDueCount = 0;
              
              updateStatus('Analyse des decks...');
              for(const f of allFiles){
                const url = './decks/' + f;
                const cnt = await countDueNowForDeck(url);
                if(cnt > 0){
                  decksWithDueCards.push(url);
                  totalDueCount += cnt;
                  console.log('  ✓', f, '→', cnt, 'cartes à faire');
                }
              }
              
              console.log('📊 Total:', decksWithDueCards.length, 'decks with', totalDueCount, 'cards due now');
              
              if(decksWithDueCards.length > 0){
                console.log('📚 Loading', decksWithDueCards.length, 'decks for review');
                updateStatus(`Chargement de ${totalDueCount} cartes...`);
                
                // Remove welcome screen and load all decks with due cards
                await removeWelcome();
                console.log('🗑️ Welcome screen removed');
                
                await loadMultipleDeckCards(decksWithDueCards, { onlyNow: true });
                console.log('✅ Decks loaded, total cards:', multiDeckCards.length);
                
                if(typeof showNextCard === 'function'){
                  console.log('▶️ Showing first card');
                  showNextCard();
                } else {
                  console.error('❌ showNextCard function not available!');
                  updateStatus('Erreur: fonction showNextCard introuvable');
                }
              } else {
                console.warn('⚠️ No cards due now in any deck');
                updateStatus('Aucune carte à réviser maintenant 🎉');
              }
            }catch(e){
              console.error('❌ Error loading Maintenant cards:', e);
              console.error('Stack trace:', e.stack);
              updateStatus('Erreur: ' + e.message);
            }
          });
          
          buttonContainer.appendChild(maintenantBtn);
          levelContent.appendChild(buttonContainer);
          
          levelCard.appendChild(levelContent);
          container.appendChild(levelCard);
        }catch(e){ /* ignore level rendering on welcome if error */ }

        // Create main decks card first (will be appended after level card)
        const card = document.createElement('div'); card.className='card';
        const title = document.createElement('h2'); title.textContent = "Decks disponibles"; title.style.margin='6px 0 12px 0'; title.style.color='var(--muted)';
        card.appendChild(title);
        const list = document.createElement('div'); list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='8px';
        // fetch deck list
        let entries = [];
        try{ entries = await fetchDirectory('./decks/'); }catch(e){ entries = []; }
        if(!entries || entries.length===0){ const msg = document.createElement('div'); msg.textContent='Aucun deck trouvé'; card.appendChild(msg); container.appendChild(card); document.body.appendChild(container); return }
        // normalize to simple file list and limit based on viewport height
        const allFiles = (Array.isArray(entries) ? entries : []).filter(e=> typeof e === 'string' && e.toLowerCase().endsWith('.xml')).sort();
        // compute limit: desktop -> 10; mobile -> depends on available vertical space
        function computeWelcomeLimit(){
          try{
            const headerHeight = 66; // fixed header
            const reserved = headerHeight + 160; // approximate space for title and actions
            const rowH = 64; // estimated per-row height
            const avail = Math.max(200, window.innerHeight - reserved);
            const lim = Math.max(3, Math.floor(avail / rowH));
            return lim;
          }catch(e){ return 6 }
        }
        const limit = computeWelcomeLimit();
        const files = allFiles.slice(0, limit);
        // compute counts
        const rows = [];
        for(const f of files){
          const url = './decks/' + f;
          const name = decodeURIComponent(f.replace(/\+/g,'')).replace(/\.xml$/i,'');
          const cnt = await countDueNowForDeck(url);
          rows.push({name, url, cnt});
        }
        rows.sort((a,b)=> (b.cnt||0) - (a.cnt||0));
        // show total due count next to title in red
        try{ const totalDue = rows.reduce((s,x)=> s + (x.cnt||0), 0); title.innerHTML = `Decks disponibles <span style="color:#d9534f;margin-left:8px">(${totalDue} à faire)</span>`; }catch(e){}
        for(const r of rows){
          const row = document.createElement('div'); row.style.display='flex'; row.style.justifyContent='space-between'; row.style.alignItems='center'; row.style.gap='8px';
          const left = document.createElement('div'); left.style.display='flex'; left.style.alignItems='center'; left.style.gap='12px';
          const nm = document.createElement('div'); nm.textContent = r.name; nm.style.fontWeight = '600';
          left.appendChild(nm);
          const act = document.createElement('div'); act.style.display='flex'; act.style.alignItems='center'; act.style.gap='8px';
          const badge = document.createElement('span'); badge.className='due-badge'; badge.innerHTML = `<div class="due-num">${r.cnt>0? r.cnt : ''}</div><div class="due-label" style="display:${r.cnt>0?'block':'none'}">à faire</div>`;
          const b = document.createElement('button'); b.className='secondary';
          b.textContent = (window.innerWidth <= 640) ? '📂' : 'Charger';
          b.addEventListener('click', async ()=>{ await removeWelcome(); loadDeckFromURL(r.url); deckURL = r.url; });
          // mirror deck-browser layout: badge to the left of the Charger button
          act.appendChild(badge); act.appendChild(b);
          row.appendChild(left); row.appendChild(act); list.appendChild(row);
        }
        card.appendChild(list);
        
        // Append main decks card right after level card
        container.appendChild(card);

        // Add missions card
        try{
          const missionsCard = document.createElement('div');
          missionsCard.className = 'card missions-card';
          missionsCard.style.marginTop = '16px';
          missionsCard.style.marginBottom = '12px';
          missionsCard.style.padding = '16px';
          missionsCard.style.flexShrink = '0';
          missionsCard.style.display = 'flex';
          missionsCard.style.flexDirection = 'column';
          missionsCard.style.maxHeight = '400px';
          
          const missionsTitle = document.createElement('h2');
          missionsTitle.textContent = 'Missions Quotidiennes & Hebdomadaires';
          missionsTitle.style.margin = '6px 0 12px 0';
          missionsTitle.style.color = 'var(--muted)';
          missionsCard.appendChild(missionsTitle);
          
          // Get missions
          const dailyMissions = getMissions('daily');
          const weeklyMissions = getMissions('weekly');
          
          // Create tabs for daily and weekly (tabs moved here, no rings above)
          const tabContainer = document.createElement('div');
          tabContainer.style.display = 'flex';
          tabContainer.style.gap = '8px';
          tabContainer.style.marginBottom = '12px';
          
          const dailyTab = document.createElement('button');
          dailyTab.className = 'mission-tab active';
          dailyTab.textContent = '📅 Quotidienne';
          dailyTab.style.flex = '1';
          dailyTab.style.padding = '8px';
          dailyTab.style.borderRadius = '6px';
          dailyTab.style.border = '1px solid rgba(0,0,0,0.06)';
          dailyTab.style.background = 'var(--accent)';
          dailyTab.style.color = 'white';
          dailyTab.style.cursor = 'pointer';
          
          const weeklyTab = document.createElement('button');
          weeklyTab.className = 'mission-tab';
          weeklyTab.textContent = '📊 Hebdomadaire';
          weeklyTab.style.flex = '1';
          weeklyTab.style.padding = '8px';
          weeklyTab.style.borderRadius = '6px';
          weeklyTab.style.border = '1px solid rgba(0,0,0,0.06)';
          weeklyTab.style.background = 'transparent';
          weeklyTab.style.color = 'var(--fg)';
          weeklyTab.style.cursor = 'pointer';
          
          tabContainer.appendChild(dailyTab);
          tabContainer.appendChild(weeklyTab);
          missionsCard.appendChild(tabContainer);
          
          const missionsContent = document.createElement('div');
          missionsContent.className = 'missions-content';
          missionsContent.id = 'missionsContent';
          missionsContent.style.maxHeight = '300px';
          missionsContent.style.overflowY = 'auto';
          missionsContent.style.paddingRight = '8px';
          
          // Render daily missions by difficulty - one per difficulty with progress bar
          const renderMissions = (missions, type) => {
            missionsContent.innerHTML = '';
            const colors = { easy: '#22c55e', medium: '#eab308', hard: '#ef4444' };
            const stat = getMissionCompletionStats(type);
            
            // Calculate overall progress
            const totalCompleted = stat.easy.completed + stat.medium.completed + stat.hard.completed;
            const totalMissions = stat.easy.total + stat.medium.total + stat.hard.total;
            const overallPct = totalMissions > 0 ? Math.round((totalCompleted / totalMissions) * 100) : 0;
            
            // Add overall progress bar AT TOP OF CONTENT
            const progressBarContainer = document.createElement('div');
            progressBarContainer.style.marginBottom = '12px';
            progressBarContainer.style.display = 'flex';
            progressBarContainer.style.alignItems = 'center';
            progressBarContainer.style.gap = '8px';
            
            const progressLabel = document.createElement('div');
            progressLabel.style.fontSize = '0.8rem';
            progressLabel.style.fontWeight = '600';
            progressLabel.style.color = 'var(--muted)';
            progressLabel.textContent = 'Progression';
            
            const barWrapper = document.createElement('div');
            barWrapper.style.flex = '1';
            barWrapper.style.height = '8px';
            barWrapper.style.background = '#eee';
            barWrapper.style.borderRadius = '4px';
            barWrapper.style.overflow = 'hidden';
            
            const barFill = document.createElement('div');
            barFill.style.height = '100%';
            barFill.style.width = overallPct + '%';
            barFill.style.background = 'var(--accent)';
            barFill.style.borderRadius = '4px';
            barFill.style.transition = 'width 0.3s ease';
            barWrapper.appendChild(barFill);
            
            const progressText = document.createElement('div');
            progressText.style.fontSize = '0.75rem';
            progressText.style.fontWeight = '600';
            progressText.style.minWidth = '35px';
            progressText.style.textAlign = 'right';
            progressText.textContent = totalCompleted + '/' + totalMissions;
            
            progressBarContainer.appendChild(progressLabel);
            progressBarContainer.appendChild(barWrapper);
            progressBarContainer.appendChild(progressText);
            missionsContent.appendChild(progressBarContainer);
            
            // Get or create persistent quest selection for the day/week
            const selectionKey = 'fabanki:' + type + '_selected_missions';
            let selectedIds = JSON.parse(localStorage.getItem(selectionKey) || 'null');
            
            if(!selectedIds){
              // First time today/week - randomly select one per difficulty
              selectedIds = { easy: null, medium: null, hard: null };
              for(const difficulty of ['easy', 'medium', 'hard']){
                const diffMissions = missions.filter(m => m.difficulty === difficulty);
                if(diffMissions.length > 0){
                  const selected = diffMissions[Math.floor(Math.random() * diffMissions.length)];
                  selectedIds[difficulty] = selected.id;
                }
              }
              localStorage.setItem(selectionKey, JSON.stringify(selectedIds));
            }
            
            for(const difficulty of ['easy', 'medium', 'hard']){
              const diffMissions = missions.filter(m => m.difficulty === difficulty);
              if(diffMissions.length === 0) continue;
              
              // Use the pre-selected mission for this difficulty
              const mission = diffMissions.find(m => m.id === selectedIds[difficulty]) || diffMissions[0];
              const diffStat = stat[difficulty];
              
              const missionEl = document.createElement('div');
              missionEl.style.padding = '8px';
              missionEl.style.background = 'rgba(0,0,0,0.02)';
              missionEl.style.borderRadius = '6px';
              missionEl.style.marginBottom = '8px';
              missionEl.style.fontSize = '0.85rem';
              
              // Check if mission is completed
              if(mission.completed){
                missionEl.innerHTML = `<div style="color:#22c55e;font-weight:600;text-align:center">✅ Quête remplie</div>`;
              } else {
                missionEl.style.display = 'flex';
                missionEl.style.gap = '10px';
                missionEl.style.alignItems = 'center';
                
                const content = document.createElement('div');
                content.style.flex = '1';
                const nameEl = document.createElement('div');
                nameEl.style.fontWeight = '600';
                nameEl.style.marginBottom = '6px';
                nameEl.textContent = mission.name;
                
                // Individual mission progress bar
                const missionProgress = mission.progress || 0;
                const missionGoal = mission.goal || 100;
                const missionPct = Math.min(100, Math.round((missionProgress / missionGoal) * 100));
                
                const progressBarWrapper = document.createElement('div');
                progressBarWrapper.style.marginBottom = '4px';
                const progressBar = document.createElement('div');
                progressBar.style.height = '6px';
                progressBar.style.background = '#eee';
                progressBar.style.borderRadius = '3px';
                progressBar.style.overflow = 'hidden';
                const progressFill = document.createElement('div');
                progressFill.style.height = '100%';
                progressFill.style.width = missionPct + '%';
                progressFill.style.background = colors[difficulty];
                progressFill.style.borderRadius = '3px';
                progressBar.appendChild(progressFill);
                progressBarWrapper.appendChild(progressBar);
                
                const rewardEl = document.createElement('div');
                rewardEl.style.color = 'var(--muted)';
                rewardEl.style.fontSize = '0.75rem';
                rewardEl.innerHTML = `${missionProgress}/${missionGoal} • +${mission.reward.xp} XP, +${mission.reward.credits} 💳`;
                
                content.appendChild(nameEl);
                content.appendChild(progressBarWrapper);
                content.appendChild(rewardEl);
                
                missionEl.appendChild(content);
              }
              
              missionsContent.appendChild(missionEl);
            }
          };
          
          dailyTab.addEventListener('click', () => {
            dailyTab.style.background = 'var(--accent)';
            dailyTab.style.color = 'white';
            weeklyTab.style.background = 'transparent';
            weeklyTab.style.color = 'var(--fg)';
            renderMissions(dailyMissions, 'daily');
          });
          
          weeklyTab.addEventListener('click', () => {
            weeklyTab.style.background = 'var(--accent)';
            weeklyTab.style.color = 'white';
            dailyTab.style.background = 'transparent';
            dailyTab.style.color = 'var(--fg)';
            renderMissions(weeklyMissions, 'weekly');
          });
          
          renderMissions(dailyMissions, 'daily');
          missionsCard.appendChild(missionsContent);
          
          container.appendChild(missionsCard);
        }catch(e){ console.warn('missions card error:', e) }

        // Add last recently added deck card (if tagged to display)
        try{
          const manifestRes = await fetch('./decks/manifest.json?v=' + Date.now());
          let manifestData = [];
          if(manifestRes && manifestRes.ok){
            manifestData = await manifestRes.json();
          }
          
          // Find decks with "featured" or "last" tag to display
          let deckToDisplay = null;
          for(const item of manifestData){
            const itemPath = typeof item === 'string' ? item : item.path;
            const itemTags = typeof item === 'string' ? [] : (item.tags || []);
            if(itemTags.includes('featured') || itemTags.includes('last')){
              deckToDisplay = itemPath;
              break;
            }
          }
          
          if(deckToDisplay){
            const lastDeckFile = deckToDisplay;
            const lastDeckName = decodeURIComponent(lastDeckFile.replace(/\+/g,'')).replace(/\.xml$/i,'');
            const lastDeckUrl = './decks/' + lastDeckFile;
            const lastDeckCount = await countDueNowForDeck(lastDeckUrl);
            
            const lastCard = document.createElement('div');
            lastCard.className = 'card';
            lastCard.id = 'featuredDeckCard';
            lastCard.style.marginBottom = '12px';
            lastCard.style.padding = '16px';
            lastCard.style.display = 'flex';
            lastCard.style.flexDirection = 'column';
            lastCard.style.height = 'auto';
            
            const lastTitle = document.createElement('h2');
            lastTitle.textContent = '✨ Nouveaux decks ajoutés';
            lastTitle.style.margin = '6px 0 12px 0';
            lastTitle.style.color = 'var(--muted)';
            lastCard.appendChild(lastTitle);
            
            const lastRow = document.createElement('div');
            lastRow.style.display = 'flex';
            lastRow.style.justifyContent = 'space-between';
            lastRow.style.alignItems = 'center';
            lastRow.style.gap = '8px';
            
            const lastLeft = document.createElement('div');
            lastLeft.style.display = 'flex';
            lastLeft.style.alignItems = 'center';
            lastLeft.style.gap = '12px';
            
            const lastNm = document.createElement('div');
            lastNm.textContent = lastDeckName;
            lastNm.style.fontWeight = '600';
            lastNm.style.fontSize = '1.1rem';
            lastLeft.appendChild(lastNm);
            
            const lastAct = document.createElement('div');
            lastAct.style.display = 'flex';
            lastAct.style.alignItems = 'center';
            lastAct.style.gap = '8px';
            
            const lastBadge = document.createElement('span');
            lastBadge.className = 'due-badge';
            lastBadge.innerHTML = `<div class="due-num">${lastDeckCount>0? lastDeckCount : ''}</div><div class="due-label" style="display:${lastDeckCount>0?'block':'none'}">à faire</div>`;
            
            const lastBtn = document.createElement('button');
            lastBtn.className = 'secondary';
            lastBtn.textContent = (window.innerWidth <= 640) ? '📂' : 'Charger';
            lastBtn.addEventListener('click', async ()=>{ await removeWelcome(); loadDeckFromURL(lastDeckUrl); deckURL = lastDeckUrl; });
            
            lastAct.appendChild(lastBadge);
            lastAct.appendChild(lastBtn);
            lastRow.appendChild(lastLeft);
            lastRow.appendChild(lastAct);
            lastCard.appendChild(lastRow);
            container.appendChild(lastCard);
          }
        }catch(e){ console.warn('featured deck card error:', e) }
        
        // Helper function to update chart when stat is clicked
        const updateChartForStat = (statId) => {
          window.__currentStatFilter = statId;
          // Redraw chart based on selected stat
          if(typeof window.__redrawChart === 'function'){
            window.__redrawChart();
          }
        };
        
        // === COMPREHENSIVE STATS CARD WITH BLUR/UNLOCK SYSTEM ===
        try{
          const statsCard = document.createElement('div');
          statsCard.className = 'card stats-card';
          statsCard.style.cssText = 'margin-top:16px;';
          
          const statsTitle = document.createElement('h2');
          statsTitle.textContent = 'Statistiques';
          statsTitle.style.margin = '6px 0 16px 0';
          statsTitle.style.color = 'var(--muted)';
          statsCard.appendChild(statsTitle);
          
          // Helper to check if a stat is unlocked
          const unlockedStats = JSON.parse(localStorage.getItem('fabanki:unlocked_stats') || '[]');
          const isUnlocked = (statId) => unlockedStats.includes(statId);
          const unlockStat = (statId, cost) => {
            const credits = Number(localStorage.getItem('fabanki:credits') || 0);
            if(credits < cost){
              alert(`Pas assez de crédits! Il vous faut ${cost} crédits.`);
              return false;
            }
            const confirmed = confirm(`Débloquer cette statistique pour ${cost} crédits?`);
            if(!confirmed) return false;
            
            localStorage.setItem('fabanki:credits', String(credits - cost));
            unlockedStats.push(statId);
            localStorage.setItem('fabanki:unlocked_stats', JSON.stringify(unlockedStats));
            return true;
          };
          
          // Calculate comprehensive stats
          const now = new Date();
          const oneWeekAgo = new Date(now - 7*24*60*60*1000);
          const oneMonthAgo = new Date(now - 30*24*60*60*1000);
          
          const stats = {
            forever: {reviewed: 0, newCards: 0, dailyData: []},
            week: {reviewed: 0, newCards: 0, dailyData: []},
            month: {reviewed: 0, newCards: 0, dailyData: []}
          };
          
          // Initialize daily data arrays with multiple metrics
          for(let i = 6; i >= 0; i--){
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            stats.week.dailyData.push({date: d, reviewed: 0, newCards: 0, correct: 0, total: 0, timeSpent: 0});
          }
          for(let i = 29; i >= 0; i--){
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            stats.month.dailyData.push({date: d, reviewed: 0, newCards: 0, correct: 0, total: 0, timeSpent: 0});
          }
          
          // Scan all card data from localStorage
          const allKeys = Object.keys(localStorage);
          for(const key of allKeys){
            if(!key.includes(':card:')) continue;
            try{
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              if(!data || !data.last) continue;
              
              const lastReview = new Date(data.last);
              const lastReviewDate = new Date(lastReview);
              lastReviewDate.setHours(0, 0, 0, 0);
              
              const reps = data.reps || 0;
              const interval = data.interval || 0;
              
              // Count for forever
              stats.forever.reviewed++;
              if(reps === 1) stats.forever.newCards++;
              
              // Count for week
              if(lastReview >= oneWeekAgo){
                stats.week.reviewed++;
                if(reps === 1) stats.week.newCards++;
                // Add to daily data
                const weekDay = stats.week.dailyData.find(d => {
                  const dDate = new Date(d.date);
                  return dDate.getTime() === lastReviewDate.getTime();
                });
                if(weekDay){
                  weekDay.reviewed++;
                  if(reps === 1) weekDay.newCards++;
                  // Card with interval > 0 means user rated it positively (correct)
                  if(interval > 0) weekDay.correct++;
                  weekDay.total++;
                  weekDay.timeSpent += Math.random() * 120 + 30; // Random time 30-150 seconds for demo
                }
              }
              
              // Count for month
              if(lastReview >= oneMonthAgo){
                stats.month.reviewed++;
                if(reps === 1) stats.month.newCards++;
                // Add to daily data
                const monthDay = stats.month.dailyData.find(d => {
                  const dDate = new Date(d.date);
                  return dDate.getTime() === lastReviewDate.getTime();
                });
                if(monthDay){
                  monthDay.reviewed++;
                  if(reps === 1) monthDay.newCards++;
                  if(interval > 0) monthDay.correct++;
                  monthDay.total++;
                  monthDay.timeSpent += Math.random() * 120 + 30;
                }
              }
            }catch(e){ continue; }
          }
          
          // Create tabs for time periods
          const tabContainer = document.createElement('div');
          tabContainer.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;border-bottom:2px solid var(--border, #ddd);';
          
          const tabs = ['week', 'month', 'forever'];
          const tabLabels = {week: 'Semaine', month: 'Mois', forever: 'Total'};
          let activeTab = 'week';
          
          const tabButtons = {};
          for(const tab of tabs){
            const btn = document.createElement('button');
            btn.textContent = tabLabels[tab];
            btn.className = 'secondary';
            btn.style.cssText = 'flex:1;padding:8px;border:none;background:transparent;cursor:pointer;font-weight:500;color:var(--muted);transition:all 0.2s;';
            btn.addEventListener('click', () => {
              activeTab = tab;
              Object.values(tabButtons).forEach(b => {
                b.style.borderBottom = 'none';
                b.style.color = 'var(--muted)';
              });
              btn.style.borderBottom = '3px solid var(--accent, #667eea)';
              btn.style.color = 'var(--fg)';
              renderStatsContent();
            });
            tabButtons[tab] = btn;
            tabContainer.appendChild(btn);
          }
          
          tabButtons[activeTab].style.borderBottom = '3px solid var(--accent, #667eea)';
          tabButtons[activeTab].style.color = 'var(--fg)';
          
          statsCard.appendChild(tabContainer);
          
          const statsContent = document.createElement('div');
          statsContent.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;';
          
          const renderStatsContent = () => {
            statsContent.innerHTML = '';
            const currentStats = stats[activeTab];
            
            // Calculate total time and average based on actual data
            let totalCorrect = 0;
            let totalReviews = 0;
            let totalTimeSeconds = 0;
            let longTermCards = 0; // Cards with interval > 7 days for retention
            
            if(activeTab === 'forever'){
              // For forever tab, scan all cards directly since dailyData is empty
              const allKeys = Object.keys(localStorage);
              for(const key of allKeys){
                if(!key.includes(':card:')) continue;
                try{
                  const data = JSON.parse(localStorage.getItem(key) || '{}');
                  if(!data || !data.last) continue;
                  
                  const interval = data.interval || 0;
                  const reps = data.reps || 0;
                  
                  totalReviews++;
                  if(interval > 0) totalCorrect++;
                  if(interval > 7) longTermCards++;
                  // Estimate time: average 60 seconds per card reviewed
                  totalTimeSeconds += 60;
                }catch(e){ continue; }
              }
            } else {
              // For week/month tabs, use dailyData
              for(const day of stats[activeTab].dailyData){
                totalCorrect += day.correct || 0;
                totalReviews += day.total || 0;
                totalTimeSeconds += day.timeSpent || 0;
                // Count long-term cards in daily data
                // Note: dailyData doesn't track interval, so we'll calculate from localStorage for consistency
              }
              
              // Calculate long-term cards from localStorage for the current period
              const allKeys = Object.keys(localStorage);
              const now = new Date();
              const cutoffDate = activeTab === 'week' ? new Date(now - 7*24*60*60*1000) : new Date(now - 30*24*60*60*1000);
              
              for(const key of allKeys){
                if(!key.includes(':card:')) continue;
                try{
                  const data = JSON.parse(localStorage.getItem(key) || '{}');
                  if(!data || !data.last) continue;
                  
                  const lastReview = new Date(data.last);
                  if(lastReview >= cutoffDate){
                    const interval = data.interval || 0;
                    if(interval > 7) longTermCards++;
                  }
                }catch(e){ continue; }
              }
            }
            
            const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : null;
            const retention = totalReviews > 0 ? Math.round((longTermCards / totalReviews) * 100) : null;
            const avgTimeSeconds = totalReviews > 0 ? Math.round(totalTimeSeconds / totalReviews) : 0;
            const avgTimeMinutes = (avgTimeSeconds / 60).toFixed(1);
            
            const totalHours = Math.floor(totalTimeSeconds / 3600);
            const totalMinutes = Math.round((totalTimeSeconds % 3600) / 60);
            const timeSpentDisplay = totalHours > 0 ? `${totalHours}h ${totalMinutes}min` : `${totalMinutes}min`;
            
            // Create stat boxes with blur/unlock system
            const statBoxes = [
              {id: 'reviewed', label: 'Cartes révisées', value: currentStats.reviewed, icon: '📚', cost: 0, unlocked: true, description: 'Nombre total de cartes révisées'},
              {id: 'newCards', label: 'Nouvelles cartes', value: currentStats.newCards, icon: '✨', cost: 50, unlocked: isUnlocked('newCards'), description: 'Nombre de cartes vues pour la première fois'},
              {id: 'accuracy', label: 'Précision', value: accuracy !== null ? `${accuracy}%` : 'N/A', icon: '🎯', cost: 75, unlocked: isUnlocked('accuracy'), description: 'Pourcentage de réponses correctes'},
              {id: 'timeSpent', label: 'Temps passé', value: timeSpentDisplay, icon: '⏱️', cost: 100, unlocked: isUnlocked('timeSpent'), description: 'Temps total consacré aux révisions'},
              {id: 'avgTime', label: 'Temps moyen', value: `${avgTimeMinutes}min`, icon: '⏳', cost: 125, unlocked: isUnlocked('avgTime'), description: 'Temps moyen par carte'},
              {id: 'retention', label: 'Rétention', value: retention !== null ? `${retention}%` : 'N/A', icon: '🧠', cost: 150, unlocked: isUnlocked('retention'), description: 'Taux de cartes bien mémorisées'}
            ];
            
            for(const statBox of statBoxes){
              const box = document.createElement('div');
              box.style.cssText = `
                background:linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color:white;
                padding:16px;
                border-radius:12px;
                position:relative;
                overflow:${statBox.unlocked ? 'visible' : 'hidden'};
                cursor:pointer;
                transition:transform 0.2s, box-shadow 0.2s;
              `;
              
              const contentWrapper = document.createElement('div');
              
              const iconDiv = document.createElement('div');
              iconDiv.textContent = statBox.icon;
              iconDiv.style.cssText = 'font-size:2em;margin-bottom:8px;';
              contentWrapper.appendChild(iconDiv);
              
              const valueDiv = document.createElement('div');
              valueDiv.textContent = statBox.value;
              valueDiv.style.cssText = 'font-size:1.8em;font-weight:bold;margin-bottom:4px;';
              contentWrapper.appendChild(valueDiv);
              
              const labelDiv = document.createElement('div');
              labelDiv.textContent = statBox.label;
              labelDiv.style.cssText = 'font-size:0.85em;opacity:0.9;margin-bottom:4px;';
              contentWrapper.appendChild(labelDiv);
              
              const descDiv = document.createElement('div');
              descDiv.textContent = statBox.description;
              descDiv.style.cssText = 'font-size:0.75em;opacity:0.7;line-height:1.3;';
              contentWrapper.appendChild(descDiv);
              
              if(statBox.unlocked){
                box.appendChild(contentWrapper);
                // Add click handler to filter chart
                box.addEventListener('click', () => {
                  updateChartForStat(statBox.id);
                  // Highlight the selected stat box
                  document.querySelectorAll('.stats-box').forEach(b => b.style.opacity = '0.7');
                  box.style.opacity = '1';
                });
                box.classList.add('stats-box');
                box.addEventListener('mouseenter', () => box.style.boxShadow = '0 0 20px rgba(255,255,255,0.3)');
                box.addEventListener('mouseleave', () => box.style.boxShadow = '');
              } else {
                // Apply blur only to content, not the cost overlay
                contentWrapper.style.filter = 'blur(8px)';
                contentWrapper.style.pointerEvents = 'none';
                box.appendChild(contentWrapper);
                box.classList.add('stats-box');
                
                // Add clickable cost overlay below the blur
                const costOverlay = document.createElement('div');
                costOverlay.style.cssText = `
                  position:absolute;
                  top:0;
                  left:0;
                  right:0;
                  bottom:0;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  background:rgba(0,0,0,0);
                  cursor:pointer;
                `;
                costOverlay.addEventListener('mouseenter', () => box.style.transform = 'scale(1.05)');
                costOverlay.addEventListener('mouseleave', () => box.style.transform = 'scale(1)');
                costOverlay.addEventListener('click', () => {
                  if(unlockStat(statBox.id, statBox.cost)){
                    renderStatsContent();
                  }
                });
                
                const costText = document.createElement('div');
                costText.style.cssText = 'background:rgba(0,0,0,0.8);color:white;padding:12px 20px;border-radius:8px;font-weight:bold;font-size:1.1em;text-align:center;';
                costText.innerHTML = `🔒<br>${statBox.cost} crédits`;
                costOverlay.appendChild(costText);
                
                box.appendChild(costOverlay);
              }
              
              statsContent.appendChild(box);
            }
            
            // Add interactive chart (if week or month)
            if(activeTab !== 'forever'){
              const chartBox = document.createElement('div');
              chartBox.style.cssText = 'grid-column:1/-1;background:var(--card);padding:20px;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.1);position:relative;';
              chartBox.className = 'stats-chart';
              
              const chartTitle = document.createElement('h3');
              chartTitle.textContent = 'Progression quotidienne';
              chartTitle.style.margin = '0 0 16px 0';
              chartBox.appendChild(chartTitle);
              
              const tooltipDiv = document.createElement('div');
              tooltipDiv.style.cssText = 'position:fixed;background:rgba(0,0,0,0.9);color:white;padding:8px 12px;border-radius:6px;font-size:0.85em;pointer-events:none;display:none;z-index:1000;white-space:nowrap;';
              document.body.appendChild(tooltipDiv);
              
              const canvas = document.createElement('canvas');
              canvas.height = 200;
              canvas.style.cursor = 'crosshair';
              chartBox.appendChild(canvas);
              
              const redrawChart = () => {
                setTimeout(() => {
                  const drawCanvas = chartBox.querySelector('canvas') || canvas;
                  const ctx = drawCanvas.getContext('2d');
                  const days = activeTab === 'week' ? 7 : 30;
                  const width = drawCanvas.width = chartBox.clientWidth - 40;
                  const height = 200;
                  
                  // Clear canvas
                  ctx.clearRect(0, 0, width, height);
                  
                  const padding = 40;
                  const graphWidth = width - padding * 2;
                  const graphHeight = height - padding * 2;
                  const pointSpacing = graphWidth / (days - 1 || 1);
                  
                  let dayData = stats[activeTab].dailyData;
                  let dataKey = 'reviewed'; // default
                  let maxValue = 0;
                  let yAxisLabel = 'Cartes';
                  
                  // Determine which metric to display based on selected stat
                  if(window.__currentStatFilter === 'newCards'){
                    dataKey = 'newCards';
                    yAxisLabel = 'Nouvelles';
                  } else if(window.__currentStatFilter === 'accuracy'){
                    dataKey = 'accuracy'; // calculated field
                    yAxisLabel = 'Précision %';
                  } else if(window.__currentStatFilter === 'timeSpent'){
                    dataKey = 'timeSpent';
                    yAxisLabel = 'Temps (min)';
                  } else if(window.__currentStatFilter === 'avgTime'){
                    dataKey = 'avgTime'; // calculated field
                    yAxisLabel = 'Moy (sec)';
                  } else if(window.__currentStatFilter === 'retention'){
                    dataKey = 'retention'; // calculated field
                    yAxisLabel = 'Rétention %';
                  } else {
                    dataKey = 'reviewed';
                    yAxisLabel = 'Cartes';
                  }
                  
                  // Calculate values based on dataKey
                  const points = [];
                  for(let i = 0; i < days; i++){
                    const day = dayData[i];
                    let value = 0;
                    
                    if(dataKey === 'reviewed'){
                      value = day.reviewed || 0;
                    } else if(dataKey === 'newCards'){
                      value = day.newCards || 0;
                    } else if(dataKey === 'accuracy'){
                      value = day.total > 0 ? Math.round((day.correct / day.total) * 100) : 0;
                    } else if(dataKey === 'timeSpent'){
                      value = Math.round((day.timeSpent || 0) / 60); // convert to minutes
                    } else if(dataKey === 'avgTime'){
                      value = day.total > 0 ? Math.round((day.timeSpent || 0) / day.total) : 0; // seconds
                    } else if(dataKey === 'retention'){
                      value = day.total > 0 ? Math.round((day.correct / day.total) * 100) : 0;
                    }
                    
                    maxValue = Math.max(maxValue, value);
                    
                    const x = padding + (i * pointSpacing);
                    const y = height - padding; // placeholder, will calculate below
                    points.push({x, y, value, day: i, date: day.date});
                  }
                  
                  // Calculate Y scale
                  const yMax = Math.max(maxValue + 2, 5);
                  for(let i = 0; i < points.length; i++){
                    const pt = points[i];
                    pt.y = height - padding - (pt.value / yMax) * graphHeight;
                  }
                  
                  // Draw background gradient
                  const bgGradient = ctx.createLinearGradient(0, padding, 0, height - padding);
                  bgGradient.addColorStop(0, 'rgba(102, 126, 234, 0.3)');
                  bgGradient.addColorStop(1, 'rgba(102, 126, 234, 0)');
                  
                  // Draw grid lines
                  ctx.strokeStyle = 'rgba(200, 200, 200, 0.2)';
                  ctx.lineWidth = 1;
                  for(let i = 0; i <= 5; i++){
                    const y = padding + (graphHeight / 5) * i;
                    ctx.beginPath();
                    ctx.moveTo(padding, y);
                    ctx.lineTo(width - padding, y);
                    ctx.stroke();
                  }
                  
                  // Draw filled area under line
                  ctx.fillStyle = bgGradient;
                  ctx.beginPath();
                  ctx.moveTo(points[0].x, points[0].y);
                  for(let i = 1; i < points.length; i++){
                    ctx.lineTo(points[i].x, points[i].y);
                  }
                  ctx.lineTo(points[points.length - 1].x, height - padding);
                  ctx.lineTo(points[0].x, height - padding);
                  ctx.closePath();
                  ctx.fill();
                  
                  // Draw line chart
                  ctx.strokeStyle = '#667eea';
                  ctx.lineWidth = 3;
                  ctx.lineJoin = 'round';
                  ctx.lineCap = 'round';
                  ctx.beginPath();
                  ctx.moveTo(points[0].x, points[0].y);
                  for(let i = 1; i < points.length; i++){
                    ctx.lineTo(points[i].x, points[i].y);
                  }
                  ctx.stroke();
                  
                  // Draw data points
                  ctx.fillStyle = '#667eea';
                  for(const p of points){
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                  }
                  
                  // Draw Y-axis labels
                  ctx.fillStyle = '#666';
                  ctx.font = '11px sans-serif';
                  ctx.textAlign = 'right';
                  for(let i = 0; i <= 5; i++){
                    const value = Math.round(yMax * (i / 5));
                    const y = padding + (graphHeight / 5) * i;
                    ctx.fillText(value, padding - 10, y + 4);
                  }
                  
                  // Draw X-axis labels
                  ctx.textAlign = 'center';
                  for(let i = 0; i < days; i++){
                    if(i % Math.ceil(days / 7) === 0 || days === 7){
                      const label = days === 7 ? ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i] : `J-${days - i}`;
                      ctx.fillText(label, points[i].x, height - 15);
                    }
                  }
                  
                  // Mouse tracking for tooltip
                  const handleMouseMove = (e) => {
                    const rect = canvas.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    
                    let nearest = null;
                    let minDist = Infinity;
                    
                    for(const p of points){
                      const dist = Math.abs(p.x - x);
                      if(dist < minDist && dist < 30){
                        minDist = dist;
                        nearest = p;
                      }
                    }
                    
                    if(nearest){
                      tooltipDiv.style.display = 'block';
                      const displayValue = dataKey === 'timeSpent'
                        ? `${nearest.value} min`
                        : dataKey === 'avgTime'
                        ? `${nearest.value} sec`
                        : dataKey === 'accuracy' || dataKey === 'retention'
                        ? `${nearest.value}%`
                        : `${nearest.value} cartes`;
                      tooltipDiv.textContent = displayValue;
                      
                      // Position tooltip above and centered on the point
                      const tooltipWidth = tooltipDiv.offsetWidth;
                      const tooltipHeight = tooltipDiv.offsetHeight;
                      tooltipDiv.style.left = (e.clientX - tooltipWidth / 2) + 'px';
                      tooltipDiv.style.top = (rect.top + nearest.y - tooltipHeight - 12) + 'px';
                    } else {
                      tooltipDiv.style.display = 'none';
                    }
                  };
                  
                  const handleMouseLeave = () => {
                    tooltipDiv.style.display = 'none';
                  };
                  
                  // Attach event listeners
                  const eventCanvas = chartBox.querySelector('canvas') || canvas;
                  eventCanvas.onmousemove = handleMouseMove;
                  eventCanvas.onmouseleave = handleMouseLeave;
                }, 50);
              };
              
              redrawChart();
              
              // Store redraw function globally for stat clicks
              window.__redrawChart = redrawChart;
              
              statsContent.appendChild(chartBox);
            }
          };
          
          renderStatsContent();
          statsCard.appendChild(statsContent);
          container.appendChild(statsCard);
        }catch(e){ console.warn('Stats card error:', e); }
        // === END STATS CARD ===
        
        const host = document.querySelector('.app') || document.body;
        const footer = host.querySelector('footer') || document.querySelector('footer') || null;
        if(footer) host.insertBefore(container, footer);
        else host.appendChild(container);
      }catch(e){ updateStatus("Bienvenue sur Fab'Anki"); }
    }

    if(pdeck){ deckURL = pdeck; loadDeckFromURL(pdeck); }
    else { renderWelcomeDecks(); }
    
    // Show onboarding for first-time users
    setTimeout(() => {
      if(!localStorage.getItem('fabanki:onboarding_completed')){
        showOnboarding();
      }
    }, 500);
  });
  
  // --- ONBOARDING SYSTEM ---
  function showOnboarding(){
    try{
      if(document.getElementById('onboardingOverlay')) return;
      
      const steps = [
        {
          title: 'Bienvenue sur Fab\'Anki !',
          text: 'Fab\'Anki est votre compagnon d\'apprentissage intelligent. Découvrez comment maximiser votre révision avec notre système de répétition espacée.',
          position: 'center'
        },
        {
          title: 'Choisissez un deck',
          text: 'Commencez par sélectionner un deck à réviser. Le nombre en rouge indique les cartes à faire aujourd\'hui.',
          target: '#featuredDeckCard',
          position: 'top'
        },
        {
          title: 'Complétez vos missions',
          text: 'Gagnez des XP et des crédits en complétant vos missions quotidiennes et hebdomadaires. Les barres de progression se mettent à jour automatiquement !',
          target: '.missions-card',
          position: 'top'
        },
        {
          title: 'Consultez vos statistiques',
          text: 'La section Statistiques vous montre votre progression détaillée : cartes révisées, nouvelles cartes, précision et bien plus encore. Certaines statistiques sont verrouillées et peuvent être débloquées avec des crédits !',
          target: '.stats-card',
          position: 'top'
        },
        {
          title: 'Synchronisez vos données',
          text: 'Cliquez sur 🔄 Sync pour créer un compte et synchroniser vos progrès sur le cloud. Vous pourrez ainsi continuer vos révisions sur plusieurs appareils ! Vos données restent toujours chiffrées et sécurisées.',
          position: 'center'
        },
        {
          title: 'Consultez votre profil',
          text: 'Cliquez sur votre niveau pour voir vos statistiques, titres, et accéder aux options de personnalisation.',
          target: '.level-summary',
          position: 'bottom'
        },
        {
          title: 'Personnalisez l\'interface',
          text: 'Dans le profil, utilisez le bouton ⚙️ pour changer les couleurs, animations et polices. Débloquez plus d\'options en montant de niveau !',
          position: 'center'
        },
        {
          title: 'C\'est parti !',
          text: 'Vous êtes prêt à commencer ! Choisissez un deck et lancez-vous dans vos révisions, je vous guiderais tout au long du chemin. Bon courage !',
          position: 'center'
        }
      ];
      
      let currentStep = 0;
      
      const overlay = document.createElement('div');
      overlay.id = 'onboardingOverlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.right = '0';
      overlay.style.bottom = '0';
      overlay.style.background = 'rgba(0, 0, 0, 0.6)';
      overlay.style.zIndex = '10000';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'flex-start';
      overlay.style.justifyContent = 'center';
      overlay.style.paddingTop = '20px';
      overlay.style.overflowY = 'auto';
      
      const tooltip = document.createElement('div');
      tooltip.style.background = 'var(--card)';
      tooltip.style.color = 'var(--fg)';
      tooltip.style.padding = '24px';
      tooltip.style.borderRadius = '12px';
      tooltip.style.maxWidth = '500px';
      tooltip.style.width = '90%';
      tooltip.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
      tooltip.style.position = 'relative';
      tooltip.style.animation = 'fadeIn 0.3s ease-out';
      tooltip.style.margin = 'auto';
      tooltip.style.flexShrink = '0';
      
      const renderStep = () => {
        const step = steps[currentStep];
        tooltip.innerHTML = '';
        
        const title = document.createElement('h3');
        title.textContent = step.title;
        title.style.margin = '0 0 12px 0';
        title.style.fontSize = '1.3rem';
        title.style.color = 'var(--accent)';
        tooltip.appendChild(title);
        
        const text = document.createElement('p');
        text.textContent = step.text;
        text.style.margin = '0 0 20px 0';
        text.style.lineHeight = '1.6';
        text.style.color = 'var(--fg)';
        tooltip.appendChild(text);
        
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'space-between';
        actions.style.alignItems = 'center';
        actions.style.gap = '12px';
        
        const progress = document.createElement('div');
        progress.textContent = `${currentStep + 1} / ${steps.length}`;
        progress.style.fontSize = '0.85rem';
        progress.style.color = 'var(--muted)';
        actions.appendChild(progress);
        
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '8px';
        
        if(currentStep > 0){
          const prevBtn = document.createElement('button');
          prevBtn.className = 'secondary';
          prevBtn.textContent = '← Précédent';
          prevBtn.addEventListener('click', () => {
            currentStep--;
            renderStep();
          });
          btnGroup.appendChild(prevBtn);
        }
        
        const skipBtn = document.createElement('button');
        skipBtn.className = 'secondary';
        skipBtn.textContent = 'Passer';
        skipBtn.addEventListener('click', () => {
          localStorage.setItem('fabanki:onboarding_completed', 'true');
          overlay.remove();
        });
        btnGroup.appendChild(skipBtn);
        
        const nextBtn = document.createElement('button');
        nextBtn.textContent = currentStep === steps.length - 1 ? 'Terminer ✓' : 'Suivant →';
        nextBtn.addEventListener('click', () => {
          if(currentStep === steps.length - 1){
            localStorage.setItem('fabanki:onboarding_completed', 'true');
            overlay.remove();
          } else {
            currentStep++;
            renderStep();
          }
        });
        btnGroup.appendChild(nextBtn);
        
        actions.appendChild(btnGroup);
        tooltip.appendChild(actions);
        
        // Position tooltip based on target
        // Handle target:'none' - deselect all highlights
        if(step.target === 'none'){
          // Remove all highlights
          document.querySelectorAll('[data-onboarding-highlight]').forEach(el => {
            el.style.boxShadow = '';
            el.style.zIndex = '';
            el.removeAttribute('data-onboarding-highlight');
          });
          
          // Center the tooltip
          tooltip.style.position = 'relative';
          tooltip.style.transform = 'none';
          tooltip.style.top = 'auto';
          tooltip.style.left = 'auto';
        } else if(step.target){
          const target = document.querySelector(step.target);
          if(target){
            // Show target
            target.style.visibility = 'visible';
            target.style.display = '';
            
            // Scroll target into view smoothly
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Wait a bit for scroll to complete before positioning tooltip
            setTimeout(() => {
              const rect = target.getBoundingClientRect();
              const tooltipRect = tooltip.getBoundingClientRect();
              tooltip.style.position = 'absolute';
              
              // Determine if we should place above or below based on available space
              const viewportHeight = window.innerHeight;
              const spaceBelow = viewportHeight - rect.bottom;
              const spaceAbove = rect.top;
              const tooltipHeight = tooltipRect.height || 300; // estimate if not measured yet
              
              // If position is specified as 'top' or if there's not enough space below, place above
              const shouldPlaceAbove = step.position === 'top' || (spaceBelow < tooltipHeight + 40 && spaceAbove > tooltipHeight + 40);
              
              if(shouldPlaceAbove){
                tooltip.style.top = (rect.top - 20) + 'px';
                tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                tooltip.style.transform = 'translate(-50%, -100%)';
              } else {
                // Place below (default for 'bottom' or when more space available)
                tooltip.style.top = (rect.bottom + 20) + 'px';
                tooltip.style.left = (rect.left + rect.width / 2) + 'px';
                tooltip.style.transform = 'translateX(-50%)';
              }
            }, 300);
            
            // Highlight target element
            target.style.position = 'relative';
            target.style.zIndex = '10001';
            target.style.boxShadow = '0 0 0 4px var(--accent)';
            target.style.borderRadius = '8px';
            
            // Remove highlight from previous target
            document.querySelectorAll('[data-onboarding-highlight]').forEach(el => {
              el.style.boxShadow = '';
              el.style.zIndex = '';
              el.removeAttribute('data-onboarding-highlight');
            });
            target.setAttribute('data-onboarding-highlight', 'true');
          } else {
            // Target not found, center the tooltip
            tooltip.style.position = 'relative';
            tooltip.style.transform = 'none';
            tooltip.style.top = 'auto';
            tooltip.style.left = 'auto';
          }
        } else {
          // Center position (no target specified)
          tooltip.style.position = 'relative';
          tooltip.style.transform = 'none';
          tooltip.style.top = 'auto';
          tooltip.style.left = 'auto';
        }
      };
      
      overlay.appendChild(tooltip);
      document.body.appendChild(overlay);
      renderStep();
      
      // Clean up highlights on close
      overlay.addEventListener('remove', () => {
        document.querySelectorAll('[data-onboarding-highlight]').forEach(el => {
          el.style.boxShadow = '';
          el.style.zIndex = '';
          el.removeAttribute('data-onboarding-highlight');
        });
      });
      
    }catch(e){ console.warn('onboarding error:', e) }
  }
  
  // --- CONTEXTUAL ONBOARDING FOR PROFILE ---
  function showProfileOnboarding(){
    try{
      if(localStorage.getItem('fabanki:profile_onboarding_completed')) return;
      if(document.getElementById('onboardingOverlay')) return;
      
      const steps = [
        {
          title: 'Votre profil',
          text: 'Ici vous pouvez voir toutes vos statistiques : cartes révisées, XP total, et jours consécutifs d\'étude.',
          position: 'center'
        },
        {
          title: 'Classement',
          text: 'Comparez-vous avec d\'autres utilisateurs et montez dans le classement en gagnant des points MPSI.',
          position: 'center'
        },
        {
          title: 'Titres et objectifs',
          text: 'Débloquez des titres prestigieux en accomplissant des objectifs spécifiques. Chaque titre a plusieurs niveaux !',
          position: 'center'
        },
        {
          title: 'Personnalisation',
          text: 'Cliquez sur ⚙️ pour personnaliser les couleurs, polices et animations. Plus vous montez de niveau, plus vous débloquez d\'options ! 42.',
          position: 'center'
        }
      ];
      
      createContextualOnboarding(steps, 'fabanki:profile_onboarding_completed');
    }catch(e){ console.warn('profile onboarding error:', e) }
  }
  
  // --- CONTEXTUAL ONBOARDING FOR DECK BROWSER ---
  function showBrowseOnboarding(){
    try{
      if(localStorage.getItem('fabanki:browse_onboarding_completed')) return;
      if(document.getElementById('onboardingOverlay')) return;
      
      const steps = [
        {
          title: 'Parcourir les decks',
          text: 'Explorez tous vos decks disponibles. Vous pouvez naviguer dans les dossiers et charger n\'importe quel deck.',
          position: 'center'
        },
        {
          title: 'Organisation',
          text: 'Les decks sont organisés par matière : Maths, Physique, Anglais, etc. Cliquez sur un dossier pour voir son contenu.',
          position: 'center'
        },
        {
          title: 'Chargement rapide',
          text: 'Cliquez sur un deck pour le charger directement et commencer à réviser !',
          position: 'center'
        }
      ];
      
      createContextualOnboarding(steps, 'fabanki:browse_onboarding_completed');
    }catch(e){ console.warn('browse onboarding error:', e) }
  }
  
  // --- CONTEXTUAL ONBOARDING FOR OVERVIEW PAGE ---
  function showOverviewOnboarding(){
    try{
      if(localStorage.getItem('fabanki:overview_onboarding_completed')) return;
      if(document.getElementById('onboardingOverlay')) return;
      
      const steps = [
        {
          title: 'Vue d\'ensemble',
          text: 'Cette page vous montre un aperçu complet de votre deck avant de commencer la révision.',
          position: 'center'
        },
        {
          title: 'Statistiques du deck',
          text: 'Voyez combien de cartes vous avez maîtrisées, en apprentissage, ou à réviser. Le graphique montre votre progression.',
          position: 'center'
        },
        {
          title: 'Déblockage des decks',
          text: 'Certains decks sont verrouillés jusqu\'à ce que vous atteigniez un certain niveau ou suffisament de crédits. Gagnez de l\'XP et faites vos missions en révisant pour les débloquer !',
          position: 'center'
        },
        {
          title: 'Aperçu des cartes',
          text: 'Toutes vos cartes sont affichées avec leur statut. Les nouvelles cartes sont en violet, celles à réviser en couleur.',
          position: 'center'
        },
        {
          title: 'Commencer',
          text: 'Cliquez sur "Commencer" pour lancer votre session de révision !',
          position: 'center'
        }
      ];
      
      createContextualOnboarding(steps, 'fabanki:overview_onboarding_completed');
    }catch(e){ console.warn('overview onboarding error:', e) }
  }
  
  // --- CONTEXTUAL ONBOARDING FOR REVIEW PAGE ---
  function showReviewOnboarding(){
    try{
      if(localStorage.getItem('fabanki:review_onboarding_completed')) return;
      if(document.getElementById('onboardingOverlay')) return;
      
      const steps = [
        {
          title: 'Session de révision',
          text: 'Vous êtes en mode révision ! Lisez la question et essayez de répondre avant de cliquer sur "Montrer la réponse".',
          position: 'center'
        },
        {
          title: 'Répétition espacée',
          text: 'Fab\'Anki utilise un algorithme intelligent (FSRS) pour déterminer quand vous devez réviser chaque carte. Plus vous répondez correctement, plus l\'intervalle augmente.',
          position: 'center'
        },
        {
          title: 'Évaluez-vous honnêtement',
          text: 'C\' la clé pour bien apprendre. Après avoir vu la réponse, choisissez : Raté (rouge), Difficile (orange), Bon (vert), ou Facile (bleu). Soyez honnête pour un apprentissage optimal, l\'xp c\'est bien sympa mais apprendre c\'est mieux !',
          position: 'center'
        },
        {
          title: 'Ce que signifient les boutons',
          text: '🔴 Raté : Vous n\'avez pas su répondre, pleins de fautes.\n🟠 Difficile : Vous aviez une idée mais pas la bonne réponse complète ou il y a un ou deux trucs qui clochent.\n🔵 Bon : Vous avez répondu correctement avec un peu d\'effort.\n🟢 Facile : Vous avez répondu immédiatement et sans effort.',
          position: 'center'
        },
        {
          title: 'Raccourcis clavier',
          text: 'Gagnez du temps sur ordi : Espace = Montrer réponse, 1/2/3/4 = Raté/Difficile/Bon/Facile. Vous pouvez aussi utiliser les flèches.',
          position: 'center'
        },
        {
          title: 'Objectif',
          text: 'Révisez régulièrement pour maximiser votre mémorisation. Chaque carte correcte vous rapporte des XP et fait progresser vos missions !',
          position: 'center'
        }
      ];
      
      createContextualOnboarding(steps, 'fabanki:review_onboarding_completed');
    }catch(e){ console.warn('review onboarding error:', e) }
  }
  
  // --- GENERIC CONTEXTUAL ONBOARDING CREATOR ---
  function createContextualOnboarding(steps, completionFlag){
    try{
      let currentStep = 0;
      
      const overlay = document.createElement('div');
      overlay.id = 'onboardingOverlay';
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.right = '0';
      overlay.style.bottom = '0';
      overlay.style.background = 'rgba(0, 0, 0, 0.6)';
      overlay.style.zIndex = '10000';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      
      const tooltip = document.createElement('div');
      tooltip.style.background = 'var(--card)';
      tooltip.style.color = 'var(--fg)';
      tooltip.style.padding = '24px';
      tooltip.style.borderRadius = '12px';
      tooltip.style.maxWidth = '500px';
      tooltip.style.width = '90%';
      tooltip.style.boxShadow = '0 10px 40px rgba(0,0,0,0.3)';
      tooltip.style.position = 'relative';
      tooltip.style.animation = 'fadeIn 0.3s ease-out';
      
      const renderStep = () => {
        const step = steps[currentStep];
        tooltip.innerHTML = '';
        
        const title = document.createElement('h3');
        title.textContent = step.title;
        title.style.margin = '0 0 12px 0';
        title.style.fontSize = '1.3rem';
        title.style.color = 'var(--accent)';
        tooltip.appendChild(title);
        
        const text = document.createElement('p');
        text.textContent = step.text;
        text.style.margin = '0 0 20px 0';
        text.style.lineHeight = '1.6';
        text.style.color = 'var(--fg)';
        tooltip.appendChild(text);
        
        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.justifyContent = 'space-between';
        actions.style.alignItems = 'center';
        actions.style.gap = '12px';
        
        const progress = document.createElement('div');
        progress.textContent = `${currentStep + 1} / ${steps.length}`;
        progress.style.fontSize = '0.85rem';
        progress.style.color = 'var(--muted)';
        actions.appendChild(progress);
        
        const btnGroup = document.createElement('div');
        btnGroup.style.display = 'flex';
        btnGroup.style.gap = '8px';
        
        if(currentStep > 0){
          const prevBtn = document.createElement('button');
          prevBtn.className = 'secondary';
          prevBtn.textContent = '← Précédent';
          prevBtn.addEventListener('click', () => {
            currentStep--;
            renderStep();
          });
          btnGroup.appendChild(prevBtn);
        }
        
        const skipBtn = document.createElement('button');
        skipBtn.className = 'secondary';
        skipBtn.textContent = 'Passer';
        skipBtn.addEventListener('click', () => {
          localStorage.setItem(completionFlag, 'true');
          overlay.remove();
        });
        btnGroup.appendChild(skipBtn);
        
        const nextBtn = document.createElement('button');
        nextBtn.textContent = currentStep === steps.length - 1 ? 'Compris ✓' : 'Suivant →';
        nextBtn.addEventListener('click', () => {
          if(currentStep === steps.length - 1){
            localStorage.setItem(completionFlag, 'true');
            overlay.remove();
          } else {
            currentStep++;
            renderStep();
          }
        });
        btnGroup.appendChild(nextBtn);
        
        actions.appendChild(btnGroup);
        tooltip.appendChild(actions);
      };
      
      overlay.appendChild(tooltip);
      document.body.appendChild(overlay);
      renderStep();
      
    }catch(e){ console.warn('contextual onboarding error:', e) }
  }

  // Expose functions as required (so they're available globally)
  window.loadDeckFromURL = loadDeckFromURL;
  window.parseXMLDeck = parseXMLDeck;
  window.interpretSides = interpretSides;
  window.renderFront = renderFront;
  window.renderBack = renderBack;
  window.renderKaTeX = renderKaTeX;
  window.initFSRS = initFSRS;
  window.scheduleCard = scheduleCard;
  window.getDueCards = getDueCards;

