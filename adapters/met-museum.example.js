/*
 * ============================================================
 * METROPOLITAN MUSEUM OF ART API — ADAPTER EXAMPLE & DOCUMENTATION
 * Voice Control Research Platform
 * ============================================================
 *
 * WHAT IS THE MET MUSEUM API?
 * The Metropolitan Museum of Art in New York provides a completely free API
 * to search and access detailed information about over 400,000 artworks in
 * their collection. Paintings, sculptures, decorative arts, textiles, and
 * more. Many items are in the public domain and can be freely downloaded
 * and used for any purpose.
 *
 * AUTHENTICATION: None required (completely free and open)
 * BASE URL: https://collectionapi.metmuseum.org/public/collection/v1/
 * DOCS: https://metmuseum.github.io/
 * LICENCE: Varies by item; many are public domain (check isPublicDomain field)
 * RATE LIMITS: No official limit, but be respectful (~80 requests/sec is safe)
 * ============================================================
 */

// ============================================================
// STEP 1: The Two-Step Search Process
// ============================================================
/*
The Met Museum API uses a TWO-STEP search process:

STEP A: Get Object IDs
────────────────────
GET https://collectionapi.metmuseum.org/public/collection/v1/search?q=monet&hasImages=true

Response:
{
  "total": 42,
  "objectIDs": [45734, 437853, 203918, ...]
}

STEP B: Fetch Full Data for Each Object
────────────────────────────────────────
For each ID, fetch:
GET https://collectionapi.metmuseum.org/public/collection/v1/objects/45734

Response:
{
  "objectID": 45734,
  "title": "Iris",
  "objectName": "Painting",
  "artistDisplayName": "Claude Monet",
  "artistDisplayBio": "French, 1840–1926",
  "objectDate": "1890–91",
  "medium": "Oil on canvas",
  "dimensions": "29 1/8 x 36 1/4 in.",
  "creditLine": "Bequest of Joan Whitney Payson",
  "isPublicDomain": true,
  "primaryImage": "https://images.metmuseum.org/metmuseum/original/DP-...",
  "primaryImageSmall": "https://images.metmuseum.org/metmuseum/web-large/...",
  "tags": [
    {"term": "Irises"},
    {"term": "Flowers"},
    {"term": "Gardens"}
  ],
  "isOnView": true,
  "department": "European Paintings",
  "repository": "Metropolitan Museum of Art, New York, NY"
}

THE PLATFORM HANDLES THIS AUTOMATICALLY:
The Voice Control platform adapter has fetchStrategy: 'two-step-ids'
which means it automatically does both steps when you search. You just
search for "monet" and the platform fetches all the object data for you.
*/

// ============================================================
// STEP 2: Field Mapping — what maps to what
// ============================================================
/*
Met Museum Field            →  Platform Field     →  Example
────────────────────────────────────────────────────────────────
title                       →  title              →  "Iris"
artistDisplayName           →  creator            →  "Claude Monet"
artistDisplayBio            →  creatorInfo        →  "French, 1840–1926"
objectDate                  →  date               →  "1890–91"
medium                      →  medium             →  "Oil on canvas"
dimensions                  →  dimensions        →  "29 1/8 x 36 1/4 in."
primaryImage                →  imageUrl           →  "https://images..."
primaryImageSmall           →  thumbnail          →  "https://images..."
department                  →  department         →  "European Paintings"
creditLine                  →  creditLine         →  "Bequest of Joan..."
tags[].term                 →  tags               →  ["Irises","Flowers"]
isPublicDomain              →  publicDomain       →  true
*/

// ============================================================
// STEP 3: Complete Adapter Registration Example
// ============================================================
/*
Here's the complete registration code for the Met Museum adapter:

apiAdapterRegistry.register({
  id: 'met-museum',
  name: 'Metropolitan Museum of Art',

  // No authentication needed
  authentication: {
    type: 'none'
  },

  // Two-step search process: first get IDs, then fetch object data
  fetchStrategy: 'two-step-ids',

  // Step 1: Search endpoint (returns object IDs)
  endpoint: 'https://collectionapi.metmuseum.org/public/collection/v1/search',

  // Step 2: Object details endpoint (fetches full data)
  objectEndpoint: 'https://collectionapi.metmuseum.org/public/collection/v1/objects/{objectID}',

  // Response configuration
  responseMapping: {
    // Search results are in the 'objectIDs' array
    resultsPath: 'objectIDs',

    // Field mapping for the detailed object data
    fieldMapping: {
      title: 'title',
      creator: 'artistDisplayName',
      creatorInfo: 'artistDisplayBio',
      date: 'objectDate',
      medium: 'medium',
      dimensions: 'dimensions',
      imageUrl: 'primaryImage',
      thumbnail: 'primaryImageSmall',
      department: 'department',
      creditLine: 'creditLine',
      publicDomain: 'isPublicDomain',
      onView: 'isOnView',
      id: 'objectID'
    },

    // Tags are structured as array of objects with 'term' property
    // The platform automatically extracts the 'term' field
    tagsPath: 'tags',
    tagsField: 'term'
  },

  // Query parameter mapping
  queryMapping: {
    q: 'q',           // Search term
    hasImages: 'hasImages'  // Only show items with images
  },

  // Default parameters
  defaultParams: {
    hasImages: true,  // Only search items that have images
    isOnView: false   // Include items whether on view or in storage
  },

  // Pagination configuration
  pagination: {
    type: 'automatic'  // The two-step strategy handles pagination internally
  }
});
*/

