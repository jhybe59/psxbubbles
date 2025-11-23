# 📊 CURRENT SYMBOLS COHORT REPORT

Generated: $(date)

## 1️⃣ TOTAL SYMBOLS

**Total Symbols**: 75
**Symbols Per Minute**: 20
**Total Cohorts**: 4
**Current Minute of Day**: 985 (16:25)
**Market Hours**: 572 (09:32) - 930 (15:30)
**Market Status**: ⏰ CLOSED

## 2️⃣ CURRENT COHORT SYMBOLS

**Status**: ⏰ Market closed (closed at minute 930)

**If market was open, Cohort Index 1 would be active (20 symbols):**

1. GATM
2. QUICE
3. SSGC
4. DGKC
5. FFC
6. PPL
7. POWER
8. SEARL
9. ATRL
10. FFL
11. SLGL
12. CEPB
13. SNGP
14. DCL
15. UNITY
16. ASL
17. MUGHAL
18. FCL
19. TGL
20. MACFL

**Note**: Worker will process this cohort during next market hours (09:32 tomorrow)

## 3️⃣ MISSING/SKIPPED SYMBOLS

**Status**: ℹ️ Market is closed - Cannot check missing/skipped symbols

**To check missing symbols during market hours, run:**
```bash
docker exec my-cryptobubbles-worker-1 node workers/ingestion/get-cohort.mjs
```

**Expected during market hours:**
- Missing symbols will be shown if not in `instruments` table
- Skipped symbols will be shown if inactive in `instruments` table

## 📋 ALL 75 SYMBOLS

1. PIBTL, 2. BECO, 3. MLCF, 4. LOTCHEM, 5. KEL
6. TELE, 7. PRL, 8. CNERGY, 9. GCIL, 10. PAEL
11. BNL, 12. TREET, 13. PIOC, 14. TPLP, 15. BFAGRO
16. TOMCL, 17. FCCL, 18. OBOY, 19. WASL, 20. EPCL
21. GATM, 22. QUICE, 23. SSGC, 24. DGKC, 25. FFC
26. PPL, 27. POWER, 28. SEARL, 29. ATRL, 30. FFL
31. SLGL, 32. CEPB, 33. SNGP, 34. DCL, 35. UNITY
36. ASL, 37. MUGHAL, 38. FCL, 39. TGL, 40. MACFL
41. CRTM, 42. GWLC, 43. HUBC, 44. MEBL, 45. OGDC
46. EMCO, 47. FATIMA, 48. IMAGE, 49. SYS, 50. CPHL
51. BGL, 52. CTM, 53. BIPL, 54. AVN, 55. JVDC
56. TRSM, 57. MARI, 58. NETSOL, 59. YOUW, 60. SYM
61. BFMOD, 62. GHGL, 63. OCTOPUS, 64. BBFL, 65. GAL
66. BIFO, 67. GHNI, 68. SAZEW, 69. FLYNG, 70. ISL
71. GGL, 72. GGGL, 73. GCIL, 74. GCWL, 75. IBLHL

## 📊 SUMMARY

| Item | Status | Details |
|------|--------|---------|
| **Total Symbols** | ✅ | 75 symbols configured |
| **Cohort System** | ✅ | 4 cohorts, 20 symbols each |
| **Current Cohort** | ⏰ | Index 1 (if market open) |
| **Market Status** | ⏰ | CLOSED (will open at 09:32 tomorrow) |
| **Symbols Missing** | ℹ️ | Check during market hours |
| **Symbols Skipped** | ℹ️ | Check during market hours |

## 🔧 NEXT STEPS

1. **Wait for market hours** (09:32 tomorrow)
2. **Run cohort check** during market hours to see missing/skipped symbols
3. **Verify data insertion** once market opens

**To check during market hours:**
```bash
docker exec my-cryptobubbles-worker-1 node workers/ingestion/get-cohort.mjs
```

