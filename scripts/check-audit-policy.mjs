import { spawnSync } from "node:child_process";

const allowedBracesAdvisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const allowedBracesChain = new Set(["braces", "micromatch", "fast-glob", "@next/eslint-plugin-next", "eslint-config-next"]);
const audit = spawnSync("npm", ["audit", "--json"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
if (audit.error) {
  console.error(`Could not run npm audit: ${audit.error.message}`);
  process.exit(2);
}

let report;
try {
  report = JSON.parse(audit.stdout || "{}");
} catch {
  console.error("npm audit did not return valid JSON.");
  if (audit.stderr) console.error(audit.stderr.trim());
  process.exit(2);
}

const vulnerabilities = Object.entries(report.vulnerabilities || {});
const knownBraces = report.vulnerabilities?.braces;
const bracesAdvisoryPresent = (knownBraces?.via || []).some(
  (item) => item && typeof item === "object" && item.url === allowedBracesAdvisory,
);
const blockers = [];
for (const [name, vulnerability] of vulnerabilities) {
  if (vulnerability.severity === "critical") {
    blockers.push(`${name}: critical`);
    continue;
  }
  if (vulnerability.severity !== "high") continue;

  const affectedByOnlyKnownBracesChain = bracesAdvisoryPresent
    && allowedBracesChain.has(name)
    && (vulnerability.via || []).every((item) => typeof item === "string" && allowedBracesChain.has(item)
      || (item && typeof item === "object" && item.url === allowedBracesAdvisory));
  if (!affectedByOnlyKnownBracesChain) blockers.push(`${name}: high`);
}

if (blockers.length) {
  console.error(`Blocking npm audit findings: ${blockers.join(", ")}`);
  process.exit(1);
}

const knownHigh = vulnerabilities.filter(([name, vulnerability]) => vulnerability.severity === "high"
  && bracesAdvisoryPresent
  && allowedBracesChain.has(name)
  && (vulnerability.via || []).every((item) => typeof item === "string" && allowedBracesChain.has(item)
    || (item && typeof item === "object" && item.url === allowedBracesAdvisory)));
const moderate = vulnerabilities.filter(([, vulnerability]) => vulnerability.severity === "moderate");
if (knownHigh.length) {
  console.warn(`Known unpatched development-toolchain advisory allowed temporarily: ${knownHigh.map(([name]) => name).join(", ")} (${allowedBracesAdvisory}; braces <=3.0.3 has no patched release yet).`);
}
if (moderate.length) console.warn(`Non-blocking moderate dependency findings: ${moderate.map(([name]) => name).join(", ")}.`);
console.log("Dependency audit policy passed: no critical or unapproved high-severity findings.");
