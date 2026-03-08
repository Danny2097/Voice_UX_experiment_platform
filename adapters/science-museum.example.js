/*
 * ============================================================
 * SCIENCE MUSEUM GROUP API — ADAPTER EXAMPLE & DOCUMENTATION
 * Voice Control Research Platform
 * ============================================================
 *
 * WHAT IS SCIENCE MUSEUM GROUP?
 * The Science Museum Group covers five major UK institutions:
 * - Science Museum (London)
 * - Museum of Science and Industry (Manchester)
 * - National Railway Museum (York)
 * - National Science and Media Museum (Bradford)
 * - National Collections Centre (Swindon, off-site storage)
 *
 * Collection includes: steam engines, locomotives, aircraft, medical devices,
 * scientific instruments, computers, historic machinery, and millions of
 * other objects documenting science, technology, and industry. Many items
 * have high-quality photographs and detailed metadata.
 *
 * AUTHENTICATION: None required
 * BASE URL: https://collection.sciencemuseumgroup.org.uk/
 * DOCS: https://github.com/sciencemuseumgroup/
 * LICENCE: Mostly CC BY or public domain; check each item
 * RATE LIMITS: No official limit; respect typical usage patterns
 * ============================================================
 */

// ============================================================
// STEP 1: Understanding Science Museum API Responses
// ============================================================
/*
IMPORTANT: The Science Museum Group API uses JSON:API format.
This is DIFFERENT from standard REST APIs you may have seen.

In JSON:API, data is always in a "data" array, and all item properties
are nested under an "attributes" object. This is more structured but
requires knowing how to navigate the response.

SAMPLE RESPONSE:

{
  "data": [
    {
      "id": "a0b1c2d3",
      "type": "works",
      "attributes": {
        "title": "Stephenson's Rocket",
        "summary_title": "Locomotive: Stephenson's Rocket",
        "description": "This historic steam locomotive achieved...",
        "image": {
          "processed": {
            "thumbnail": {
              "location": "https://coimages.sciencemuseumgroup.org.uk/..."
            }
          }
        },
        "multimedia": [
          {
            "type": "image",
            "processed": {
              "thumbnail": {
                "location": "https://coimages.sciencemuseumgroup.org.uk/..."
              }
            }
          }
        ],
        "categories": [
          {
            "value": "Rail transport"
          },
          {
            "value": "Steam locomotives"
          }
        ],
        "lifecycle": {
          "creation": [
            {
              "maker": [
                {
                  "summary_title": "Robert Stephenson and Company"
                }
              ],
              "date": [
                {
                  "label": "1829"
                }
              ]
            }
          ]
        },
        "on_display": true,
        "museum": {
          "title": "Science Museum"
        }
      }
    }
    // ... more items
  ],
  "meta": {
    "hit_count": 3842
  }
}

KEY POINTS ABOUT SCIENCE MUSEUM RESPONSES:
- Items are in the 'data' array
- ALL item properties are nested under 'attributes'
- This is JSON:API format, which is strict but well-defined
- Titles, dates, and makers are often nested arrays
- Use lifecycle.creation[0].maker[0].summary_title for creator names
- Image URLs are deeply nested: multimedia[0].processed.thumbnail.location
- Total results are in meta.hit_count (NOT totalResults like other APIs)
- The museum field tells you which of the 5 institutions the item belongs to
*/

// ============================================================
// STEP 2: Field Mapping — navigating the JSON:API structure
// ============================================================
/*
Science Museum Field                          →  Platform Field
──────────────────────────────────────────────────────────────────
attributes.title                              →  title
attributes.summary_title                      →  summaryTitle
attributes.lifecycle.creation[0].maker[0]... →  creator
attributes.lifecycle.creation[0].date[0]...  →  date
attributes.categories[].value                 →  categories/tags
attributes.image.processed.thumbnail.location →  thumbnail
attributes.multimedia[0].processed.thumbnail  →  imageUrl
attributes.description                        →  description
attributes.on_display                         →  onDisplay
attributes.museum.title                       →  museum

IMPORTANT:
Accessing deeply nested properties requires careful path construction.
The platform adapter handles this, but understanding the nesting helps
with debugging.
*/

