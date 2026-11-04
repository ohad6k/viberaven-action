import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [input, output] = process.argv.slice(2);
if (!input || !output || resolve(input) === resolve(output)) {
  throw new Error('Use separate raw SARIF and GitHub annotation file paths.');
}
const report = JSON.parse(readFileSync(input, 'utf8'));
if (report?.version !== '2.1.0' || !Array.isArray(report.runs) || report.runs.length === 0) {
  throw new Error('Expected a SARIF 2.1.0 report with runs; no upload file was prepared.');
}

let included = 0;
let excluded = 0;
const excludedMessages = [];
const runs = report.runs.map((run) => {
  if (!run || typeof run !== 'object' || (run.results !== undefined && !Array.isArray(run.results))) {
    throw new Error('Invalid SARIF run results; no upload file was prepared.');
  }
  const results = (run.results ?? []).filter((result) => {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Invalid SARIF result; no upload file was prepared.');
    }
    // GitHub uses the first location. Do not invent a file for a repository-wide finding.
    const uri = result.locations?.[0]?.physicalLocation?.artifactLocation?.uri;
    const located = typeof uri === 'string' && uri.trim().length > 0;
    if (located) included += 1;
    else {
      excluded += 1;
      const message = typeof result.message?.text === 'string' ? result.message.text : JSON.stringify(result.message ?? {});
      excludedMessages.push(`${result.ruleId ?? '(no rule id)'}: ${message}`);
    }
    return located;
  });
  return { ...run, results };
});

// Keep an empty result set: uploading it can clear resolved old file alerts.
writeFileSync(output, JSON.stringify({ ...report, runs }, null, 2) + '\n');
console.log(`Prepared ${included} located results for GitHub; ${excluded} findings have no source location. Raw SARIF is unchanged.`);
if (excluded > 0 && process.env.GITHUB_STEP_SUMMARY) {
  const details = excludedMessages.join('\n\n');
  let fence = '```';
  for (const match of details.matchAll(/`+/g)) {
    if (match[0].length >= fence.length) fence = '`'.repeat(match[0].length + 1);
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `\n### Code scanning scope\n\n${excluded} findings without source locations are listed below and preserved in \`viberaven.sarif\`. GitHub file annotations contain only the ${included} located results. This is not an all-findings-clear verdict.\n\n${fence}text\n${details}\n${fence}\n`);
}
