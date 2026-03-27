const fs = require("fs");
const path = require("path");
const { gradeObjectiveSubmission } = require("../src/lib/grading/objectiveGrader");

function gradeObjective(submission) {
  const res = gradeObjectiveSubmission(submission);
  return res ? res.score : null;
}

function main() {
  const filePath = path.join(process.cwd(), "tests", "goldset", "toefl_objective.json");
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const failures = [];

  for (const testCase of data.cases) {
    const score = gradeObjective(testCase.submission);
    if (score !== testCase.expectedScore) {
      failures.push({ name: testCase.name, expected: testCase.expectedScore, got: score });
    }
  }

  if (failures.length) {
    console.error("Gold set failures:");
    failures.forEach((f) => console.error(`- ${f.name}: expected ${f.expected}, got ${f.got}`));
    process.exit(1);
  }

  console.log(`Gold set ok (${data.cases.length} cases).`);
}

main();
