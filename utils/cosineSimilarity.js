// utils/cosineSimilarity.js

// Function to calculate dot product of two vectors
const dotProduct = (vecA, vecB) => {
  let product = 0;
  for (let i = 0; i < vecA.length; i++) {
    product += vecA[i] * vecB[i];
  }
  return product;
};

// Function to calculate magnitude of a vector
const magnitude = (vec) => {
  let sumOfSquares = 0;
  for (let i = 0; i < vec.length; i++) {
    sumOfSquares += vec[i] * vec[i];
  }
  return Math.sqrt(sumOfSquares);
};

// Function to calculate cosine similarity
export const cosineSimilarity = (vecA, vecB) => {
  if (vecA.length !== vecB.length || vecA.length === 0) {
    return 0; // Vectors must have the same dimension and be non-empty
  }
  const product = dotProduct(vecA, vecB);
  const magA = magnitude(vecA);
  const magB = magnitude(vecB);

  if (magA === 0 || magB === 0) {
    return 0; // Cannot divide by zero
  }

  return product / (magA * magB);
}; 