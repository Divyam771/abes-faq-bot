# Project Structure

```text
abes-faq-bot/
│
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   │   └── config.py
│   │   ├── repositories/
│   │   │   └── vector_repository.py
│   │   ├── schemas/
│   │   │   └── chat.py
│   │   ├── services/
│   │   │   ├── embedding_service.py
│   │   │   └── generation_service.py
│   │   └── main.py
│   ├── tests/
│   │   └── test_vector_repository.py
│   └── requirements.txt
│
├── data/
│   └── mandatory-disclosure.pdf
│
├── docs/
│   └── PROJECT_STRUCTURE.md
│
├── public/
│   └── assets/
│
├── scripts/
│   ├── loadDb.ts
│   └── testGemini.ts
│
├── .gitignore
├── .env.local
├── README.md
├── package.json
├── package-lock.json
├── next.config.ts
└── tsconfig.json
Test-Path docs\PROJECT_STRUCTURE.md
