/*
 * ============================================================
 * J. PAUL GETTY MUSEUM API — ADAPTER EXAMPLE & DOCUMENTATION
 * Voice Control Research Platform
 * ============================================================
 *
 * WHAT IS THE GETTY MUSEUM API?
 * The J. Paul Getty Museum in Los Angeles makes its collection available
 * through a Linked Art / Linked Open Data (LOD) API. This is VERY different
 * from typical REST APIs—it uses semantic web standards and returns data
 * in JSON-LD format.
 *
 * The Getty collection includes: paintings, drawings, prints, sculptures,
 * photographs, manuscripts, and decorative arts spanning from antiquity
 * to the present day.
 *
 * AUTHENTICATION: None required
 * BASE URL: https://data.getty.edu/
 * DOCS: https://www.getty.edu/about/whatwedo/opencontent.html
 * API DOCS: https://getty.edu/about/whatwedo/opencontent/tools.html
 * LICENCE: Getty Open Content Program — freely usable for any purpose
 * RATE LIMITS: No official limit; be respectful with automated access
 * ============================================================
 */

// ============================================================
// STEP 1: Linked Art / Linked Open Data (LOD) Format Primer
// ============================================================
/*
IMPORTANT: The Getty uses JSON-LD, not standard REST JSON.

JSON-LD (JSON for Linked Data) is a format that combines JSON with
semantic web standards. It uses "@context" to define meaning, and
represents relationships and concepts using URIs.

This is VERY different from other museum APIs. It's more powerful
for semantic data but requires understanding how to navigate it.

COMPARE TWO APIs:

STANDARD REST (Metropolitan Museum):
{
  "title": "Irises",
  "artistDisplayName": "Claude Monet",
  "date": "1890-91"
}

JSON-LD/LINKED ART (Getty):
{
  "@context": "https://linked.art/ns/v1/linked-art.json",
  "id": "https://data.getty.edu/museum/collection/object/...",
  "_label": "Irises",
  "produced_by": {
    "_label": "Creation of Irises",
    "carried_out_by": [
      {
        "id": "https://...",
        "_label": "Claude Monet"
      }
    ],
    "timespan": {
      "_label": "1890-91"
    }
  },
  "representation": [
    {
      "id": "https://...",
      "_label": "thumbnail"
    }
  ],
  "referred_to_by": [
    {
      "type": "Text",
      "value": "Oil on canvas. A masterwork of..."
    }
  ]
}

KEY DIFFERENCES:
1. Uses "_label" instead of "label" or "title"
2. All relationships are explicit: created_by, is_about, etc.
3. Uses URIs (URLs) as unique identifiers
4. Multiple levels of nesting for concepts
5. Property names reflect semantic relationships
*/

// ============================================================
// STEP 2: Understanding Getty Response Structure
// ============================================================
/*
A Getty object record looks like:

{
  "@context": "https://linked.art/ns/v1/linked-art.json",
  "type": "HumanMadeObject",
  "id": "https://data.getty.edu/museum/collection/object/4b1b0e8e-b7c3-4f0d-ace5-9591f9bb3df3",
  "_label": "Irises",
  "classified_as": [
    {"id": "http://vocab.getty.edu/aat/300011994", "_label": "paintings"}
  ],
  "produced_by": {
    "type": "Production",
    "_label": "Creation",
    "carried_out_by": [
      {
        "id": "https://data.getty.edu/museum/person/...",
        "_label": "Claude Monet",
        "born": "1840-11-14",
        "died": "1926-12-05"
      }
    ],
    "timespan": {
      "_label": "1888-1890"
    },
    "took_place_at": [
      {
        "id": "https://...",
        "_label": "Giverny, France"
      }
    ]
  },
  "referred_to_by": [
    {
      "type": "Text",
      "value": "Oil on canvas. One of Claude Monet's iconic paintings..."
    }
  ],
  "representation": [
    {
      "type": "VisualItem",
      "id": "https://data.getty.edu/museum/image/...",
      "_label": "Full image",
      "digitally_shows": {
        "id": "https://data.getty.edu/museum/collection/object/...",
        "_label": "Irises"
      }
    }
  ],
  "about": [
    {
      "id": "http://vocab.getty.edu/aat/300125051",
      "_label": "irises (flowers)"
    }
  ]
}

KEY FIELDS YOU'LL NAVIGATE:
- _label: The title or label of the object
- produced_by.carried_out_by[0]._label: Artist/creator name
- produced_by.timespan._label: Date created
- referred_to_by[0].value: Description
- representation[0].id: Image identifier (needs IIIF suffix)
- about[].label: Subject matter, depicted concepts
*/

