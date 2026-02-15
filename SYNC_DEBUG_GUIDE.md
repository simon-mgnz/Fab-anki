<<<<<<< HEAD
# Fab'Anki Sync Debugging Guide

## Problem Fixed
The app was **not syncing card review progress** after users answered cards. Data was saved locally but not pushed to Firestore, so refreshing another browser showed stale data.

## Root Cause
- `autoSync()` was **not being called** after `answerCurrent()` or `passCurrent()`
- Sync was only triggered in rare scenarios (XP/credits/quests)
- Card review data accumulated locally but never reached the cloud

## Solution Applied
Added explicit `autoSync()` calls at the end of:
1. `passCurrent()` - when user marks card as reviewed without grading
2. `answerCurrent()` - when user grades card (1-5 scale)

Each function now triggers sync after updating card states.

## Testing Sync

### Method 1: Enable Debug Mode (Recommended)

**In Browser Console:**
```javascript
// Enable detailed sync logging
__fabanki_enableDebug()

// Now review a card and watch the console for [SYNC] messages
// You should see:
// [SYNC] autoSync: starting sync for user Simon
// [SYNC] autoSync: collected state { xp: X, credits: Y, decks: Z }
// [SYNC] Preparing upload { userId: ..., decks: ..., cards: ... }
```

**Disable when done:**
```javascript
__fabanki_disableDebug()
```

### Method 2: Manual Sync Test

**In Browser Console:**
```javascript
// Test sync manually
await __fabanki_testSync()

// Output should show:
// Mode: synced
// User ID: <your-uid>
// Pseudo: <your-name>
// Firestore available: true
// Running autoSync()...
// autoSync completed
```

### Method 3: Visual Indicator

A **"Synchronisation en cours…"** badge appears in **bottom-right corner** when sync is active. It should appear and disappear quickly (1-2 seconds) after each card.

## Step-by-Step Test

1. **Open app in Browser A**
   - Log in with your account
   - Load a deck
   
2. **Enable debug logging**
   ```javascript
   __fabanki_enableDebug()
   ```

3. **Review 5 cards in Browser A**
   - Grade each card (click 1-5 buttons)
   - Watch console for `[SYNC] Auto-sync completed`
   - Verify the sync badge appears briefly

4. **Open app in Browser B** (or reload same browser)
   - Load the same deck
   - Check that card review progress appears
   - Progress should match what you saw in Browser A

5. **Verify in Console**
   ```javascript
   // Check localStorage for accumulated data
   localStorage.getItem('fabanki:user_state')  // Should show recent data
   
   // Check if sync succeeded
   // (Firestore updates happen asynchronously, allow 2-3 seconds)
   ```

## Troubleshooting

### Sync doesn't appear in console
- **Issue**: Sync might be skipped if conditions aren't met
- **Check**:
  ```javascript
  localStorage.getItem('fabanki:mode')        // Should be 'synced'
  localStorage.getItem('fabanki:user_id')     // Should have a value
  localStorage.getItem('pseudo')              // Should NOT be 'Anonyme'
  window.__fabanki_firestore                  // Should be truthy
  ```

### Data still not syncing after browser reload
- **Likely issue**: Browser extension blocking Firebase (`net::ERR_BLOCKED_BY_CLIENT`)
- **Solution**: Disable AdBlock/Brave Shields/uBlock for `firebaseapp.com` domain
- **Verify**:
  1. Open DevTools (F12)
  2. Go to Network tab
  3. Review a card
  4. Check if any Firestore requests are **blocked** (red X)
  5. If yes, disable blocker and try again

### Sync succeeds but data doesn't appear in other browser
- **Issue**: Cached data in other browser
- **Solution**: 
  1. Hard refresh the other browser (Ctrl+Shift+R)
  2. Clear localStorage: Press F12 → Application → Local Storage → clear
  3. Reload page

### "Synchronisation en cours…" appears then disappears instantly
- This is **normal** - sync is fast
- Check console logs to verify completion

## Console Commands Reference

```javascript
// Enable sync debug logging
__fabanki_enableDebug()

// Disable sync debug logging
__fabanki_disableDebug()

// Manually trigger sync (for testing)
await __fabanki_testSync()

// Check current sync state
localStorage.getItem('fabanki:mode')
localStorage.getItem('fabanki:user_id')
localStorage.getItem('pseudo')

// View full user state
console.log(JSON.parse(localStorage.getItem('fabanki:user_state')))
```

## Expected Console Output (Debug Mode)

When you review a card with debug enabled:

```
[SYNC] autoSync: mode = synced
[SYNC] autoSync: userId = <uid> firestore available = true
[SYNC] autoSync: starting sync for user Simon
[SYNC] autoSync: collected state { xp: 150, credits: 5, decks: 2 }
[SYNC] Preparing upload { userId: <uid>, decks: 2, cards: 45, xp: 150, credits: 5, lastUpdated: 1706...}
[SYNC] Auto-sync completed successfully
```

## Important Notes

1. **Sync is now automatic** - happens after every card review
2. **No manual save button needed** - all changes sync in background
3. **Works offline** - changes saved locally, sync when connection returns
4. **Firebase error** - if you see `net::ERR_BLOCKED_BY_CLIENT`, disable browser blocker
5. **Performance** - sync adds ~200-500ms delay (awaited but non-blocking to UI)

## Questions?

If sync is still not working:
1. Enable debug mode
2. Review 5 cards
3. Check console output matches expected pattern
4. Try opening the app in incognito mode (bypasses some blockers)
5. Report the exact console error messages you see
=======
# Fab'Anki Sync Debugging Guide

