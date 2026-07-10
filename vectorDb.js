// Lightweight Semantic Vector Database Engine for FLOODGUARD HƯƠNG KHÊ
// Pure Node.js implementation of dense vector embeddings and cosine similarity search.

// 8 Semantic dimensions:
// 0: RESCUE_PHYSICAL (Need rescue, boat, phao, roof, drowning)
// 1: SUPPLY_FOOD (Hunger, food, instant noodles, drinking water)
// 2: SUPPLY_MEDICAL (Medicine, injury, pain, emergency, sickness)
// 3: ENVIRONMENT_FLOOD (Flooding level, river rising, rain, storm)
// 4: ENVIRONMENT_LANDSLIDE (Landslide, soil, rocks, mountain erosion)
// 5: INFRASTRUCTURE_SAFE (Safe zone, school, shelter, commune house)
// 6: ALERT_LEVEL (Urgency, danger, red alert, dead)
// 7: AGE_VULNERABILITY (Elderly, baby, pregnant, kids)

const EMBEDDINGS_DICT = {
  // Rescue physical (Dim 0)
  'cứu': [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.0],
  'cuu': [1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.0],
  'hộ': [0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'ho': [0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'xuồng': [1.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0],
  'xuong': [1.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0],
  'thuyền': [1.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0],
  'thuyen': [1.0, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0],
  'phao': [0.9, 0.0, 0.0, 0.1, 0.0, 0.0, 0.0, 0.0],
  'mái': [0.7, 0.0, 0.0, 0.5, 0.0, 0.0, 0.2, 0.0],
  'mai': [0.7, 0.0, 0.0, 0.5, 0.0, 0.0, 0.2, 0.0],
  'chìm': [0.9, 0.0, 0.0, 0.8, 0.0, 0.0, 0.5, 0.0],
  'chim': [0.9, 0.0, 0.0, 0.8, 0.0, 0.0, 0.5, 0.0],
  'kẹt': [0.8, 0.0, 0.0, 0.3, 0.3, 0.0, 0.4, 0.0],
  'ket': [0.8, 0.0, 0.0, 0.3, 0.3, 0.0, 0.4, 0.0],

  // Supply food (Dim 1)
  'đói': [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.2, 0.0],
  // "doi" may mean "đói" or "đồi" when accents are omitted.
  'doi': [0.0, 1.0, 0.0, 0.0, 0.7, 0.0, 0.2, 0.0],
  'ăn': [0.0, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  // "an" may mean "ăn" or "an toàn" when accents are omitted.
  'an': [0.0, 0.9, 0.0, 0.0, 0.0, 0.8, 0.0, 0.0],
  'uống': [0.0, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'uong': [0.0, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'khát': [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.2, 0.0],
  'khat': [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.2, 0.0],
  'mì': [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'mi': [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'gạo': [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'gao': [0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'sữa': [0.0, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4],
  'sua': [0.0, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4],
  'lương': [0.0, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'luong': [0.0, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'thực': [0.0, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'thuc': [0.0, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'đồ': [0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'do': [0.0, 0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'bánh': [0.0, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  'banh': [0.0, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],

  // Supply medical (Dim 2)
  'y': [0.0, 0.0, 0.9, 0.0, 0.0, 0.0, 0.1, 0.0],
  'tế': [0.0, 0.0, 0.9, 0.0, 0.0, 0.0, 0.1, 0.0],
  'te': [0.0, 0.0, 0.9, 0.0, 0.0, 0.0, 0.1, 0.0],
  'thuốc': [0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.1, 0.0],
  'thuoc': [0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.1, 0.0],
  'thương': [0.0, 0.0, 0.9, 0.0, 0.0, 0.0, 0.3, 0.0],
  'thuong': [0.0, 0.0, 0.9, 0.0, 0.0, 0.0, 0.3, 0.0],
  'đau': [0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.2, 0.0],
  'dau': [0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.2, 0.0],
  'bệnh': [0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.2, 0.1],
  'benh': [0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.2, 0.1],
  'sốt': [0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.2, 0.2],
  'sot': [0.0, 0.0, 0.8, 0.0, 0.0, 0.0, 0.2, 0.2],
  'máu': [0.0, 0.0, 0.9, 0.0, 0.0, 0.0, 0.5, 0.0],
  'mau': [0.0, 0.0, 0.9, 0.0, 0.0, 0.0, 0.5, 0.0],
  'khám': [0.0, 0.0, 0.7, 0.0, 0.0, 0.1, 0.0, 0.0],
  'kham': [0.0, 0.0, 0.7, 0.0, 0.0, 0.1, 0.0, 0.0],

  // Environment Flood (Dim 3)
  'ngập': [0.2, 0.0, 0.0, 1.0, 0.0, 0.0, 0.3, 0.0],
  'ngap': [0.2, 0.0, 0.0, 1.0, 0.0, 0.0, 0.3, 0.0],
  'lụt': [0.2, 0.0, 0.0, 1.0, 0.0, 0.0, 0.3, 0.0],
  'lut': [0.2, 0.0, 0.0, 1.0, 0.0, 0.0, 0.3, 0.0],
  'nước': [0.1, 0.1, 0.0, 0.8, 0.0, 0.0, 0.1, 0.0],
  'nuoc': [0.1, 0.1, 0.0, 0.8, 0.0, 0.0, 0.1, 0.0],
  'lũ': [0.3, 0.0, 0.0, 0.9, 0.2, 0.0, 0.4, 0.0],
  'lu': [0.3, 0.0, 0.0, 0.9, 0.2, 0.0, 0.4, 0.0],
  'sông': [0.0, 0.0, 0.0, 0.6, 0.0, 0.0, 0.1, 0.0],
  'song': [0.0, 0.0, 0.0, 0.6, 0.0, 0.0, 0.1, 0.0],
  'dâng': [0.1, 0.0, 0.0, 0.8, 0.0, 0.0, 0.2, 0.0],
  'dang': [0.1, 0.0, 0.0, 0.8, 0.0, 0.0, 0.2, 0.0],
  'triều': [0.0, 0.0, 0.0, 0.8, 0.1, 0.0, 0.1, 0.0],
  'trieu': [0.0, 0.0, 0.0, 0.8, 0.1, 0.0, 0.1, 0.0],
  'cường': [0.0, 0.0, 0.0, 0.8, 0.1, 0.0, 0.1, 0.0],
  'cuong': [0.0, 0.0, 0.0, 0.8, 0.1, 0.0, 0.1, 0.0],

  // Environment Landslide (Dim 4)
  'sạt': [0.3, 0.0, 0.0, 0.0, 1.0, 0.0, 0.4, 0.0],
  'sat': [0.3, 0.0, 0.0, 0.0, 1.0, 0.0, 0.4, 0.0],
  'lở': [0.3, 0.0, 0.0, 0.0, 1.0, 0.0, 0.4, 0.0],
  'lo': [0.3, 0.0, 0.0, 0.0, 1.0, 0.0, 0.4, 0.0],
  'đất': [0.0, 0.0, 0.0, 0.0, 0.8, 0.0, 0.1, 0.0],
  'dat': [0.0, 0.0, 0.0, 0.0, 0.8, 0.0, 0.1, 0.0],
  'đá': [0.0, 0.0, 0.0, 0.0, 0.8, 0.0, 0.1, 0.0],
  'da': [0.0, 0.0, 0.0, 0.0, 0.8, 0.0, 0.1, 0.0],
  'núi': [0.0, 0.0, 0.0, 0.0, 0.7, 0.0, 0.0, 0.0],
  'nui': [0.0, 0.0, 0.0, 0.0, 0.7, 0.0, 0.0, 0.0],
  'đồi': [0.0, 0.0, 0.0, 0.0, 0.7, 0.0, 0.0, 0.0],

  // Infrastructure safe (Dim 5)
  'sơ': [0.1, 0.0, 0.0, 0.0, 0.0, 0.9, 0.0, 0.0],
  'so': [0.1, 0.0, 0.0, 0.0, 0.0, 0.9, 0.0, 0.0],
  'tán': [0.1, 0.0, 0.0, 0.0, 0.0, 0.9, 0.0, 0.0],
  'tan': [0.1, 0.0, 0.0, 0.0, 0.0, 0.9, 0.0, 0.0],
  'tránh': [0.1, 0.0, 0.0, 0.2, 0.2, 0.8, 0.0, 0.0],
  'tranh': [0.1, 0.0, 0.0, 0.2, 0.2, 0.8, 0.0, 0.0],
  'toàn': [0.0, 0.0, 0.0, 0.0, 0.0, 0.8, 0.0, 0.0],
  'toan': [0.0, 0.0, 0.0, 0.0, 0.0, 0.8, 0.0, 0.0],
  'trường': [0.0, 0.0, 0.0, 0.0, 0.0, 0.6, 0.0, 0.0],
  'truong': [0.0, 0.0, 0.0, 0.0, 0.0, 0.6, 0.0, 0.0],
  'nhà': [0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.0, 0.0],
  'nha': [0.0, 0.0, 0.0, 0.0, 0.0, 0.3, 0.0, 0.0],
  'trạm': [0.0, 0.0, 0.3, 0.0, 0.0, 0.6, 0.0, 0.0],
  'tram': [0.0, 0.0, 0.3, 0.0, 0.0, 0.6, 0.0, 0.0],

  // Alert level (Dim 6)
  'khẩn': [0.3, 0.1, 0.1, 0.2, 0.2, 0.0, 1.0, 0.0],
  'khan': [0.3, 0.1, 0.1, 0.2, 0.2, 0.0, 1.0, 0.0],
  'cấp': [0.3, 0.1, 0.1, 0.2, 0.2, 0.0, 1.0, 0.0],
  'cap': [0.3, 0.1, 0.1, 0.2, 0.2, 0.0, 1.0, 0.0],
  'nguy': [0.2, 0.0, 0.0, 0.2, 0.2, 0.0, 0.9, 0.0],
  'hiểm': [0.2, 0.0, 0.0, 0.2, 0.2, 0.0, 0.9, 0.0],
  'hiem': [0.2, 0.0, 0.0, 0.2, 0.2, 0.0, 0.9, 0.0],
  'báo': [0.0, 0.0, 0.0, 0.1, 0.1, 0.0, 0.7, 0.0],
  'bao': [0.0, 0.0, 0.0, 0.1, 0.1, 0.0, 0.7, 0.0],
  'động': [0.0, 0.0, 0.0, 0.1, 0.1, 0.0, 0.7, 0.0],
  'dong': [0.0, 0.0, 0.0, 0.1, 0.1, 0.0, 0.7, 0.0],
  'chết': [0.5, 0.0, 0.5, 0.0, 0.0, 0.0, 1.0, 0.0],
  'chet': [0.5, 0.0, 0.5, 0.0, 0.0, 0.0, 1.0, 0.0],

  // Age vulnerability (Dim 7)
  'già': [0.0, 0.0, 0.1, 0.0, 0.0, 0.1, 0.0, 0.9],
  'gia': [0.0, 0.0, 0.1, 0.0, 0.0, 0.1, 0.0, 0.9],
  'trẻ': [0.0, 0.1, 0.1, 0.0, 0.0, 0.1, 0.0, 0.8],
  'tre': [0.0, 0.1, 0.1, 0.0, 0.0, 0.1, 0.0, 0.8],
  'bầu': [0.2, 0.0, 0.3, 0.0, 0.0, 0.2, 0.2, 0.9],
  'bau': [0.2, 0.0, 0.3, 0.0, 0.0, 0.2, 0.2, 0.9],
  'sinh': [0.0, 0.1, 0.2, 0.0, 0.0, 0.1, 0.1, 0.9],
  'cụ': [0.0, 0.0, 0.1, 0.0, 0.0, 0.1, 0.0, 0.9],
  'cu': [0.0, 0.0, 0.1, 0.0, 0.0, 0.1, 0.0, 0.9],
  'mẹ': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5],
  'me': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5],
  'con': [0.0, 0.1, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6]
};

// Generates an 8-dimensional dense embedding vector for a given text
function getEmbedding(text) {
  if (!text || typeof text !== 'string') {
    return Array(8).fill(0.0);
  }

  // Tokenize: convert to lowercase and remove punctuation
  const cleanText = text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=_`~()?-]/g, ' ')
    .replace(/\s+/g, ' ');

  const words = cleanText.split(' ').filter(w => w.length > 0);
  const vector = Array(8).fill(0.0);
  let matchCount = 0;

  // Accummulate word vectors
  words.forEach(word => {
    if (EMBEDDINGS_DICT[word]) {
      const wordVector = EMBEDDINGS_DICT[word];
      for (let i = 0; i < 8; i++) {
        vector[i] += wordVector[i];
      }
      matchCount++;
    }
  });

  // Calculate average
  if (matchCount > 0) {
    for (let i = 0; i < 8; i++) {
      vector[i] /= matchCount;
    }
  }

  // Normalise L2 Norm (Euclidean Distance)
  const sumSquared = vector.reduce((sum, val) => sum + val * val, 0);
  const magnitude = Math.sqrt(sumSquared);

  if (magnitude > 0) {
    for (let i = 0; i < 8; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

// Calculate similarity between two normalized vectors (Simple Dot Product)
function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== 8 || vecB.length !== 8) {
    return 0.0;
  }
  
  let dotProduct = 0.0;
  for (let i = 0; i < 8; i++) {
    dotProduct += vecA[i] * vecB[i];
  }
  
  return dotProduct;
}

// Semantic Search over a collection of items
function searchCollection(collection, queryText, extractTextFieldFn) {
  const queryVector = getEmbedding(queryText);
  
  // Calculate similarity for each item
  const results = collection.map(item => {
    // Generate text content if embedding doesn't exist
    let itemVector = item.vector_embedding;
    if (!itemVector || itemVector.length !== 8) {
      const textToEmbed = extractTextFieldFn(item);
      itemVector = getEmbedding(textToEmbed);
    }
    
    const similarity = calculateCosineSimilarity(queryVector, itemVector);
    return {
      ...item,
      vector_embedding: itemVector, // Ensure vector is saved back
      similarity: parseFloat(similarity.toFixed(4))
    };
  });
  
  // Sort by similarity descending
  return results.sort((a, b) => b.similarity - a.similarity);
}

export {
  getEmbedding,
  calculateCosineSimilarity,
  searchCollection
};
