# Harbor Market (HTML/CSS/JS/jQuery + Firebase Auth & Firestore over REST)

## 1. Firebase setup
1. Create a project, then **Build > Authentication > Sign-in method > Email/Password: enable**.
2. **Build > Firestore Database > Create database** (production mode).
3. **Project settings > General**: copy *Web API Key* and *Project ID* into `js/config.js`. Set `adminEmail`.
4. Paste these into **Firestore > Rules > Publish** (change the admin email):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function signedIn(){ return request.auth != null; }
    function admin(){ return signedIn() && request.auth.token.email == "admin@shop.com"; }
    match /categories/{id} { allow read: if true; allow write: if admin(); }
    match /products/{id} {
      allow read: if true;
      allow create, delete: if admin();
      allow update: if admin() || (signedIn() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['qty']));
    }
    match /customers/{id} {
      allow read: if admin() || (signedIn() && request.auth.uid == id);
      allow create: if signedIn() && request.auth.uid == id && request.resource.data.creditLimit == 0;
      allow update: if admin() || (signedIn() && request.auth.uid == id && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['creditUsed']));
    }
    match /orders/{id} {
      allow read: if admin() || (signedIn() && resource.data.customerId == request.auth.uid);
      allow create: if signedIn() && request.resource.data.customerId == request.auth.uid;
    }
  }
}
```
5. Run: `npx serve .` (or any static server) and open the URL. Sign up with the admin email first, add a category, then items.

## 2. Postman
Import `postman/HarborMarket.postman_collection.json`, set the `apiKey` and `projectId` collection variables, run **1. Auth > Sign in** (it saves `idToken` and `uid`), then run the rest in order.

## 3. Notes
- Pagination uses Firestore `runQuery` with `limit`/`offset`. Reports run in the browser over fetched data.
- ID tokens expire after 1 hour; sign in again when you get a 401.
- Credit limit starts at 0 (per brief). Set it to 1000 per customer on the Customers page.
- Order emails need a server (Cloud Function or an email extension); Firebase REST has no mail endpoint. Password-reset emails are sent by Firebase Auth itself.
- Commit often: `git init && git remote add origin <azure-repo-url> && git add . && git commit -m "..." && git push -u origin main`.
- Product images are resized in the browser (max 480px JPEG) and stored as a base64 `img` field in the product document (Firestore limit: 1 MB per document). To use Firebase Storage instead you would need the Blaze plan.
