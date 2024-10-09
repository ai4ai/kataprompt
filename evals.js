import { loadVarsFromFiles } from "./common/common.js";

export const runEvals = async (evalsConfig) => {
    try {
        const _evals = await loadVarsFromFiles('./evals/');
        // console.debug('Loaded eval modules', _evals);

        if (!evalsConfig.config.evals.length) {
            console.log('No evals found in config');
            return 0;
        }
        for (const evalConfig of (evalsConfig.config.evals)) {
            const foundEvalModule = _evals[evalConfig.name];
            if (foundEvalModule) {
                console.log(`🔬 Running eval '${evalConfig.name}'`);
                await foundEvalModule.action(evalConfig);
                console.log(`🎉 Completed running eval '${evalConfig.name}'`);
            } else {
                console.log(`Eval config error: Unknown eval type '${evalConfig.type}', skipped.`);
            }
        }
    } catch (error) {
        console.error(`Error while running evals: ${error.message}`, error);
    }
};
