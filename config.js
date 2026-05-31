// ============================================================
// WEB PUSH — VAPID public key
// Pour générer une paire de clés VAPID :
//   npx web-push generate-vapid-keys
// Mettez la clé PUBLIQUE ici, la clé PRIVÉE dans Firebase Functions :
//   firebase functions:config:set vapid.private_key="..." vapid.email="mailto:toi@example.com"
// ============================================================
window.__fabanki_vapidPublicKey = 'BFnPq2aWftMWMLXAGP6wYGIm7XFYnct6EOmRxoV3OtL6PZZG6qrkxxhcG8y6-rTczVbQW0D6jMYXoFumtK89BA8';

// Firebase project configuration
// Replace with your Firebase project's config from Firebase Console
// To disable cloud sync, set this to {}
window.__fabanki_firebaseConfig = window.__fabanki_firebaseConfig || {
  apiKey: "AIzaSyCHt0J--9GuXCE5PaU2vkdWVWTWRu5phBM",
  authDomain: "fab-anki-classement.firebaseapp.com",
  projectId: "fab-anki-classement",
  storageBucket: "fab-anki-classement.firebasestorage.app",
  messagingSenderId: "469715316592",
  appId: "1:469715316592:web:c737c247abed9199e0a9b5"
};


// Initialize Firebase if config provided
(function(){
  try{
    const cfg = window.__fabanki_firebaseConfig || {};
    if(cfg && cfg.apiKey){
      // Initialize Firebase app
      const fbApp = firebase.initializeApp(cfg);
      
      // Set up Firestore, Auth and Cloud Functions (europe-west1)
      window.__fabanki_firestore = firebase.firestore();
      window.__fabanki_auth = firebase.auth();
      window.__fabanki_functions = firebase.app().functions('europe-west1');
    } else { 
      window.__fabanki_firestore = null;
      window.__fabanki_auth = null;
      window.__fabanki_functions = null;
    }
  }catch(e){ 
    console.error('Firebase initialization failed:', e?.message);
    window.__fabanki_firestore = null;
    window.__fabanki_auth = null;
    window.__fabanki_functions = null;
  }
})();
