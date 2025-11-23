/**
 * Check which symbols from current cohort are missing in instruments table
 */

import { withClient } from './timescale.mjs';
import { config } from './config.mjs';

// Current cohort symbols (corrected list)
const currentCohortSymbols = [
  'GATM', 'QUICE', 'SSGC', 'DGKC', 'FFC', 'PPL', 'POWER', 'SEARL', 'ATRL', 'FFL',
  'SLGL', 'CEPB', 'SNGP', 'DCL', 'UNITY', 'ASL', 'MUGHAL', 'FCL', 'TGL', 'MACFL'
];

const checkMissingSymbols = async () => {
  try {
    const result = await withClient(async (client) => {
      // Check which symbols exist in instruments table
      const query = `
        SELECT symbol 
        FROM instruments 
        WHERE symbol = ANY($1::text[])
      `;
      
      const existingResult = await client.query(query, [currentCohortSymbols]);
      const existingSymbols = existingResult.rows.map(row => row.symbol);
      
      // Find missing symbols
      const missingSymbols = currentCohortSymbols.filter(
        symbol => !existingSymbols.includes(symbol)
      );
      
      return {
        total: currentCohortSymbols.length,
        existing: existingSymbols.length,
        missing: missingSymbols,
        existingSymbols: existingSymbols
      };
    });

    console.log('\n' + '='.repeat(60));
    console.log('MISSING SYMBOLS CHECK');
    console.log('='.repeat(60) + '\n');
    
    console.log(`Total symbols in cohort: ${result.total}`);
    console.log(`Existing in instruments: ${result.existing}`);
    console.log(`Missing: ${result.missing.length}\n`);

    if (result.missing.length > 0) {
      console.log('❌ MISSING SYMBOLS:');
      result.missing.forEach((symbol, index) => {
        console.log(`   ${index + 1}. ${symbol}`);
      });
      console.log('\n📋 Missing symbols list:');
      console.log(result.missing.join(', '));
    } else {
      console.log('✅ All symbols exist in instruments table!');
    }

    if (result.existing > 0) {
      console.log('\n✅ Existing symbols:');
      result.existingSymbols.forEach((symbol, index) => {
        console.log(`   ${index + 1}. ${symbol}`);
      });
    }

    console.log('\n' + '='.repeat(60) + '\n');

    return result;

  } catch (err) {
    console.error('Error checking symbols:', err.message);
    throw err;
  }
};

// Allow script to run even if some config vars are missing
process.env.PSX_API_TOKEN = process.env.PSX_API_TOKEN || '';
process.env.PSX_API_BATCH_SIZE = process.env.PSX_API_BATCH_SIZE || '80';

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  checkMissingSymbols()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed:', err);
      process.exit(1);
    });
}

export default checkMissingSymbols;