// ============================================================
// STEP 3: Complete Adapter Registration Example
// ============================================================
/*
Here's the registration code for the Getty adapter:

apiAdapterRegistry.register({
  id: 'getty',
  name: 'J. Paul Getty Museum',

  // No authentication
  authentication: {
    type: 'none'
  },

  // Getty object endpoint (LOD/JSON-LD format)
  endpoint: 'https://data.getty.edu/museum/collection/object',

  // Response configuration for JSON-LD
  responseMapping: {
    // This is a direct object response, not a search endpoint
    // The adapter handles direct object ID lookup
    isSingleObject: true,

    // Field mapping for JSON-LD structure
    fieldMapping: {
      title: '_label',
      creator: 'produced_by.carried_out_by[0]._label',
      date: 'produced_by.timespan._label',
      description: 'referred_to_by[0].value',
      thumbnail: 'representation[0].id',
      objectType: 'classified_as[0]._label',
      location: 'produced_by.took_place_at[0]._label',
      id: 'id'
    },

    // Subject tags from the 'about' field
    tagsPath: 'about',
    tagsField: '_label'
  },

  // Query parameter mapping
  queryMapping: {
    // Getty doesn't support freetext search via LOD API
    // Search must be by object ID or via SPARQL
  },

  // Important note: Getty LOD doesn't support direct keyword search
  // Objects are accessed via direct ID or through their web interface
  searchMethod: 'direct-id-only',

  // For production use, Getty recommends SPARQL queries
  sparqlEndpoint: 'https://data.getty.edu/sparql'
});
*/

// ============================================================
// STEP 4: Accessing Getty Objects
// ============================================================
/*
IMPORTANT: The Getty LOD API does NOT support keyword search.
Instead, you must:

METHOD 1: DIRECT OBJECT ACCESS (recommended)
If you know the Getty object ID, you can fetch it directly:

apiAdapterRegistry.getObject('getty', {
  id: '4b1b0e8e-b7c3-4f0d-ace5-9591f9bb3df3'
});

METHOD 2: FIND OBJECT ID VIA GETTY WEBSITE
Visit https://www.getty.edu/about/whatwedo/opencontent.html
Use their collection search to find artworks, then note the object ID
from the URL or metadata.

METHOD 3: SPARQL QUERY (ADVANCED)
The Getty provides a SPARQL endpoint for complex queries:
https://data.getty.edu/sparql

This requires knowledge of SPARQL (semantic query language).
Example query to find paintings by Monet:

SELECT ?object
WHERE {
  ?object a lax:PrimaryObject ;
    lax:carried_out_by ?artist .
  ?artist rdf:label "Claude Monet"@en .
}

RESULT FROM SPARQL: Returns object IDs, which you can then fetch
using Method 1.
*/

// ============================================================
// STEP 5: Example Getty Object IDs (Real Objects)
// ============================================================
/*
Here are EXAMPLE Getty object IDs you can try. These are formatted
as typical UUIDs but use realistic patterns based on Getty's system:

PAINTINGS:
- Impressionist landscape: browse getty.edu for Monet, Renoir, Cézanne
- Modern art: search for Kandinsky, Mondrian, Matisse
- Classical painting: search for Titian, Rubens, Rembrandt

DECORATIVE ARTS:
- Furniture: search for "chair", "cabinet", "table"
- Ceramics: search for "vase", "bowl", "porcelain"
- Textiles: search for "tapestry", "robe", "fabric"

PHOTOGRAPHS:
- Early photography: search "albumen print", "daguerreotype"
- Modern photography: search photographer names

HOW TO FIND ACTUAL IDs:
1. Go to www.getty.edu
2. Search for an artwork you're interested in
3. Look at the URL or page metadata for the object ID
4. Use that ID with the adapter

IMPORTANT: Don't guess at IDs. Use the Getty website to find
actual object IDs from their collection.
*/

// ============================================================
// STEP 6: Understanding IIIF Image URLs
// ============================================================
/*
Getty images are IIIF (International Image Interoperability Framework).

SAMPLE IIIF IMAGE URL:
https://media.getty.edu/iiif/image/[image-id]/full/!400,400/0/default.jpg

The "representation" field in Getty data gives you the image ID.
To use it, you need to add IIIF parameters.

COMMON IIIF PARAMETERS:
/full/              → return entire image
/!400,400/          → fit into 400x400 box (maintain aspect ratio)
/full/max/          → full resolution (can be VERY large)
/0/default.jpg      → rotation and format

BUILDING IMAGE URLs:
If Getty returns:
  "representation": [{"id": "https://media.getty.edu/..."}]

Add IIIF suffix to get an image:
https://media.getty.edu/iiif/image/[id]/full/!400,400/0/default.jpg

The platform adapter does this automatically where possible.
*/

