#!/usr/bin/env node

/**
 * Load 275 Q&A items into BotGuideAnswer table via API
 */
const loadQaData = async () => {
  try {
    console.log("🚀 Loading 275 Q&A items...");

    const response = await fetch("http://localhost:3000/api/tools/bot-guide-answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "upsert",
        confirm: true,
        // data will be loaded from default JSON file if not provided
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    console.log("✅ Q&A data loaded successfully!");
    console.log(`   Succeeded: ${result.succeeded}/${result.total}`);
    if (result.failed > 0) {
      console.log(`   Failed: ${result.failed}`);
    }
    console.log(`\n📚 Q&A Library ready at http://localhost:3000/tools`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to load Q&A data:", error);
    process.exit(1);
  }
};

// Wait for API to be ready (retry with backoff)
const waitForApi = async (maxRetries = 30) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch("http://localhost:3000/api/tools/bot-guide-answers");
      if (res.ok) {
        console.log("✅ API is ready!");
        return true;
      }
    } catch {
      // Not ready yet
    }
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      process.stdout.write(".");
    }
  }
  throw new Error("API did not respond in time");
};

const main = async () => {
  console.log("⏳ Waiting for API to be ready...");
  await waitForApi();
  await loadQaData();
};

main();
