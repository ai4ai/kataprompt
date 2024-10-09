import { createModel, getOutputPathname, loadVariable, loadVars, measureResponse, saveResultsToCSV, toSafeFilename, writeResult } from './common/common.js';
// import testConfig from './inputs/config-quick.json' with { type: 'json' };
import { PromptTemplate } from "@langchain/core/prompts";

export const runTests = async (testConfig) => {
    const latencies = [];
    const stepResults = [];
    const finalResults = [];

    console.log(`🧪 Running test ${testConfig.config.name}`);
    // for each step in the array load all variables and model and prepare for running a test
    for (const input of testConfig.config.input) {
        console.log(`📄 Processing input ${input.name}`);

        let lastStepResult = {
            inputName: input.name,
            configName: testConfig.config.name,
            latency: 0,
            response: '',
            shortModelName: '',
            modelParams: '',
            step: 0,
            stepName: '',
        };
        // load all variables, config and the model and execute each step
        for (const step of testConfig.config.steps) {
            console.log(`⏳ Executing step '${step.name}' for input '${input.name}'`);

            // create the model using the params
            const model = createModel(step.modelConfig.modelId, step.modelConfig.parameters);

            // load the prompt content
            const stepPrompt = loadVariable(step.input.prompt);

            // prepare the prompt
            const promptTemplate = PromptTemplate.fromTemplate(stepPrompt);

            // prepare step & additional variables
            let stepVars = {
                // load initial input (if any)
                ...loadVars(input.vars),
                // load step variables
                ...loadVars(step.input.vars, lastStepResult)
            };

            // add any required output variables from the last step 
            // if (step.step > 1) {
            //     stepVars = {
            //         ...stepVars,
            //         // ...Object.fromEntries(step.output.map(populateOutputVariable(lastStepResult)))
            //         ...loadOutputVars(step.output, lastStepResult)
            //     };
            // }
            // TODO: implement pre-processors
            for (const prepro of (step.preprocessors ?? [])) {
                // do some pre-processing (eg. chunking, cleanup, normalization)
            }

            // format prompt with vars
            const stepFinalPrompt = await promptTemplate.format(stepVars);

            // console.log('stepFinalPrompt', stepFinalPrompt);
            // execute
            const currentStepResult = await measureResponse(model, stepFinalPrompt);

            // postprocess according to output format
            const safeModelName = toSafeFilename(step.modelConfig.modelId);
            const safeInputName = toSafeFilename(input.name);

            // capture response to file
            writeResult(getOutputPathname(`${safeModelName}-${safeInputName}-${step.name}-response.txt`, testConfig.config.name), lastStepResult.response);

            // update last result
            lastStepResult = {
                ...lastStepResult,
                shortModelName: safeModelName,
                modelParams: JSON.stringify(step.modelConfig.parameters),
                step: step.step,
                stepName: step.name,
                response: currentStepResult.response,
                latency: currentStepResult.latency,
            };
            // capture result
            stepResults.push(lastStepResult);
        }

        // after running all steps summarize the run steps results into one final results row
        const fullResult = stepResults.reduce((acc, sr, idx) => {
            acc = {
                ...acc,
                [(`step${sr.step}ModelName`)]: sr.shortModelName,
                [(`step${sr.step}ModelParams`)]: sr.modelParams,
                [(`step${sr.step}Latency`)]: (sr.latency / 1000).toFixed(2),
                [(`step${sr.step}Response`)]: sr.response,
                totalTimeToResponse: (acc.totalTimeToResponse ?? 0) + (sr.latency / 1000),
            };
            return acc;
        }, {
            inputName: input.name,
            configName: testConfig.config.name,
        });
        finalResults.push(fullResult);

    }

    // Save results to spreadsheet
    saveResultsToCSV(getOutputPathname(`${testConfig.config.name}-results.csv`, testConfig.config.name), testConfig.config.name, finalResults);

    console.log(`🎉 Completed running test ${testConfig.config.name}`);
}