## Problem Fixed
The app was **not syncing card review progress** after users answered cards. Data was saved locally but not pushed to Firestore, so refreshing another browser showed stale data.

## Root Cause
- `autoSync()` was **not being called** after `answerCurrent()` or `passCurrent()`
- Sync was only triggered in rare scenarios (XP/credits/quests)
- Card review data accumulated locally but never reached the cloud

## Solution Applied
Added explicit `autoSync()` calls at the end of:
1. `passCurrent()` - when user marks card as reviewed without grading
2. `answerCurrent()` - when user grades card (1-5 scale)

Each function now triggers sync after updating card states.

## Testing Sync

### Method 1: Enable Debug Mode (Recommended)

**In Browser Console:**
```javascript
// Enable detailed sync logging
__fabanki_enableDebug()

// Now review a card and watch the console for [SYNC] messages
// You should see:
// [SYNC] autoSync: starting sync for user Simon
// [SYNC] autoSync: collected state { xp: X, credits: Y, decks: Z }
// [SYNC] Preparing upload { userId: ..., decks: ..., cards: ... }
```

**Disable when done:**
```javascript
__fabanki_disableDebug()
```

### Method 2: Manual Sync Test

**In Browser Console:**
```javascript
// Test sync manually
await __fabanki_testSync()

// Output should show:
// Mode: synced
// User ID: <your-uid>
// Pseudo: <your-name>
// Firestore available: true
// Running autoSync()...
// autoSync completed
```

### Method 3: Visual Indicator

A **"Synchronisation en cours…"** badge appears in **bottom-right corner** when sync is active. It should appear and disappear quickly (1-2 seconds) after each card.

## Step-by-Step Test

1. **Open app in Browser A**
   - Log in with your account
   - Load a deck
   
2. **Enable debug logging**
   ```javascript
   __fabanki_enableDebug()
   ```

3. **Review 5 cards in Browser A**
   - Grade each card (click 1-5 buttons)
   - Watch console for `[SYNC] Auto-sync completed`
   - Verify the sync badge appears briefly

4. **Open app in Browser B** (or reload same browser)
   - Load the same deck
   - Check that card review progress appears
   - Progress should match what you saw in Browser A

5. **Verify in Console**
   ```javascript
   // Check localStorage for accumulated data
   localStorage.getItem('fabanki:user_state')  // Should show recent data
   
   // Check if sync succeeded
   // (Firestore updates happen asynchronously, allow 2-3 seconds)
   ```

## Troubleshooting

### Sync doesn't appear in console
- **Issue**: Sync might be skipped if conditions aren't met
- **Check**:
  ```javascript
  localStorage.getItem('fabanki:mode')        // Should be 'synced'
  localStorage.getItem('fabanki:user_id')     // Should have a value
  localStorage.getItem('pseudo')              // Should NOT be 'Anonyme'
  window.__fabanki_firestore                  // Should be truthy
  ```

### Data still not syncing after browser reload
- **Likely issue**: Browser extension blocking Firebase (`net::ERR_BLOCKED_BY_CLIENT`)
- **Solution**: Disable AdBlock/Brave Shields/uBlock for `firebaseapp.com` domain
- **Verify**:
  1. Open DevTools (F12)
  2. Go to Network tab
  3. Review a card
  4. Check if any Firestore requests are **blocked** (red X)
  5. If yes, disable blocker and try again

### Sync succeeds but data doesn't appear in other browser
- **Issue**: Cached data in other browser
- **Solution**: 
  1. Hard refresh the other browser (Ctrl+Shift+R)
  2. Clear localStorage: Press F12 → Application → Local Storage → clear
  3. Reload page

### "Synchronisation en cours…" appears then disappears instantly
- This is **normal** - sync is fast
- Check console logs to verify completion

## Console Commands Reference

```javascript
// Enable sync debug logging
__fabanki_enableDebug()

// Disable sync debug logging
__fabanki_disableDebug()

// Manually trigger sync (for testing)
await __fabanki_testSync()

// Check current sync state
localStorage.getItem('fabanki:mode')
localStorage.getItem('fabanki:user_id')
localStorage.getItem('pseudo')

// View full user state
console.log(JSON.parse(localStorage.getItem('fabanki:user_state')))
```

## Expected Console Output (Debug Mode)

When you review a card with debug enabled:

```
[SYNC] autoSync: mode = synced
[SYNC] autoSync: userId = <uid> firestore available = true
[SYNC] autoSync: starting sync for user Simon
[SYNC] autoSync: collected state { xp: 150, credits: 5, decks: 2 }
[SYNC] Preparing upload { userId: <uid>, decks: 2, cards: 45, xp: 150, credits: 5, lastUpdated: 1706...}
[SYNC] Auto-sync completed successfully
```

## Important Notes

1. **Sync is now automatic** - happens after every card review
2. **No manual save button needed** - all changes sync in background
3. **Works offline** - changes saved locally, sync when connection returns
4. **Firebase error** - if you see `net::ERR_BLOCKED_BY_CLIENT`, disable browser blocker
5. **Performance** - sync adds ~200-500ms delay (awaited but non-blocking to UI)

## Questions?

If sync is still not working:
1. Enable debug mode
2. Review 5 cards
3. Check console output matches expected pattern
4. Try opening the app in incognito mode (bypasses some blockers)
5. Report the exact console error messages you see
>>>>>>> 4cdbefdd6a01fb11dca2d04cfa8bbe7a91388e27
