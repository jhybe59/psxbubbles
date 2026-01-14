
import { volatilityService } from './server/api/services/volatility-service.mjs';
import { queryQuestDB } from './server/api/services/questdb-service.mjs';

// Mock mapQuestDBResults since we can't import it easily (it's not exported or is internal to a service file in some project structures, but usually it is in questdb-service. If not, we reproduce it).
// Actually, looking at imports in volatility-service, it likely imports it.
// Let's assume we can run this script with the server environment.

const main = async () => {
    try {
        console.log("Checking Lead Metrics for OBOY...");

        // Calculate dayStart (04:00 UTC today)
        const now = new Date();
        const dayStartDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 4, 0, 0, 0));
        const dayStartIso = dayStartDate.toISOString();

        console.log(`Day Start: ${dayStartIso}`);

        const result = await volatilityService.getLeadIndicatorMetrics(['OBOY', 'PAEL', 'TRG'], dayStartIso);

        console.log("\nResults:");
        if (result.size === 0) {
            console.log("Empty Map returned!");
        } else {
            for (const [sym, metrics] of result.entries()) {
                console.log(`Symbol: ${sym}`);
                console.log(metrics);
            }
        }
    } catch (err) {
        console.error("Test Error:", err);
    }
    process.exit(0);
};

main();
