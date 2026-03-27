const fs = require("fs");
const path = require("path");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getTaskNames(sectionObj) {
  const arr = sectionObj?.task_types;
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map((t) => String(t?.name ?? "").trim()).filter(Boolean));
}

function main() {
  const p = path.join(process.cwd(), "src", "data", "toefl_source_data.json");
  const data = JSON.parse(fs.readFileSync(p, "utf8"));

  const required = {
    reading: ["Complete The Words", "Read in Daily Life", "Read an Academic Passage"],
    listening: [
      "Listen and Choose a Response",
      "Listen to a Conversation",
      "Listen to an Announcement",
      "Listen to an Academic Talk",
    ],
    writing: ["Build a Sentence", "Write an Email", "Write for an Academic Discussion"],
    speaking: ["Listen and Repeat", "Take an Interview"],
  };

  for (const [section, taskNames] of Object.entries(required)) {
    const present = getTaskNames(data[section]);
    assert(present.size > 0, `Missing or invalid section "${section}" task_types in toefl_source_data.json`);
    for (const name of taskNames) {
      assert(
        present.has(name),
        `Missing TOEFL task type "${name}" under section "${section}" in toefl_source_data.json`,
      );
    }
  }

  console.log("TOEFL source data ok.");
}

main();

