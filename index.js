import { runTests } from './tests.js';
import { runEvals } from './evals.js';
import { loadConfigFile } from './common/common.js';

const RUN_MODE = {
  TEST: 'test',
  EVAL: 'eval',
  FULL: 'full',
};

(async () => {
  const mode = process.argv[2] ?? RUN_MODE.TEST;
  const configFilePath = process.argv[3] ?? process.env.TEST_CONFIG;

  if (!configFilePath) {
    console.error('Config file path was missing, either provide it as environment variables or via the command arguments. See docs for help.');
    return -1;
  }

  const testConfig = loadConfigFile(configFilePath);

  console.log(`🥋 Started in ${mode} mode`);
  switch (mode) {
    case RUN_MODE.TEST:
      await runTests(testConfig);
      break;

    case RUN_MODE.EVAL:
      await runEvals(testConfig);
      break;
  
    default:
    case RUN_MODE.FULL:
      await runTests(testConfig);
      await runEvals(testConfig);
      break;
  }
  return 0;

})();