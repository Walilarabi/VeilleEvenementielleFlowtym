/**
 * CLI Runner for the 20 Section 17 Automated Tests
 */

import { runAll20TariffTests } from '../src/services/__tests__/tariffEngineTestSuite';

async function main() {
  const { passedCount, total, results } = await runAll20TariffTests();
  console.log(`\n=== FLOWTYM REVENUE — RECETTE AUTOMATISÉE (${passedCount}/${total}) ===\n`);
  for (const r of results) {
    const tag = r.passed ? 'PASS' : 'FAIL';
    console.log(`[${tag}] Test ${String(r.id).padStart(2, '0')} — ${r.name}${r.passed ? '' : ` :: ${r.details}`}`);
  }
  console.log('');
  if (passedCount !== total) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
