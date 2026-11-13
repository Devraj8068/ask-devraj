# Projects
url: #projects

## LegisAI: court hearing preparation tool
LegisAI is a personal project Devraj has been building since October 2024: a generative AI legal assistant web app for Indian lawyers that automates case analysis and courtroom preparation. A lawyer enters the case facts, key evidence and the side they represent. LegisAI then drafts a case summary, legal arguments, likely legal questions, witness and evidence strategy, examination and cross-examination questions, counter-questions from the opponent, similar cases to research and applicable IPC/CrPC sections, and exports everything as a Word report. It uses Python, Streamlit and Google Gemini 1.5 Flash, and cut hearing-prep drafting time by about 60% in testing. Code: github.com/Devraj8068/LegisAI-Court-Hearing-AI-Powered-Preparation-Tool

## RAG-Bot: multilingual voice RAG chatbot
RAG-Bot is a multilingual, voice-enabled RAG chatbot grounded in company knowledge to prevent hallucinated answers. It uses Mistral 7B Instruct with LangChain, All-MiniLM sentence-transformer embeddings and a FAISS index, served by a Flask backend, plus a translation and text-to-speech bridge for voice input and output. Code: github.com/Devraj8068/RAG-Bot-AI-Powered-Multilingual-Chatbot

## AgentLive: live browser research agent
AgentLive is a browser automation and live web research workspace. You give it a research task in plain English and an AI agent drives a real Chromium browser (Playwright) to complete it, while the browser is streamed live to a Next.js UI over WebSockets. The backend is FastAPI with a LangChain tool-calling agent that has 11 browser tools (search, navigate, click, fill inputs, read pages, list links, screenshots). It also has an activity timeline, vision-based CAPTCHA handling and PDF/Markdown report export. Code: github.com/Devraj8068/AgentLive

## Ask Devraj: this portfolio agent
This site's assistant is itself one of Devraj's projects: a LangGraph agent with Planner, Retriever, Answerer and Validator steps. It uses hybrid retrieval (BM25 plus FAISS vector search) over his resume and project notes, runs on open-weight gpt-oss models hosted on Groq behind a FastAPI backend, and has a React frontend that shows the agent's trace live.