// ============================================================
// STEP 7: Semantic Web Concepts in Getty Data
// ============================================================
/*
Getty uses controlled vocabularies and semantic web URIs for everything:

ARTIST/CREATOR:
Instead of just "Claude Monet", Getty stores:
{
  "id": "https://data.getty.edu/museum/person/[uuid]",
  "_label": "Claude Monet",
  "type": "Agent",
  "born": "1840-11-14",
  "died": "1926-12-05"
}

The 'id' is a URI uniquely identifying Monet in their system.
You can follow this URI to get more information about the artist.

SUBJECT MATTER:
Instead of just "flowers", Getty uses Getty Art & Architecture Thesaurus:
{
  "id": "http://vocab.getty.edu/aat/300125051",
  "_label": "irises (flowers)"
}

The http://vocab.getty.edu/aat/ URIs are standardized art terms.

OBJECT CLASSIFICATION:
{
  "id": "http://vocab.getty.edu/aat/300011994",
  "_label": "paintings"
}

This links to Getty's AAT (Art & Architecture Thesaurus) controlled
vocabulary for object types.

WHY THIS MATTERS FOR RESEARCH:
The semantic structure means:
- You can follow URIs to get more information
- Terms are standardized across institutions
- Relationships are explicit and machine-readable
- You can write complex queries across linked datasets
*/

// ============================================================
// STEP 8: JSON-LD vs. Regular JSON
// ============================================================
/*
REGULAR JSON (what most APIs use):
{
  "title": "Iris",
  "artist": "Claude Monet",
  "year": "1888"
}

JSON-LD (what Getty uses):
{
  "@context": "https://linked.art/ns/v1/linked-art.json",
  "_label": "Iris",
  "produced_by": {
    "carried_out_by": [
      {"_label": "Claude Monet"}
    ],
    "timespan": {"_label": "1888"}
  }
}

BENEFITS OF JSON-LD:
1. Machine-readable semantics (computers understand the meaning)
2. Linked to other data sources via URIs
3. Explicit relationships (not ambiguous)
4. Follows international standards (semantic web)
5. Supports complex queries (SPARQL)

CHALLENGES OF JSON-LD:
1. More nesting = harder to navigate initially
2. Requires understanding semantic web concepts
3. Less intuitive than simple key-value pairs
4. Steeper learning curve for developers

FOR RESEARCHERS:
The Getty's JSON-LD format is powerful for deep research because
it connects to other cultural heritage data sources and uses
standardized terminology. For casual browsing, simpler APIs
(Metropolitan Museum, Europeana) may be easier to use.
*/

// ============================================================
// STEP 9: Example Searches Using Getty Website
// ============================================================
/*
To find objects using Getty's web interface (then use API):

PAINTINGS:
1. Go to www.getty.edu
2. Click "Collections" or "Search the Collection"
3. Search: "Monet", "Renoir", "Van Gogh", "Matisse"
4. Click on a result to view details
5. Note the object ID from the URL or metadata
6. Use that ID with the Getty adapter

DECORATIVE ARTS:
- "Furniture" → chairs, tables, cabinets, chests
- "Ceramics" → vases, bowls, tiles, jugs
- "Glass" → vessels, windows, lighting
- "Metalwork" → silver, bronze, iron objects
- "Textiles" → tapestries, embroideries, clothing

PHOTOGRAPHS & PRINTS:
- "Prints" → engravings, lithographs, etchings
- "Photographs" → albumen prints, gelatin prints, digital
- "Drawings" → charcoal, chalk, pencil, ink studies

SCULPTURES:
- "Sculpture" → marble, bronze, wood, stone
- "Relief" → high relief, low relief carved objects
- "Busts" → portrait heads

MANUSCRIPTS & BOOKS:
- "Illuminated manuscripts" → medieval decorated books
- "Rare books" → historic printed volumes
- "Documents" → letters, contracts, manuscripts
*/

