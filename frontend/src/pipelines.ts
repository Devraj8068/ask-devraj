export const CHAT_PIPELINE = [
  { id: 'planner', label: 'Planner', hint: 'Classifies the question and writes search queries' },
  { id: 'retriever', label: 'Retriever', hint: 'Hybrid BM25 + FAISS search over the knowledge base' },
  { id: 'answerer', label: 'Answerer', hint: 'Writes a grounded answer with citations' },
  { id: 'validator', label: 'Validator', hint: 'Fact-checks every claim against the sources' },
]

export const FIT_PIPELINE = [
  { id: 'extractor', label: 'Requirement extractor', hint: 'Pulls concrete requirements from the JD' },
  { id: 'retriever', label: 'Retriever', hint: 'Finds evidence for each requirement' },
  { id: 'assessor', label: 'Assessor', hint: 'Rates match / partial / gap with citations' },
  { id: 'validator', label: 'Validator', hint: 'Downgrades any claim the evidence does not support' },
]