// ============================================================
// STEP 3: Complete Adapter Registration Example
// ============================================================
/*
Here's the registration code for the Science Museum adapter:

apiAdapterRegistry.register({
  id: 'science-museum',
  name: 'Science Museum Group',

  // No authentication
  authentication: {
    type: 'none'
  },

  // Base endpoint
  endpoint: 'https://collection.sciencemuseumgroup.org.uk/search',

  // JSON:API response configuration
  responseMapping: {
    // Results are in the 'data' array (JSON:API standard)
    resultsPath: 'data',

    // All properties are under 'attributes' (JSON:API standard)
    attributesPath: 'attributes',

    // Field mapping
    fieldMapping: {
      title: 'title',
      summaryTitle: 'summary_title',
      creator: 'lifecycle.creation[0].maker[0].summary_title',
      date: 'lifecycle.creation[0].date[0].label',
      description: 'description',
      thumbnail: 'image.processed.thumbnail.location',
      imageUrl: 'multimedia[0].processed.thumbnail.location',
      onDisplay: 'on_display',
      museum: 'museum.title',
      id: 'id'
    },

    // Categories are tags
    tagsPath: 'categories',
    tagsField: 'value',

    // Total count location (JSON:API style)
    totalPath: 'meta.hit_count'
  },

  // Query parameter mapping
  queryMapping: {
    q: 'q',                         // Search term
    page_size: 'page[size]',        // Items per page (JSON:API style)
    page_number: 'page[number]'     // Page number (JSON:API style)
  },

  // Default parameters
  defaultParams: {
    'page[size]': 20                // Items per request (max 100)
  },

  // Pagination configuration
  pagination: {
    type: 'json-api',               // Use JSON:API pagination format
    pageParamName: 'page[number]',
    pageSizeParamName: 'page[size]'
  }
});
*/

// ============================================================
// STEP 4: Testing the Adapter
// ============================================================
/*
Test in the browser console:

// Search for steam engines
apiAdapterRegistry.search('science-museum', {
  q: 'steam engine'
});

// Search with page size
apiAdapterRegistry.search('science-museum', {
  q: 'locomotive',
  'page[size]': 30
});

// Get page 2
apiAdapterRegistry.search('science-museum', {
  q: 'aircraft',
  'page[number]': 2,
  'page[size]': 20
});

Results include thumbnail images and detailed metadata. Images are
hosted on the Science Museum CDN with good quality.
*/

// ============================================================
// STEP 5: Museum Locations
// ============================================================
/*
The "museum" field in the response indicates which of 5 institutions
has the item:

Museum Name (in data)         Location        Specialization
──────────────────────────────────────────────────────────
Science Museum                London          General science & technology
Museum of Science and Industry Manchester     Industrial heritage
National Railway Museum       York            Railways & locomotives
National Science and Media    Bradford        Photography, broadcasting, media
National Collections Centre   Swindon         Storage facility (off-site)

FILTERING BY MUSEUM:
You can filter results using:
apiAdapterRegistry.search('science-museum', {
  q: 'steam',
  'filter[term][museum.title][]': 'National Railway Museum'
});

Or to see only items on display:
apiAdapterRegistry.search('science-museum', {
  q: 'computer',
  'filter[on_display]': true
});
*/

// ============================================================
// STEP 6: JSON:API Format Explanation
// ============================================================
/*
WHY JSON:API IS DIFFERENT:
Compared to simpler APIs, JSON:API has strict conventions:

STANDARD REST API:
{
  "results": [
    {
      "title": "Item 1",
      "creator": "Person A"
    }
  ]
}

JSON:API FORMAT:
{
  "data": [
    {
      "id": "123",
      "type": "works",
      "attributes": {
        "title": "Item 1",
        "creator": "Person A"
      }
    }
  ],
  "meta": {...}
}

BENEFITS OF JSON:API:
- Strict structure = easier validation
- Includes ID and type = better data integrity
- Metadata is clear = easier pagination
- Relationships can be explicit = supports linking

FOR THE VOICE CONTROL PLATFORM:
The platform adapter understands JSON:API and translates it to the
standard format automatically. You don't need to understand JSON:API
to use the platform—but it helps for debugging and understanding
why the response structure is nested.
*/

// ============================================================
// STEP 7: Image Handling
// ============================================================
/*
SCIENCE MUSEUM IMAGE URLS:
Images come from the Science Museum CDN:
https://coimages.sciencemuseumgroup.org.uk/[image-id]

TWO IMAGE TYPES:
1. thumbnail — smaller preview image
2. larger resolution — full-size image

ACCESSING IMAGES IN THE RESPONSE:
Images can be in two places:
- attributes.image.processed.thumbnail.location
- attributes.multimedia[0].processed.thumbnail.location

The platform adapter checks both and uses whichever is available.

IMAGE QUALITY:
Science Museum images are professionally photographed with:
- Museum-quality lighting
- High resolution (often 3000+ pixels)
- Accurate color rendering
- Copyright noted in metadata

ACCESSING HIGHER RESOLUTIONS:
The thumbnail URLs can sometimes be modified to get larger versions.
The platform provides what's available. For very high-res images,
contact the Science Museum directly.
*/

