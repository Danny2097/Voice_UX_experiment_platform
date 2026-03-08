/*
 * ============================================================
 * WELLCOME COLLECTION API — ADAPTER EXAMPLE & DOCUMENTATION
 * Voice Control Research Platform
 * ============================================================
 *
 * WHAT IS WELLCOME COLLECTION?
 * The Wellcome Collection is a free museum in London (and online) exploring
 * medicine, science, and human experience. Their collection spans 7 centuries:
 * medical artifacts, historical instruments, anatomical preparations, books,
 * photographs, specimens, and contemporary art installations. Unique focus on
 * the history and cultural aspects of health, medicine, and wellbeing.
 *
 * GETTING STARTED:
 * Completely free. No authentication required. No registration needed.
 * Just search and download.
 *
 * AUTHENTICATION: None required
 * BASE URL: https://api.wellcomecollection.org/catalogue/v2/
 * DOCS: https://developers.wellcomecollection.org/
 * LICENCE: Most items are CC BY or public domain (varies by item)
 * RATE LIMITS: No official limit; typical usage (1 request/second) is safe
 * ============================================================
 */

// ============================================================
// STEP 1: Understanding the Wellcome API Response
// ============================================================
/*
When you search Wellcome Collection, you get a response like:

{
  "pageSize": 15,
  "totalPages": 284,
  "totalResults": 4261,
  "pageNumber": 1,
  "results": [
    {
      "id": "d34f5c1v",
      "title": "Portrait of William Harvey",
      "workType": {
        "id": "k",
        "label": "Pictures"
      },
      "referenceNumber": "EPH/A/1/4/1",
      "contributors": [
        {
          "agent": {
            "id": "a2b3f9x",
            "label": "John Michael Wright"
          },
          "roles": [{"label": "creator"}]
        }
      ],
      "thumbnail": {
        "url": "https://iiif.wellcomecollection.org/image/..."
      },
      "description": [
        {
          "value": "This portrait of William Harvey, the renowned..."
        }
      ],
      "subjects": [
        {
          "label": "Portraits",
          "concepts": []
        },
        {
          "label": "Scientists",
          "concepts": []
        }
      ],
      "productionDates": [
        {
          "label": "17th century"
        }
      ]
    }
    // ... more items
  ]
}

KEY POINTS ABOUT WELLCOME RESPONSES:
- Results are in the 'results' array (not 'items')
- Deeply nested structure: contributors[].agent.label for creator names
- Subject labels provide thematic tags (Portraits, Science, Medicine, etc.)
- Images are IIIF URLs (you can modify them for different sizes)
- Work types categorize the item: Books, Pictures, Digital Images, etc.
*/

// ============================================================
// STEP 2: Field Mapping — what maps to what
// ============================================================
/*
Wellcome Field                    →  Platform Field      →  Example
──────────────────────────────────────────────────────────────────
title                             →  title               →  "Portrait of William Harvey"
contributors[0].agent.label       →  creator             →  "John Michael Wright"
workType.label                    →  workType            →  "Pictures"
description[0].value              →  description         →  "This portrait of..."
thumbnail.url                     →  thumbnail           →  "https://iiif.wellcome..."
subjects[].label                  →  subjects            →  ["Portraits", "Scientists"]
productionDates[0].label          →  date                →  "17th century"
*/