// ============================================================
// STEP 4: Testing the Adapter
// ============================================================
/*
Test in the browser console:

// Simple search for Monet
apiAdapterRegistry.search('met-museum', {
  q: 'monet'
});

// Search with specific museum department
apiAdapterRegistry.search('met-museum', {
  q: 'landscape painting'
});

// The results include both thumbnail images and full-resolution images
// Click an image to see the full-resolution version in a new tab
*/

// ============================================================
// STEP 5: Department Filter Reference
// ============================================================
/*
USING DEPARTMENT IDs IN SEARCHES:
The platform can filter by department ID. Here's a reference:

Dept ID   Department Name
───────────────────────────────────────────────────────────
1         American Decorative Arts
3         Ancient Greek and Roman Art
4         Arms and Armor
5         Arts of Africa, Oceania, and the Americas
6         Asian Art
7         The Costume Institute
8         Drawings and Prints
9         Egyptian Art
10        European Sculpture and Decorative Arts
11        European Paintings                         ← POPULAR
12        Greco-Roman, Near Eastern, and Other
13        Islamic Art
14        The Robert Lehman Collection
15        Medieval Art
16        Musical Instruments
17        Photographs
18        Asian Art (Korean)
19        Ancient Near Eastern Art
21        Modern and Contemporary Art

EXAMPLE ADVANCED SEARCHES:
- "monet" in department 11 (European Paintings)
- "vase" in department 5 (African Arts)
- "armor" in department 4 (Arms and Armor)
- "textile" in department 7 (Costume Institute)
*/

// ============================================================
// STEP 6: Important Notes and Gotchas
// ============================================================
/*
PUBLIC DOMAIN TREASURE:
The 'isPublicDomain: true' field is crucial. When true, the image is
completely free to download, reuse, modify, and share—no restrictions.
This is ideal for research, teaching, and creative projects. The Met
released their public domain collection as a gift to the world.

TWO-STEP PROCESS TRANSPARENCY:
When you search for "monet" and get 42 results, the platform:
1. Calls the search endpoint to get 42 object IDs
2. Makes 42 individual requests to fetch full object data
3. Consolidates everything into one response

This takes a few seconds, but gives you complete, detailed information
about each artwork. If searching seems slow, this is why. It's worth it.

IMAGE QUALITY:
- primaryImageSmall: Good for browsing and previews (~400px)
- primaryImage: Full resolution (often 2000px or larger)

Both are freely downloadable for public domain items.

NOT ALL ITEMS HAVE IMAGES:
The platform adapter defaults to hasImages: true, so you only get items
with images. Some artifacts in the collection don't have digital images
(yet). This filter ensures you get usable results.

OBJECTS VS ARTWORKS:
The API returns "objects" broadly: paintings, sculpture, furniture,
ceramics, textiles, weapons, coins, books, and more. Use search terms
like "painting", "sculpture", "vase" to narrow results if needed.

ARTIST NAMES:
Monet = "Claude Monet", Picasso = "Pablo Picasso", Frida = "Frida Kahlo"
The 'artistDisplayBio' field often shows their lifespan and nationality,
which is helpful for context.

TAGS ARE VERY USEFUL:
The tags array is populated by Met curators and includes:
- Subject matter: "Roses", "Mountains", "Portraits"
- Technique: "Oil on canvas", "Charcoal"
- Period: "19th century", "Renaissance"
- Theme: "Mythology", "Religion", "Domestic life"

You can use these to filter or understand artwork context.

NO RATE LIMIT ABUSE:
While there's no official rate limit, don't hammer the API. Typical usage
of the platform (one search per 1-2 seconds) is completely fine. Avoid
automated scripts that fetch millions of objects.

SEARCH TIPS:
- "monet painting" → more specific than just "monet"
- "renaissance portrait" → narrows to time period + type
- "dutch landscape" → artist origin + subject
- "still life" → common thematic search
- "sculpture" → object type filter
*/

// ============================================================
// COMMON MISTAKES TO AVOID
// ============================================================
/*
MISTAKE: Expecting hasImages filter in search parameters
REALITY: The adapter handles this automatically. You don't need to
         pass hasImages in searches—the adapter requires it by default.

MISTAKE: Assuming all results have high-res images
REALITY: Some public domain items have higher-res scans than others.
         Check the primaryImage field—if it's a smaller size, that's
         all the Met has digitized (so far).

MISTAKE: Not checking isPublicDomain before reusing
REALITY: Some items are not in the public domain (copyright restrictions).
         Always check before downloading or reusing. If isPublicDomain
         is false or missing, you need permission from the Met.

MISTAKE: Ignoring the artist biography
REALITY: artistDisplayBio gives you quick context: nationality, lifespan,
         artistic movement. This is very useful for research.
*/

// ============================================================
// EXAMPLE SEARCHES FOR RESEARCH
// ============================================================
/*
ART HISTORY:
- "impressionist" → impressionist works
- "baroque" → baroque period works
- "abstract" → abstract art
- "portrait" → portrait paintings and drawings

CULTURAL INTEREST:
- "Japanese art" → Japanese artworks in the collection
- "African masks" → African art objects
- "Islamic calligraphy" → Islamic art
- "Chinese pottery" → Chinese ceramics

THEMATIC:
- "still life" → still life paintings
- "landscape" → landscape paintings
- "mythology" → mythological subjects
- "war" → war-related artworks

MATERIAL/TECHNIQUE:
- "watercolor" → watercolor paintings
- "sculpture" → all sculpture types
- "textile" → woven and dyed textiles
- "photograph" → photographic works
*/
