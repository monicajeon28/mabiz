#!/usr/bin/env node
/**
 * Apply Schema Fixes - Automated Batch Fix Executor
 *
 * This script automatically applies all schema fixes from schema-fix-mapper.ts
 * to affected files in the codebase, preventing infinite loop errors.
 *
 * Usage:
 *   npx ts-node scripts/apply-schema-fixes.ts
 *   npx ts-node scripts/apply-schema-fixes.ts --dry-run (preview changes)
 *   npx ts-node scripts/apply-schema-fixes.ts --file <filepath> (single file)
 *
 * Generated: 2026-05-26
 */

import * as fs from "fs";
import * as path from "path";
import { globSync } from "glob";

// Import the schema fixes configuration
import {
  SCHEMA_FIXES,
  DECIMAL_FIELDS,
  BATCH_FIX_CONFIG,
  FILE_FIXES,
} from "../src/lib/schema-fix-mapper";

// ============================================================================
// CONFIGURATION
// ============================================================================

const DRY_RUN = process.argv.includes("--dry-run");
const SINGLE_FILE = process.argv.includes("--file")
  ? process.argv[process.argv.indexOf("--file") + 1]
  : null;
const VERBOSE = process.argv.includes("--verbose");

const PROJECT_ROOT = path.resolve(__dirname, "..");

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

function log(message: string, level: "info" | "warn" | "error" | "success" = "info") {
  const colors: Record<string, string> = {
    info: "\x1b[36m",
    warn: "\x1b[33m",
    error: "\x1b[31m",
    success: "\x1b[32m",
  };
  const reset = "\x1b[0m";
  console.log(`${colors[level]}[${level.toUpperCase()}]${reset} ${message}`);
}

function logFile(filePath: string, changes: number) {
  const relative = path.relative(PROJECT_ROOT, filePath);
  if (changes > 0) {
    log(`✓ ${relative} (${changes} changes)`, "success");
  }
}

// ============================================================================
// MAIN FIX ENGINE
// ============================================================================

interface FixResult {
  file: string;
  changes: number;
  replacements: Array<{
    pattern: string;
    oldValue: string;
    newValue: string;
    count: number;
  }>;
}

class SchemaFixEngine {
  private results: FixResult[] = [];
  private filesProcessed = 0;
  private totalChanges = 0;

  /**
   * Apply all fixes to a single file
   */
  private fixFile(filePath: string): FixResult {
    let content = fs.readFileSync(filePath, "utf-8");
    const originalContent = content;
    const replacements: FixResult["replacements"] = [];

    // Apply automatic field replacements
    for (const replacement of BATCH_FIX_CONFIG.autoFieldReplacements) {
      const count = (content.match(replacement.pattern) || []).length;
      if (count > 0) {
        content = content.replace(replacement.pattern, replacement.replacement);
        replacements.push({
          pattern: replacement.pattern.source,
          oldValue: replacement.pattern.source,
          newValue: replacement.replacement,
          count,
        });
      }
    }

    // Check for required imports if any replacements were made
    if (replacements.length > 0) {
      content = this.ensureImports(content, filePath);
    }

    // Write changes if not dry-run
    const changes = replacements.reduce((sum, r) => sum + r.count, 0);
    if (changes > 0 && !DRY_RUN) {
      fs.writeFileSync(filePath, content, "utf-8");
    }

    return {
      file: filePath,
      changes,
      replacements,
    };
  }

