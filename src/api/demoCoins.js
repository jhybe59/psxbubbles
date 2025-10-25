// Local random coin generator for testing (replaces live API during dev)
export async function fetchTopCoins(topN = 40) {
  // Always generate at most 40 local test coins to keep the visualization readable during dev
  const count = Math.min(Math.max(1, topN || 40), 40);
  // Use the provided symbol list (40 items) for testing
  const symbols = [
    'KEL','BML','THCCL','TREET','FFL','LOADS','AIRLINK','FABL','PSX','BAHL','FFC','QUICE','MCB','TPLT','SPEL','UDLI','DSIL','NATF','ECIO','GTYR','FPJM','PICT','ESBL','MERIT','NRSL','CJPL','JSCL','CLOV','KSTM','NICL','EMCO','KTML','ASTM','SHNI','UBDL','AGP','AGTL','WAFI','SGF','BOK'
  ];

  const coins = Array.from({ length: count }).map((_, i) => {
    const symbol = symbols[i % symbols.length];
    const name = symbol + ' Coin';
    // simulate realistic ranges: price, market cap, volume, and +/-24h pct
    return {
      id: `coin${i + 1}`,
      name,
      symbol,
      image: `https://dummyimage.com/64x64/222/fff&text=${symbol}`,
      price: +(Math.random() * 2000 + 0.1).toFixed(2),
      market_cap: Math.floor(Math.random() * 5e9 + 1e7),
      market_cap_rank: i + 1,
      price_change_percentage_24h: +(Math.random() * 40 - 20).toFixed(2), // -20% .. +20%
      volume: Math.floor(Math.random() * 5e7 + 1e4)
    };
  });

  return coins;
}
