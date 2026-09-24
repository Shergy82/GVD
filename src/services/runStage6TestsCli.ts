import { runStage6AcceptanceTests } from './stage6AcceptanceTests';

async function main() {
  console.log('Starting Stage 6 Acceptance Test Suite (Tests A - S)...');
  const results = await runStage6AcceptanceTests((res) => {
    const symbol = res.status === 'passed' ? '✓' : '✗';
    console.log(`[${symbol}] Test ${res.id}: ${res.name} (${res.durationMs.toFixed(1)}ms)`);
  });

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;

  console.log('\n=======================================');
  console.log(`Stage 6 Results: ${passed}/${results.length} PASSED, ${failed} FAILED`);
  console.log('=======================================');

  if (failed > 0) {
    results.filter(r => r.status === 'failed').forEach(f => {
      console.error(`FAILED: Test ${f.id} - ${f.name}`);
      console.error(`Details: ${f.error}`);
    });
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