// ============================================================
// STEP 3: Complete Adapter Registration Example
// ============================================================
/*
Here's the complete registration code for the Wellcome adapter:

apiAdapterRegistry.register({
  id: 'wellcome',
  name: 'Wellcome Collection',

  // No authentication required
  authentication: {
    type: 'none'
  },

  // Base endpoint
  endpoint: 'https://api.wellcomecollection.org/catalogue/v2/works',

  // Response configuration
  responseMapping: {
    // Results are in the 'results' array
    resultsPath: 'results',

    // Field mapping
    fieldMapping: {
      title: 'title',
      creator: 'contributors[0].agent.label',
      workType: 'workType.label',
      description: 'description[0].value',
      thumbnail: 'thumbnail.url',
      date: 'productionDates[0].label',
      id: 'id',
      referenceNumber: 'referenceNumber'
    },

    // Subject tags are extracted from the subjects array
    tagsPath: 'subjects',
    tagsField: 'label'
  },

  // Query parameter mapping
  queryMapping: {
    q: 'query',            // Search term
    pageSize: 'pageSize',  // Items per page
    page: 'page'           // Page number (1-based)
  },

  // Default parameters
  defaultParams: {
    pageSize: 15,          // Items per request (max 100)
    include: 'subjects,contributors,images'  // Include detailed data
  },

  // Pagination configuration
  pagination: {
    type: 'page-based',
    pageParamName: 'page',
    pageSizeParamName: 'pageSize',
    firstPageNumber: 1
  }
});
*/

// ============================================================
// STEP 4: Testing the Adapter
// ============================================================
/*
Test in the browser console:

// Simple search for medical history
apiAdapterRegistry.search('wellcome', {
  q: 'anatomy'
});

// Search for a specific work type (Pictures)
apiAdapterRegistry.search('wellcome', {
  q: 'medical instruments'
});

// Get more results per page
apiAdapterRegistry.search('wellcome', {
  q: 'portrait',
  pageSize: 50
});

The results include thumbnail images and metadata. Click an image to see
the full-resolution version. Wellcome provides IIIF images (standardized
format with good quality at multiple zoom levels).
*/

// ============================================================
// STEP 5: Work Types — What You'll Find
// ============================================================
/*
Wellcome uses work type IDs and labels to categorize items:

Work Type ID    Work Type Label
──────────────────────────────────────
a               Books                    ← manuscript volumes, printed books
c               Digital Images           ← born-digital items
d               Manuscripts              ← handwritten documents
e               Maps                     ← cartographic works
f               Music                    ← musical scores, recordings
g               Sound                    ← audio recordings
h               Film and video           ← moving image media
k               Pictures                 ← paintings, drawings, prints, photos
m               Mixed material           ← multi-format collections
v               Artwork                  ← contemporary art installations

FILTERING BY WORK TYPE:
You can filter results by work type using the workType parameter:
apiAdapterRegistry.search('wellcome', {
  q: 'surgery',
  workType: 'k'  // Pictures only
});

Or by label (the adapter handles conversion):
apiAdapterRegistry.search('wellcome', {
  q: 'anatomy',
  workType: 'Books'
});
*/

// ============================================================
// STEP 6: Subject Tags and Filtering
// ============================================================
/*
Wellcome curators have tagged items with rich subject information.
Common subjects you'll encounter:

Medical/Scientific:
- Anatomy, Physiology, Surgery, Medicine, Pharmacology
- Diseases, Public health, Disability, Mental health
- Neurology, Embryology, Microscopy, Pathology

Historical:
- Medieval period, Renaissance, 18th century, 19th century
- Medical history, History of science, Museums & galleries

Social/Cultural:
- Gender & sexuality, Religion, Death & dying
- Mental health, Wellbeing, Human behavior

Material/Type:
- Specimens, Instruments, Photographs, Manuscripts
- Models, Artifacts, Prints

When searching, use subject terms to narrow results:
- "anatomy" → all anatomy-related items
- "surgery" + "instruments" → surgical tools
- "microscope" → microscopy-related items
- "anatomical model" → teaching models
*/

// ============================================================
// STEP 7: Images and IIIF
// ============================================================
/*
WHAT IS IIIF?
IIIF (International Image Interoperability Framework) is a standardized
format for accessing and displaying high-quality images. Wellcome uses
IIIF for all their digitized items.

THE THUMBNAIL URL:
The thumbnail.url is an IIIF URL that looks like:
https://iiif.wellcomecollection.org/image/L0023456/full/!400,400/0/default.jpg

You can modify the parameters to get different sizes:
- /full/!200,200/ → smaller thumbnail (200x200 max)
- /full/!800,800/ → medium size (800x800 max)
- /full/max/ → full resolution (can be very large)

The platform handles this automatically, but useful to know for custom
requests.

IMAGE QUALITY:
Wellcome's digitization standards are high—medical artifacts, anatomical
preparations, and historical instruments are photographed with museum-quality
lighting and resolution. Good for research and publication.

REUSE RIGHTS:
Most Wellcome items are under Creative Commons licenses or public domain.
Check the item's full metadata (via their website) for exact rights.
The API response usually includes rights information in the full record.
*/

