HARBOR MARKET BULK SAMPLE CATALOGUE PATCH

Contains:
- index.html (loads the new importer)
- js/app.js (adds an Import sample catalogue button to Inventory)
- js/sample-catalogue.js (8 categories, 40 products and 40 embedded sample illustrations)

INSTALL:
1. Keep a backup of your current project folder.
2. Extract this ZIP into the ROOT of your current shopfire project folder.
3. Allow it to overwrite index.html and js/app.js.
4. It adds js/sample-catalogue.js.
5. DO NOT overwrite js/config.js. Your Firebase settings remain unchanged.

RUN:
1. Refresh http://localhost:3000 (Ctrl+F5).
2. Sign in as admin and open Inventory.
3. Click Import sample catalogue, then Start import.
4. The importer adds missing categories/products and skips matching existing records.
5. Do not close the tab while import is running.

Images are original lightweight SVG sample illustrations embedded as data URLs in each product's img field.
The importer uses your existing authenticated admin session and the existing Firestore REST wrapper.
