/*
 * ============================================================
 * EUROPEANA API — ADAPTER EXAMPLE & DOCUMENTATION
 * Voice Control Research Platform
 * ============================================================
 *
 * WHAT IS EUROPEANA?
 * Europeana is a digital collection aggregating millions of digitized cultural
 * items from 3000+ cultural institutions across Europe: museums, galleries,
 * libraries, and archives. Search across paintings, manuscripts, photographs,
 * sculpture, coins, and hundreds of other media types.
 *
 * GETTING STARTED:
 * Visit https://apis.europeana.eu/en to register for a FREE API key.
 * Registration is instant and takes about 1 minute. No credit card required.
 *
 * AUTHENTICATION: API Key (free, instant registration)
 * API KEY LOCATION: Query parameter named 'wskey' (NOT in Authorization header)
 * BASE URL: https://api.europeana.eu/record/v2/
 * DOCS: https://pro.europeana.eu/page/apis
 * LICENCE: Most items are under Creative Commons licenses (check each item)
 * RATE LIMITS: 10,000 requests per day with a free key
 * ============================================================
 */

// ============================================================
// STEP 1: Understanding the Europeana API Response
// ============================================================
/*
When you search Europeana, you get a response like this:

{
  "apikey": "api2demo",
  "success": true,
  "totalResults": 424968,
  "itemsCount": 12,
  "startIndex": 1,
  "items": [
    {
      "id": "/09102/BibliographicResource_3000058461836",
      "title": ["Portrait of Madame Moustache"],
      "dcCreator": ["Boldini, Giovanni"],
      "dcDescription": [
        "Oil on canvas portrait of the French-American entertainer"
      ],
      "edmIsShownBy": "http://images.europeana.eu/...",
      "rights": ["http://creativecommons.org/licenses/by-sa/3.0/"],
      "year": ["1886"],
      "dataProvider": ["Uffizi Gallery"],
      "country": ["Italy"],
      "language": ["en"]
    }
    // ... more items
  ]
}

KEY POINTS ABOUT THIS RESPONSE:
- The actual results are in the 'items' array
- Title, creator, and description are ARRAYS — often with just 1 item
- To access title: items[0].title[0] (array, then first element)
- edmIsShownBy is the image URL
- Use profile parameter to get more or fewer fields
*/

// ============================================================
// STEP 2: Field Mapping — what maps to what in the platform
// ============================================================
/*
Here's how Europeana fields map to the Voice Control platform's
standard metadata structure:

Europeana Field           →  Platform Field     →  Example Value
────────────────────────────────────────────────────────────────
title[0]                  →  title              →  "Portrait of Madame Moustache"
dcCreator[0]              →  creator            →  "Boldini, Giovanni"
dcDescription[0]          →  description        →  "Oil on canvas portrait..."
edmIsShownBy              →  thumbnail          →  "http://images.europeana.eu/..."
rights[0]                 →  rights             →  "Creative Commons BY-SA 3.0"
year[0]                   →  date               →  "1886"
country[0]                →  location           →  "Italy"
dataProvider              →  institution        →  "Uffizi Gallery"
*/

// ============================================================
// STEP 3: Complete Adapter Registration Example
// ============================================================
/*
Here's the complete code you would run in the platform console
to register the Europeana adapter:

apiAdapterRegistry.register({
  // Unique identifier for this adapter
  id: 'europeana',

  // Human-readable name for UI labels
  name: 'Europeana',

  // Authentication configuration
  authentication: {
    type: 'apikey',           // Type of auth required
    authParamName: 'wskey',   // IMPORTANT: Europeana uses 'wskey' NOT standard auth header
    location: 'query'         // API key goes in the query string
  },

  // The base endpoint for the API
  endpoint: 'https://api.europeana.eu/record/v2/search.json',

  // How to map the API response to platform fields
  responseMapping: {
    // The API returns results in the 'items' array
    resultsPath: 'items',

    // Map each item's fields to platform standard names
    fieldMapping: {
      title: 'title[0]',              // title is an array, take first element
      creator: 'dcCreator[0]',        // same here
      description: 'dcDescription[0]',
      thumbnail: 'edmIsShownBy',      // image URL
      date: 'year[0]',
      location: 'country[0]',
      institution: 'dataProvider',
      rights: 'rights[0]',
      id: 'id'
    }
  },

  // Query parameter mapping — how to translate platform search to API params
  queryMapping: {
    q: 'query',        // Platform 'q' → Europeana 'query' parameter
    rows: 'rows',      // Number of results per page (default 20, max 100)
    start: 'start'     // Pagination (1-based, NOT 0-based like some APIs)
  },

  // Default request parameters
  defaultParams: {
    profile: 'standard',  // 'standard' or 'rich' (rich returns more metadata)
    rows: 20              // Items per request
  },

  // Pagination configuration
  pagination: {
    type: 'offset',       // Uses 'start' offset parameter
    pageParamName: 'start',
    pageSizeParamName: 'rows'
  }
});
*/

