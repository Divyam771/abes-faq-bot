import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "langchain/document_loaders/web/puppeteer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { PDFParse } from "pdf-parse";

dotenv.config({ path: ".env.local" });

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  GEMINI_API_KEY,
} = process.env;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// ABES website pages to scrape
const websiteUrls = [
  "https://www.abes.ac.in/",
  "https://www.abes.ac.in/courses-offered.html",
  "https://www.abes.ac.in/contact-us.html",
  "https://www.abes.ac.in/placement.html",
  "https://www.abes.ac.in/life@abes_new.html",
  "https://www.abes.ac.in/fee-structure.php",
];

// Local PDF documents
const localFiles = [
  "data/mandatory-disclosure.pdf",
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1500,
  chunkOverlap: 150,
});

const createCollection = async (similarityMetric: SimilarityMetric = "cosine") => {
  const res = await db.createCollection(ASTRA_DB_COLLECTION!, {
    vector: {
      dimension: 3072,
      metric: similarityMetric,
    },
  });
  console.log(res);
};

const scrapePage = async (url: string) => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: { headless: true },
    gotoOptions: { waitUntil: "domcontentloaded" },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });
  return (await loader.scrape())?.replace(/<[^>]*>/g, "");
};

const readLocalFile = async (filePath: string): Promise<string> => {
  const fullPath = path.join(process.cwd(), filePath);

  if (filePath.endsWith(".pdf")) {
    const buffer = fs.readFileSync(fullPath);
    const parser = new PDFParse({ data: buffer });
    const data = await parser.getText();
    return data.text;
  } else {
    return fs.readFileSync(fullPath, "utf-8");
  }
};

const storeChunks = async (content: string, sourceLabel: string, collection: any) => {
  const chunks = await splitter.splitText(content ?? "");
  for await (const chunk of chunks) {
    const result = await embeddingModel.embedContent(chunk);
    const vector = result.embedding.values;

    const res = await collection.insertOne({
      $vector: vector,
      text: chunk,
      source: sourceLabel,
    });
    console.log(res);
  }
  console.log(`Finished storing chunks from: ${sourceLabel}`);
};

const loadAllData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION!);

  for await (const url of websiteUrls) {
    console.log(`Scraping: ${url}`);
    const content = await scrapePage(url);
    await storeChunks(content ?? "", url, collection);
  }

  for await (const filePath of localFiles) {
    console.log(`Reading: ${filePath}`);
    const content = await readLocalFile(filePath);
    await storeChunks(content, filePath, collection);
  }
};

createCollection()
  .catch(() => console.log("Collection already exists, adding to it."))
  .then(() => loadAllData())
  .then(() => {
    console.log("✅ Done seeding!");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });