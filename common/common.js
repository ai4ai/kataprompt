import dotenv from 'dotenv';
import { setGlobalDispatcher, Agent } from 'undici';
import { WatsonxAI } from '@langchain/community/llms/watsonx_ai';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { stringify } from 'csv-stringify';
import { DEFAULT_TIMEOUT } from './config.js';
import yaml from 'js-yaml';

// load env vars
dotenv.config();

setGlobalDispatcher(new Agent({ headersTimeout: DEFAULT_TIMEOUT, connectTimeout: DEFAULT_TIMEOUT, keepAliveTimeout: DEFAULT_TIMEOUT }));

// create an LLM instance with a specified model id
export function createModel(modelName, modelParameters) {

  return new WatsonxAI({
    ibmCloudApiKey: process.env.WATSON_API_KEY,
    projectId: process.env.WATSON_PROJECT_ID,
    modelId: modelName,
    modelParameters,
    maxConcurrency: 6,   // this doesn't seem to work
  });
}

// load contextual text from a file
export function loadContextualText(docName) {
  const docPath = path.join(process.cwd(), 'docs', docName);
  try {
    const text = fs.readFileSync(docPath, 'utf8');
    return text;
  } catch (error) {
    console.error(`Error loading document "${docName}":`, error);
    return '';
  }
}

export function loadTextFile(filePath) {
  const docPath = path.join(process.cwd(), 'inputs', filePath);
  try {
    const text = fs.readFileSync(docPath, 'utf8');
    return text;
  } catch (error) {
    console.error(`Error loading document "${filePath}":`, error);
    return '';
  }
}

// Function to save results to a CSV file
export function saveResultsToCSV(filePath, testName, results) {
  const writableStream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' });

  // const columns = {
  //   modelName: 'Model ID',
  //   docName: 'Document Name',
  //   testName,
  //   // context: 'Document Markdown',
  //   // contextLength: 'Document length',
  //   responseLengthStep1: 'Response Length Step 1',
  //   responseLengthStep2: 'Response Length Step 2',
  //   responseStep1: 'Response Step 1',
  //   responseStep2: 'Response Step 2',
  //   timeToResponseSecStep1: 'TTR Step 1',
  //   timeToResponseSecStep2: 'TTR Step 2',
  //   totalTimeToResponse: 'Total time to response',
  //   promptTemplateSysStep1: 'Prompt Step 1 System',
  //   promptTemplateUserStep1: 'Prompt Step 1 User',
  //   promptTemplateSysStep2: 'Prompt Step 2 System',
  //   promptTemplateUserStep2: 'Prompt Step 2 User',
  // };

  // const columns = [
  //   'Model ID', 
  //   'Document Name', 
  //   'Document Markdown',
  //   'Document length',
  //   'Response Length Step 1',
  //   'Response Length Step 2',
  //   'Response Step 1',
  //   'Response Step 2',
  //   'TTR Step 1',
  //   'TTR Step 2',
  // ];

  // if (!fs.existsSync(filePath)) {
  //   stringify([columns], { header: true, columns }).pipe(writableStream);
  // }

  stringify(results, { header: true, /*columns,*/ objectMode: true, encoding: 'utf-8', quote: true, quoted_string: true, escape_formulas: true }).pipe(writableStream);
}

export function writeResult(filePath, content) {
  const writableStream = fs.createWriteStream(filePath, { flags: 'w', encoding: 'utf8' });
  writableStream.write(content);
  if (!writableStream.closed)
    writableStream.close();
}


export function getOutputPathname(filename, outDir = '') {
  const subDir = process.env.TEST_NAME ? outDir + '/' + process.env.TEST_NAME : outDir;
  const outputDir = path.join(process.cwd(), 'outputs/' + subDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  const filePath = path.join(outputDir, filename);
  return filePath;
}

// measure latency for a single prompt
export async function measureResponse(model, prompt) {
  const start = performance.now();

  const response = await model.invoke(prompt,
    {
      timeout: DEFAULT_TIMEOUT,    // possibly deprecated in WatsonxAI module
    });

  const end = performance.now();
  const latency = end - start;

  return { latency, response };
}

// load all json/js files from current dir into variables with a key based on the base filename without extension
export const loadVarsFromFiles = async (dir = './', extension = '.js') => {
  const data = {};
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    if (file.isFile() && file.name.endsWith(extension)) {
      const fileName = path.basename(file.name, extension);
      const modulePath = path.join(process.cwd(), dir, file.name);
      // console.debug(`loading module '${fileName} from ${modulePath}`);
      const jsonData = await import(modulePath);
      data[fileName] = { ...(jsonData.default ? jsonData.default : jsonData) };
    }    
  }
  return data;
}

export const loadVariable = (v, lastOutput = null) => {
  switch (v.type) {
    default:
    case 'string':
      return v.value;
    case 'textfile':
      return loadTextFile(v.value);
    case 'output_variable':
      return lastOutput[v.value];
  }
};

export const loadVars = (vars, lastOutput) => Object.fromEntries(vars.map(v => [v.name, loadVariable(v, lastOutput)]));

// const loadOutputVars = (vars, lastStepResult) => Object.fromEntries(vars.map(v => [v.name, populateOutputVariable(v, lastStepResult)]));

export const toSafeFilename = (name) => {
  return name.replace('/', '-');
};

export const populateOutputVariable = (outputVar, lastStepResult) => {
  switch (outputVar.type) {
    default:
    case 'output_variable':
      return lastStepResult[outputVar.fromField];
  }
};

export const loadConfigFile = (configFilePath) => {
  try {
    const relativeConfigPath = path.join(process.cwd(), configFilePath);
    if (!fs.existsSync(relativeConfigPath)) {
      throw new Error(`Config file was not found at ${configFilePath}`);
    } else {
      const configContents = yaml.load(fs.readFileSync(relativeConfigPath, 'utf8'));
      return configContents;
    }

  } catch (error) {
    throw Error(`Error loading file ${configFilePath}`, error);
  }
}