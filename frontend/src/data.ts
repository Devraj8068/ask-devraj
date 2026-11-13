// Static site content. Mirrors the resume; the agent's knowledge base lives in backend/knowledge.

export const profile = {
  name: 'Devraj Gaikwad',
  title: 'AI Software Engineer',
  location: 'Pune, India',
  tagline: 'I build production LLM, RAG and multi-agent systems, and the backend and DevOps that ship them.',
  email: 'Devrajgaikwad79@gmail.com',
  linkedin: 'https://www.linkedin.com/in/devraj-gaikwad-91ab21264/',
  github: 'https://github.com/Devraj8068',
  resume: '/Devraj_Gaikwad_Resume.pdf',
  openTo: 'Open to GenAI · AI Engineer · ML roles',
}

export const metrics = [
  { value: 68, prefix: '+', suffix: '%', label: 'contextual accuracy', note: 'multi-agent RAG' },
  { value: 45, prefix: '−', suffix: '%', label: 'hallucinations', note: 'validation agent' },
  { value: 600, prefix: '', suffix: '+', label: 'clients served', note: 'compliance platform' },
  { value: 99.9, prefix: '', suffix: '%', label: 'uptime', note: 'CI/CD on AWS EC2' },
]

export type Job = {
  role: string
  org: string
  period: string
  meta: string
  points: string[]
  tags: string[]
}

export const experience: Job[] = [
  {
    role: 'AI Software Engineer',
    org: 'Applied AI Consulting (AAIC)',
    period: 'Sep 2025 — Present',
    meta: 'Full-time · Pune',
    points: [
      'Designed role-based agents (Planning, Retrieval, Analysis, Validation) on RAG pipelines (FAISS / vector DB): **+68%** contextual accuracy, **−45%** hallucinations.',
      'Built a role-based agentic AI compliance platform for **600+ clients** (React, FastAPI, MongoDB, OneDrive): **−70%** manual work, **90%+** extraction accuracy, **40%+** faster turnaround.',
      'Built Docker + GitHub Actions CI/CD for zero-downtime AWS EC2 deploys: **99.9%** uptime, **40%** faster releases.',
      'Built n8n workflows that catch broken pipe errors **within seconds** and email alerts with Grafana snapshots.',
      'Worked on OpsRabbit, an AI operations platform for incident investigation.',
    ],
    tags: ['LangGraph', 'RAG', 'FAISS', 'FastAPI', 'React', 'MongoDB', 'Docker', 'AWS', 'n8n'],
  },
  {
    role: 'Data Scientist',
    org: 'Eternity AI Endeavors (EAIEPL)',
    period: 'Aug 2024 — Sep 2025',
    meta: 'Full-time · Remote',
    points: [
      'Developed an agentic virtual try-on app (hairstyles, outfits, sunglasses, makeup) with Gemini 2.5 Flash: **95%** accurate try-ons with correct masking and preserved facial features.',
      'Built a semi-automated answer-sheet re-evaluation system with YOLO, CNNs and LLMs: **92%** detection accuracy, **−40%** manual grading effort.',
    ],
    tags: ['Gemini', 'YOLO', 'CNN', 'OCR', 'LLMs', 'Computer Vision'],
  },
]

export const education = {
  degree: 'B.E. Mechanical Engineering',
  school: 'Sinhgad College of Engineering, Savitribai Phule Pune University',
  period: 'Graduated Mar 2022',
  detail: 'CGPA 7.74',
}

export type Project = {
  name: string
  blurb: string
  stack: string[]
  link?: string
  highlight?: string
}

export const projects: Project[] = [
  {
    name: 'Ask Devraj',
    blurb: "This site's agent. A LangGraph pipeline (Planner → Retriever → Answerer → Validator) over hybrid BM25 + FAISS retrieval, with a live trace and a job-fit checker.",
    stack: ['LangGraph', 'FastAPI', 'FAISS', 'Groq · gpt-oss', 'React'],
    highlight: 'You are using it',
  },
  {
    name: 'LegisAI',
    blurb: 'Court-hearing prep assistant for Indian lawyers: case summary, arguments, cross-examination questions and IPC/CrPC sections, exported as a Word report.',
    stack: ['Gemini 1.5 Flash', 'Streamlit', 'python-docx'],
    link: 'https://github.com/Devraj8068/LegisAI-Court-Hearing-AI-Powered-Preparation-Tool',
    highlight: '−60% drafting time',
  },
  {
    name: 'AgentLive',
    blurb: 'An AI agent drives a real Chromium browser to research a task while you watch it live, then exports a PDF/Markdown report.',
    stack: ['LangChain', 'Playwright', 'FastAPI', 'WebSockets', 'Next.js'],
    link: 'https://github.com/Devraj8068/AgentLive',
    highlight: '11 browser tools',
  },
  {
    name: 'RAG-Bot',
    blurb: 'Multilingual, voice-enabled RAG chatbot grounded in company knowledge to prevent hallucinated answers.',
    stack: ['Mistral 7B', 'LangChain', 'FAISS', 'Flask', 'TTS'],
    link: 'https://github.com/Devraj8068/RAG-Bot-AI-Powered-Multilingual-Chatbot',
    highlight: 'Voice + multilingual',
  },
]

export const skills: { group: string; items: string[] }[] = [
  { group: 'GenAI & Agents', items: ['LangChain', 'LangGraph', 'LangFuse', 'RAG', 'LLMs', 'Multi-Agent Systems', 'Agentic AI', 'Gemini'] },
  { group: 'ML & Computer Vision', items: ['Machine Learning', 'YOLO', 'CNN', 'OCR', 'EDA', 'Data Preprocessing'] },
  { group: 'Backend & DevOps', items: ['FastAPI', 'React', 'MongoDB', 'FAISS', 'Docker', 'GitHub Actions', 'Grafana'] },
  { group: 'Cloud (AWS)', items: ['Lex', 'Lambda', 'SageMaker', 'Rekognition', 'Textract', 'DynamoDB', 'S3', 'EC2'] },
  { group: 'Languages', items: ['Python', 'Oracle SQL', 'PL/SQL'] },
  { group: 'Tools', items: ['n8n', 'SimAI', 'OpenClaw', 'Jupyter', 'Colab', 'VS Code'] },
]

export const certifications = [
  'Introduction to Amazon SageMaker — AWS',
  'Introduction to LangGraph — LangChain Academy',
  'Introduction to LangChain (Python) — LangChain Academy',
  'Docker: From Beginner to Expert — Udemy',
]

export const suggestedQuestions = [
  'What has he built with multi-agent RAG?',
  'Does he have AWS experience?',
  'Tell me about his computer vision work',
  'How does this agent work?',
  'What roles is he looking for?',
]

export const sampleJD = `Generative AI Engineer — 2-4 years

We're hiring an engineer to build LLM-powered products.

Requirements:
- 2+ years building applications with LLMs (OpenAI, Gemini, Llama)
- Hands-on experience with RAG pipelines and vector databases (FAISS, Pinecone)
- Agent frameworks such as LangChain or LangGraph
- Strong Python and FastAPI for production APIs
- Docker and CI/CD; deploying on AWS
- Experience evaluating and reducing hallucinations

Nice to have:
- Kubernetes
- Computer vision experience
- Fine-tuning open-source models`