// ============================================================
// STEP 4: Testing the Adapter in Browser Console
// ============================================================
/*
Once registered, you can test it immediately in the browser console:

// Simple search for "baroque painting"
apiAdapterRegistry.search('europeana', {
  q: 'baroque painting',
  rows: 10
});

// With Europeana-specific parameters:
apiAdapterRegistry.search('europeana', {
  q: 'monet',
  rows: 50,
  profile: 'rich'  // Get more detailed metadata
});

// The platform automatically handles pagination:
// To get page 2:
apiAdapterRegistry.search('europeana', {
  q: 'renaissance art',
  rows: 20,
  start: 21  // Start from item 21 (1-based pagination)
});

// You should see a response with thumbnail images and metadata
// You can then click the images to view full-resolution originals
*/

// ============================================================
// STEP 5: Important Notes, Gotchas, and Tips
// ============================================================
/*
AUTHENTICATION GOTCHA:
Europeana uses a query parameter 'wskey' for authentication, NOT the
standard HTTP Authorization header. Many APIs use headers, so this is
a common source of confusion. The platform adapter automatically handles
this, but good to know for debugging.

ARRAY FIELDS:
Many Europeana fields (title, creator, description, rights) are arrays
because items can have multiple values. Even if there's only one value,
it's wrapped in an array. When mapping, use [0] to get the first element.

PAGINATION IS 1-BASED:
Europeana's 'start' parameter is 1-based (first page starts at 1, not 0).
This is different from many APIs. The platform adapters handle this, but
important when testing directly.

PROFILE PARAMETER:
- profile=standard (default) → basic metadata, faster responses
- profile=rich → includes more fields like full contributor details,
  more complete descriptions, and additional metadata

IMAGE QUALITY:
The 'edmIsShownBy' field gives you a direct link to the digitized item.
For paintings and photographs, this is usually high-resolution.
For manuscripts, it's usually a page image. Always check the 'rights'
field to confirm reuse permissions.

RATE LIMIT STRATEGY:
10,000 requests/day is generous for research use. That's about 400 per hour
or ~7 per minute. The platform auto-throttles to stay under this limit.
If you need more, you can request an enhanced key from Europeana (free).

FILTERING AND ADVANCED SEARCH:
The 'query' parameter supports boolean operators:
- "baroque AND painting" (both terms required)
- "leonardo OR michelangelo" (either term)
- "NOT print" (exclude prints)

FINDING SPECIFIC TYPES OF ITEMS:
Use the Europeana online interface to find exact query terms, then use
them in the platform search. For example:
- Paintings: "painting" in the query
- Manuscripts: "manuscript" in the query
- By time period: "18th century" (searches in metadata)
- By country: "Spain" or "France" searches in dcCoverage field

COMMON SEARCH EXAMPLES:
- 'renaissance portrait' → famous renaissance portraits
- 'impressionist landscape' → impressionist landscapes
- 'medieval manuscript' → decorated medieval manuscripts
- 'art nouveau poster' → art nouveau posters and prints
- 'baroque sculpture' → baroque sculptural works
*/

// ============================================================
// QUICK REFERENCE: Europeana Field Values You'll See
// ============================================================
/*
Common values for important fields:

RIGHTS (licensing) — check before reusing:
- http://creativecommons.org/licenses/by-sa/3.0/      (CC BY-SA)
- http://creativecommons.org/licenses/by/3.0/         (CC BY)
- http://creativecommons.org/licenses/cc0/1.0/        (CC0 - public domain)
- http://www.europeana.eu/rights/rr-p/                (Rights Reserved - no reuse)

COUNTRIES (sample of dcCoverage):
- Italy, Spain, France, Netherlands, Austria, Germany,
  United Kingdom, Poland, Romania, Greece, Portugal, etc.

PROVIDERS (institutions):
- Uffizi Gallery, Louvre, British Museum, Rijksmuseum,
  Prado, Hermitage, Vatican, National Museums, etc.
*/