  /**
   * Ensure required imports exist in file
   */
  private ensureImports(content: string, filePath: string): string {
    // Check if file already imports from schema-fix-mapper
    if (content.includes("from '@/lib/schema-fix-mapper'")) {
      return content;
    }

    // Check if file needs convertToDecimal import
    if (content.includes("convertToDecimal(")) {
      const importLine = `import { convertToDecimal } from '@/lib/schema-fix-mapper';\n`;

      // Find the last import statement
      const lastImportMatch = content.match(/import .* from ['"].*;?\n/g);
      if (lastImportMatch && lastImportMatch.length > 0) {
        const lastImport = lastImportMatch[lastImportMatch.length - 1];
        const insertPos = content.indexOf(lastImport) + lastImport.length;
        return content.slice(0, insertPos) + importLine + content.slice(insertPos);
      } else {
        // No imports found, add at beginning after any comments
        return importLine + content;
      }
    }

    return content;
  }

  /**
   * Scan files matching patterns
   */
  private scanFiles(): string[] {
    const files: string[] = [];

    if (SINGLE_FILE) {
      return [path.resolve(PROJECT_ROOT, SINGLE_FILE)];
    }

    for (const pattern of BATCH_FIX_CONFIG.filePatternsToScan) {
      const fullPattern = path.join(PROJECT_ROOT, pattern);
      const matched = globSync(fullPattern, {
        ignore: BATCH_FIX_CONFIG.skipDirs.map((dir) =>
          path.join(PROJECT_ROOT, `**/${dir}/**`)
        ),
      });
      files.push(...matched);
    }

    return [...new Set(files)]; // Remove duplicates
  }

  /**
   * Execute all fixes
   */
  async execute(): Promise<void> {
    log("Starting Schema Fix Engine", "info");
    log(`Mode: ${DRY_RUN ? "DRY RUN" : "APPLY FIXES"}`, "info");

    const files = this.scanFiles();
    log(`Found ${files.length} files to scan`, "info");

    for (const file of files) {
      this.filesProcessed++;
      const result = this.fixFile(file);

      if (result.changes > 0) {
        this.results.push(result);
        this.totalChanges += result.changes;
        logFile(file, result.changes);

        if (VERBOSE) {
          result.replacements.forEach((r) => {
            log(
              `  - ${r.pattern} → ${r.newValue} (${r.count}x)`,
              "info"
            );
          });
        }
      }
    }

    this.printSummary();
  }

  /**
   * Print execution summary
   */
  private printSummary(): void {
    const mode = DRY_RUN ? "[DRY RUN]" : "[APPLIED]";
    log(
      `\n${mode} Schema Fix Summary:`,
      DRY_RUN ? "warn" : "success"
    );
    log(`  Files scanned: ${this.filesProcessed}`);
    log(`  Files modified: ${this.results.length}`);
    log(`  Total changes: ${this.totalChanges}`);

    if (this.results.length > 0) {
      log(
        `\nModified files:`,
        DRY_RUN ? "warn" : "success"
      );
      this.results.forEach((result) => {
        const relative = path.relative(PROJECT_ROOT, result.file);
        log(`  ${relative}: ${result.changes} changes`, "info");
      });
    }

    if (DRY_RUN && this.totalChanges > 0) {
      log(
        "\nTo apply these changes, run: npx ts-node scripts/apply-schema-fixes.ts",
        "warn"
      );
    }

    if (this.totalChanges === 0) {
      log("\nNo schema mismatches found! 🎉", "success");
    }
  }
}

// ============================================================================
// VERIFICATION UTILITIES
// ============================================================================

/**
 * Verify all fixes were applied correctly
 */
function verifyFixes(results: FixResult[]): boolean {
  log("\nVerifying fixes...", "info");

  let valid = true;
  for (const result of results) {
    const content = fs.readFileSync(result.file, "utf-8");

    // Check for problematic patterns that should no longer exist
    const problematicPatterns = [
      /\.campaignId\s*\((?!.*channel)/,  // campaignId should be replaced with channel
      /variant\.variantName/,             // Should be copyAngle
      /\.conversionRate\s*\*\s*[^a-zA-Z]/,  // Should be wrapped in convertToDecimal
    ];

    for (const pattern of problematicPatterns) {
      if (pattern.test(content)) {
        log(
          `✗ ${result.file} still has problematic pattern`,
          "error"
        );
        valid = false;
      }
    }
  }

  if (valid) {
    log("✓ All fixes verified", "success");
  }

  return valid;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    const engine = new SchemaFixEngine();
    await engine.execute();

    if (!DRY_RUN) {
      log("\n✓ Schema fixes applied successfully!", "success");
      log("Next steps:", "info");
      log("  1. Review git diff to verify changes", "info");
      log("  2. Run: npm run build", "info");
      log("  3. Run: npm test (if tests exist)", "info");
    }

    process.exit(0);
  } catch (error) {
    log(`Fatal error: ${error}`, "error");
    process.exit(1);
  }
}

main().catch(console.error);