// ============================================================
// STEP 10: Advanced Use: SPARQL Queries
// ============================================================
/*
For advanced researchers, Getty provides SPARQL endpoint:
https://data.getty.edu/sparql

SPARQL (SPARQL Protocol and RDF Query Language) lets you query
linked data with complex conditions.

EXAMPLE SPARQL QUERY:
Find all paintings by French artists in the Getty collection:

SELECT ?painting ?title ?artist
WHERE {
  ?painting a lax:PrimaryObject ;
    lax:identified_by ?ti ;
    lax:produced_by ?prod .
  ?ti rdfs:label ?title .
  ?prod lax:carried_out_by ?agent .
  ?agent rdfs:label ?artist ;
    lax:born_in ?birthplace .
  ?birthplace rdfs:label "France"@en .
}
LIMIT 50

RUNNING SPARQL QUERIES:
1. Visit the Getty SPARQL endpoint
2. Paste your query
3. Run it to get results
4. Results are object IDs that you can then fetch via API

LEARNING SPARQL:
SPARQL is powerful but has a learning curve. Resources:
- https://www.w3.org/TR/sparql11-query/ (official spec)
- Getty documentation (links from their API page)
- Online SPARQL tutorials

FOR RESEARCHERS WITHOUT SPARQL KNOWLEDGE:
Use the Getty website search instead, then use the API to fetch
object details. This is simpler and still very capable.
*/

// ============================================================
// STEP 11: Important Considerations
// ============================================================
/*
LACK OF KEYWORD SEARCH:
The Getty LOD API doesn't support simple keyword search like other
APIs. You must either:
1. Know the object ID (from their website)
2. Write SPARQL queries (advanced)
3. Use their web interface to browse (simpler)

This is intentional—it encourages proper semantic queries and
integration with linked data.

SEMANTIC WEB IS POWERFUL BUT DIFFERENT:
If you're used to simple REST APIs (Met Museum, Europeana), Getty's
semantic web approach will feel different. It IS more powerful for
research, but requires understanding the concepts.

IMAGE AVAILABILITY:
Not all Getty objects have digitized images. The Getty has been
digitizing its collection gradually. Objects may exist in the
system but not have images.

LINKED DATA BENEFITS:
Getty's LOD approach means you can:
- Connect to other museum data
- Use standardized art terminology
- Build complex research queries
- Integrate with other semantic web sources

This is ideal for academic research and institutional use.

REUSE AND RIGHTS:
Getty Open Content Program images are free to use for any purpose.
Always check the specific object's rights/license information.
Most are unrestricted, some may have specific attribution
requirements.

CRAWLING AND BULK ACCESS:
Don't write automated scripts that crawl millions of objects.
For bulk research, contact Getty directly about data access
options or consider SPARQL queries for more targeted access.
*/

// ============================================================
// STEP 12: When to Use Getty vs. Other APIs
// ============================================================
/*
USE GETTY WHEN:
✓ You want semantic web standards and linked data
✓ You're doing academic research requiring precision
✓ You need to connect to other linked data sources
✓ You can learn SPARQL for complex queries
✓ You prefer explicit relationships and controlled vocabularies
✓ You're building a research system that needs standards

USE OTHER APIS WHEN:
✓ You want simple keyword search (try Europeana, Met Museum)
✓ You prefer flatter, simpler JSON responses (Met Museum)
✓ You want to quickly browse without technical setup (any website)
✓ You need fast, simple integration (Europeana, Met Museum)
✓ You're building for non-technical users (Europeana, Wellcome)

PERFECT COMBINATION:
Many researchers use MULTIPLE museum APIs:
- Europeana or Met Museum for quick browsing and discovery
- Getty for deeper semantic research
- Wellcome for medical/scientific collections
- Science Museum for industrial and technology items

The Voice Control platform supports all of these, so you can
search across multiple institutions in one interface.
*/

// ============================================================
// QUICK REFERENCE: File Paths and Resources
// ============================================================
/*
GETTY RESOURCES:
- Main collection: https://www.getty.edu/about/whatwedo/opencontent.html
- Open content info: https://www.getty.edu/about/whatwedo/opencontent/
- API documentation: https://getty.edu/about/whatwedo/opencontent/tools.html
- SPARQL endpoint: https://data.getty.edu/sparql
- Linked Art spec: https://linked.art/

AAT (Art & Architecture Thesaurus):
- Main site: http://vocab.getty.edu/aat/
- Searchable: https://www.getty.edu/research/tools/

TGN (Thesaurus of Geographic Names):
- For places: http://vocab.getty.edu/tgn/

ULAN (Union List of Artist Names):
- For artists: http://vocab.getty.edu/ulan/
*/
