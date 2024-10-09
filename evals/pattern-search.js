import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import csvParser from 'csv-parser';

const DEFAULT_NAME = "pattern-search";

// searches for a text pattern in a file
async function searchPatternInFile(filePath, pattern) {
    try {
        const data = await fs.readFile(filePath, { encoding: 'utf8' });

        let matchFound = false;
        const regex = new RegExp(pattern, 'gi'); // Create regex for global search
        let match;
        let lineNumber = 1;
        let positions = [];

        // Split file content into lines
        const lines = data.split('\n');

        // Loop through each line and search for the pattern
        for (let line of lines) {
            match = regex.exec(line);

            // If a match is found, store the position
            while (match) {
                // matchFound = true;
                positions.push(`Ln ${lineNumber}, Col ${match.index}`);
                match = regex.exec(line); // Continue searching the line for further matches
            }
            lineNumber++;
        }

        return positions;

        // if (matchFound) {
        //     return `❌ ${filePath}: Pattern '${pattern}' found at : ${positions.join(', ')}`;
        // } else {
        //     return `✅ ${filePath} : No matches!`;
        // }
    } catch (err) {
        throw new Error(`Error reading file ${filePath}: ${err.message}`);
    }
}

// Function to read a directory and search files for a list of text patterns
async function searchFilesInDirectory(directory, patterns) {
    try {
        const files = await fs.readdir(directory);
        const scannedFiles = [];

        // Iterate through each file in the directory
        for (const file of files) {
            const filePath = path.join(directory, file);

            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
                const foundPatterns = [];
                // Search the file with all the patterns loaded
                for (const pattern of patterns) {
                    const foundPositions = await searchPatternInFile(filePath, pattern);
                    if (foundPositions.length) {
                        foundPatterns.push({ pattern, foundPositions });
                    }
                    // console.log(foundPositions);
                }
                scannedFiles.push({
                    file,
                    hasMatches: foundPatterns.length > 0,
                    foundPatterns
                });
            }
        }

        for (const scannedFile of scannedFiles) {
            const matchesReport = scannedFile.hasMatches ? 
                scannedFile.foundPatterns.map(fp => `Pattern '${fp.pattern}' found at : ${fp.foundPositions.join(', ')}`).join()
                :
                `No matches!`;
            console.log(`${scannedFile.hasMatches ? '❌' : '✅'} ${scannedFile.file}: ${matchesReport}`);
        }
    } catch (err) {
        console.error(`Error processing directory ${directory}: ${err.message}`);
    }
}

// Function to load patterns from a CSV file
async function loadPatternsFromCSV(csvFilePath) {
    const patterns = [];
    try {
        await pipeline(
            createReadStream(csvFilePath, { encoding: 'utf8' }),
            csvParser(),
            async (source) => {
                for await (const row of source) {
                    // Assuming each row has a column named "pattern"
                    if (row.pattern) {
                        patterns.push(row.pattern);
                    }
                }
            }
        );
    } catch (err) {
        throw new Error(`Error reading CSV file: ${err.message}`);
    }

    return patterns;
}

/**
 * 
 * @param {Object} config - The configuration for the eval
 * @param {string} config.name - The name of the eval
 * @param {string} config.searchPath - The directory pathname that contains the files for pattern search ie. "outputs/mytest/"
 * @param {string} config.ruleset - The filepath for the ruleset file ie. "patterns.csv"
 * @param {string} config.rulesetType - The type of ruleset file ie. "csvfile"
 * @returns {number} - 0 for successful execution
 */
export const runEval = async (config) => {
    if (!config.searchPath) {
        console.error(`Eval config error: searchPath was not set`);
        return -1;
    }    
    
    // validate files path
    const directoryPath = path.join(process.cwd(), 'outputs', config.searchPath);
    if (!fsSync.existsSync(directoryPath)) {
        console.error(`Eval config error: Search path '${directoryPath}' does not exist. Aborting.`);
        return -1;
    }
    
    const rulesetFile = path.join(process.cwd(), 'inputs', config.ruleset); // Replace with the path to your CSV file
    if (!fsSync.existsSync(rulesetFile)) {
        console.error(`Eval config error: Ruleset file '${rulesetFile}' does not exist. Aborting.`);
        return -1;
    }

    // Load patterns from CSV
    let patterns = [];
    switch (config.rulesetType) {
        case 'csvfile':
            patterns = await loadPatternsFromCSV(rulesetFile);
            break;
        default:
            console.error(`Eval config error: Unknown rulesetType '${config.rulesetType}'`);
            return -1;
    }
    
    if (!patterns.length) {
        console.error('Eval config error: No rules found in the ruleset.');
        return -1;
    }
    console.log(`Eval ${DEFAULT_NAME} loaded ${patterns.length} patterns: ${patterns.join(', ')}`);

    // Search for the patterns in the directory
    await searchFilesInDirectory(directoryPath, patterns);
    return 0;
}

export default { 
    name: DEFAULT_NAME,
    action: runEval
};