// ============================================================
// STEP 8: Categories and Tags
// ============================================================
/*
Every item is tagged with one or more categories describing:
- Object type: "Steam locomotive", "Aircraft", "Scientific instrument"
- Material: "Iron", "Brass", "Ceramic", "Glass"
- Period: "Victorian era", "Industrial Revolution", "1950s"
- Function: "Transport", "Communication", "Medicine", "Manufacturing"
- Technique: "Steam power", "Electricity", "Mechanical"

COMMON CATEGORIES YOU'LL SEE:
Steam locomotives, Aircraft, Automobiles, Bicycles,
Computers and calculating machines, Medical devices,
Navigational instruments, Optical instruments,
Printing equipment, Radio and television,
Scientific apparatus, Textiles and clothing

SEARCHING BY CATEGORY:
Categories are extracted as tags. You can use tag searches:
- "steam locomotive" → searches in title and categories
- "railway" → finds trains, railway equipment, signaling
- "medical" → medical and pharmaceutical items
*/

// ============================================================
// STEP 9: Filtering and Advanced Searches
// ============================================================
/*
FILTER SYNTAX (JSON:API style):
The Science Museum API supports complex filtering:

ITEMS ON DISPLAY:
apiAdapterRegistry.search('science-museum', {
  q: 'engine',
  'filter[on_display]': true
});

SPECIFIC MUSEUM:
apiAdapterRegistry.search('science-museum', {
  q: 'aircraft',
  'filter[term][museum.title][]': 'Science Museum'
});

COMBINING MULTIPLE FILTERS:
apiAdapterRegistry.search('science-museum', {
  q: 'locomotive',
  'filter[on_display]': true,
  'filter[term][museum.title][]': 'National Railway Museum'
});

BOOLEAN SEARCH:
Use quotes and boolean operators in the search term:
- "steam engine" → exact phrase
- steam OR diesel → either word
- railway NOT bus → exclude a term
*/

// ============================================================
// STEP 10: Example Searches for Different Research Areas
// ============================================================
/*
INDUSTRIAL HISTORY:
- "steam engine" → foundational industrial technology
- "textile machinery" → manufacturing history
- "railway locomotive" → rail transport development
- "industrial revolution" → defining era

TRANSPORTATION:
- "bicycle" → cycling history
- "automobile" → car development
- "aircraft" → aviation history
- "ship" → maritime history
- "locomotive" → railway history

TECHNOLOGY & COMPUTING:
- "computer" → computing history
- "telephone" → communication technology
- "radio" → broadcasting history
- "television" → media technology
- "electric" → electrical engineering

SCIENTIFIC INSTRUMENTS:
- "microscope" → microscopy
- "telescope" → astronomy
- "thermometer" → measurement
- "barometer" → meteorology
- "compass" → navigation

MEDICAL & HEALTH:
- "surgical instruments" → medical practice
- "microscope" → medical microscopy
- "X-ray" → diagnostic imaging
- "stethoscope" → listening devices

MATERIALS & MANUFACTURE:
- "iron" → metalworking
- "glass" → glassmaking
- "ceramic" → pottery
- "textile" → weaving and dyeing
- "printing" → printing technology
*/

// ============================================================
// STEP 11: Important Notes and Gotchas
// ============================================================
/*
JSON:API STRUCTURE:
The deeply nested structure (attributes.lifecycle.creation[0]...)
can seem overwhelming. Remember: the platform adapter handles this
automatically. When testing directly against the API, use proper
path notation.

NOT ALL ITEMS HAVE IMAGES:
Some historical items may not be digitized yet. Results without
images are still returned. The platform adapter focuses on items
with images.

ON_DISPLAY FILTERING:
Items marked on_display: true are currently in museum galleries.
Items that are false are either in storage or historical
(no longer displayed). Both can be fascinating for research.

CREATION DATES:
The date field represents WHEN THE OBJECT WAS MADE, not when it
was acquired by the museum. A steam engine from 1829 was made
in 1829, not acquired in 1829.

MULTIPLE CREATORS:
Some items (especially complex machinery) have multiple makers.
The adapter uses the first maker. For full details, consult the
museum's online catalog.

MUSEUM CLOSURES:
While the API data is always available, physical museum visits
vary. Check museum websites for current opening hours and
exhibitions.

PERMISSION FOR REUSE:
Most Science Museum images are freely reusable, but always check
the metadata for licensing information. Copyright varies by item.
*/

// ============================================================
// QUICK REFERENCE: Pagination with JSON:API
// ============================================================
/*
PAGE-BASED PAGINATION:
The Science Museum API uses page-based pagination with JSON:API syntax:

Page 1 (default):
{
  q: 'steam',
  'page[number]': 1,
  'page[size]': 20
}
← Returns items 1-20

Page 2:
{
  q: 'steam',
  'page[number]': 2,
  'page[size]': 20
}
← Returns items 21-40

TOTAL RESULTS:
The total count is in meta.hit_count in the response.
Use this to calculate how many pages of results exist.

RECOMMENDED PAGE SIZE:
- page[size]: 20 → good balance of detail and speed
- page[size]: 50 → fewer requests, but larger response
- page[size]: 100 → maximum, fastest for bulk searches
*/
