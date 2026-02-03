// Re-export RAG functions
export { generateEmbedding, generateEmbeddings, cosineSimilarity, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from './embeddings';
export { searchDocuments, searchForexKB, searchKnowledgeBase, formatContextForPrompt } from './search';
