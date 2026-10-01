# ABES Engineering College FAQ Chatbot

A Retrieval-Augmented Generation (RAG) chatbot for answering frequently asked questions about ABES Engineering College.

## Overview

This project combines a Next.js frontend, FastAPI backend, Astra DB vector search, and Google Gemini to provide answers from ABES source documents.

The application follows this flow:

```text
User
  ↓
Next.js Chat Interface
  ↓
Next.js /api/chat
  ↓
FastAPI Backend
  ↓
Gemini Embedding
  ↓
Astra DB Vector Search
  ↓
Relevant Document Chunks
  ↓
Gemini Generation
  ↓
Answer
