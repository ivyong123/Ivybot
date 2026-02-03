import { createAdminClient } from '@/lib/supabase/admin';
import { generateEmbedding } from './embeddings';
import { DocumentChunk, RAGContext } from '@/types/ai';

// Search the stock knowledge base
export async function searchDocuments(
  query: string,
  limit: number = 5,
  filter?: Record<string, unknown>
): Promise<DocumentChunk[]> {
  const supabase = createAdminClient();

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Call the vector search function
  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: limit,
    filter: filter || null,
  });

  if (error) {
    console.error('Document search error:', error);
    throw new Error(`Failed to search documents: ${error.message}`);
  }

  return (data || []).map((doc: { id: number; content: string; metadata: Record<string, unknown>; similarity: number }) => ({
    id: doc.id,
    content: doc.content,
    metadata: doc.metadata,
    similarity: doc.similarity,
  }));
}

// Search the forex knowledge base
export async function searchForexKB(
  query: string,
  limit: number = 5,
  filter?: Record<string, unknown>
): Promise<DocumentChunk[]> {
  const supabase = createAdminClient();

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Call the vector search function
  const { data, error } = await supabase.rpc('match_forex_kb', {
    query_embedding: queryEmbedding,
    match_count: limit,
    filter: filter || null,
  });

  if (error) {
    console.error('Forex KB search error:', error);
    throw new Error(`Failed to search forex KB: ${error.message}`);
  }

  return (data || []).map((doc: { id: number; content: string; metadata: Record<string, unknown>; similarity: number }) => ({
    id: doc.id,
    content: doc.content,
    metadata: doc.metadata,
    similarity: doc.similarity,
  }));
}

// Unified search across knowledge bases
export async function searchKnowledgeBase(
  query: string,
  kbType: 'stock' | 'forex' = 'stock',
  limit: number = 5
): Promise<RAGContext> {
  const chunks = kbType === 'forex'
    ? await searchForexKB(query, limit)
    : await searchDocuments(query, limit);

  // Estimate token count (rough approximation)
  const totalTokens = chunks.reduce((sum, chunk) => {
    return sum + Math.ceil(chunk.content.length / 4);
  }, 0);

  return {
    query,
    chunks,
    total_tokens: totalTokens,
  };
}

// Get context string for injection into prompts
export function formatContextForPrompt(context: RAGContext): string {
  if (context.chunks.length === 0) {
    return 'No relevant knowledge base content found.';
  }

  const formattedChunks = context.chunks.map((chunk, i) => {
    const source = chunk.metadata?.source || 'Unknown source';
    const title = chunk.metadata?.title || '';
    return `### Source ${i + 1}: ${title} (${source})
Relevance: ${(chunk.similarity * 100).toFixed(1)}%

${chunk.content}`;
  });

  return `## Relevant Knowledge Base Content

${formattedChunks.join('\n\n---\n\n')}`;
}