// ============================================================
// STEP 8: Advanced Features and Tips
// ============================================================
/*
FILTERING OPTIONS:
You can combine multiple parameters to narrow searches:

// Medical items that are pictures
apiAdapterRegistry.search('wellcome', {
  q: 'surgery',
  workType: 'k'
});

// Medical manuscripts
apiAdapterRegistry.search('wellcome', {
  q: 'pharmacy',
  workType: 'd'
});

PAGINATION:
Wellcome uses page-based pagination (not offset):
- Page 1: items 1-15 (default pageSize)
- Page 2: items 16-30
- Page 3: items 31-45, etc.

To get page 2:
apiAdapterRegistry.search('wellcome', {
  q: 'anatomy',
  page: 2,
  pageSize: 20
});

CONTRIBUTOR ROLES:
The contributors array includes roles like:
- creator, illustrator, author, photographer, engraver
- This tells you the type of contribution

Multiple contributors means it's a collaborative work. For example,
a medical illustration might have both author and illustrator.

PRODUCTION DATES:
These are usually century ranges ("17th century") or general periods
("Medieval"). Useful for historical research and filtering by era.

SEARCHING ANATOMICAL CONTENT:
Wellcome has a particularly rich collection of anatomical drawings,
models, and specimens. Search terms:
- "anatomy" → all anatomical content
- "anatomical model" → 3D models for teaching
- "dissection" → preparation techniques
- "skeleton", "skull", "organs" → specific body parts
*/

// ============================================================
// STEP 9: Example Searches for Different Research Goals
// ============================================================
/*
MEDICAL HISTORY:
- "medieval medicine" → medicine in the medieval period
- "surgery" → surgical practice and tools
- "anatomy" → anatomical knowledge and illustration
- "pharmacology" → history of drugs and remedies
- "vaccination" → history of vaccines

SCIENTIFIC INSTRUMENTS:
- "microscope" → microscopy throughout history
- "thermometer" → temperature measurement
- "telescope" → astronomical instruments
- "stethoscope" → medical listening devices

ANATOMICAL STUDIES:
- "dissection" → anatomical dissection practices
- "skeleton" → skeletal system studies
- "anatomical model" → teaching models
- "muscle" → muscular anatomy

SOCIAL HISTORY:
- "mental health" → mental illness and treatment history
- "disability" → disability history and concepts
- "death" → death and dying practices
- "reproduction" → reproductive health history

GENDER & SEXUALITY:
- "women in medicine" → female practitioners
- "midwifery" → obstetric history
- "contraception" → birth control history

CONTEMPORARY & ARTISTIC:
- "wellcome prize" → contemporary art installations
- "health and art" → artworks exploring wellbeing
*/

// ============================================================
// QUICK REFERENCE: Common Issues and Solutions
// ============================================================
/*
ISSUE: Search returns 0 results
SOLUTION: Try a broader term. Medical terminology varies over time.
          Instead of "inflammation", try "disease" or "pathology".

ISSUE: Too many results (4,000+)
SOLUTION: Combine terms: "surgery AND anatomy" (not "surgery")
          Use specific object types: workType = 'k' for Pictures

ISSUE: Image not loading
SOLUTION: Some items may be restricted or in processing. Try another
          search. The Wellcome Collection is constantly digitizing.

ISSUE: Can't find a specific item
SOLUTION: Use Wellcome's online catalog at wellcomecollection.org
          to find exact reference numbers, then search by those.
*/
