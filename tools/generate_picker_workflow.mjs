// Publish the maintained Claude workflow in the existing Drive progress file.
// One source of instructions: changes to the skill must regenerate this module.
import { readFile, writeFile } from "node:fs/promises";
const source = new URL("../CLAUDE_SKILL_DAILY_THREE.md", import.meta.url);
const target = new URL("../picker-workflow.js", import.meta.url);
const workflow = (await readFile(source, "utf8")).replace(/\r\n/g, "\n");
const output = "// Generated from CLAUDE_SKILL_DAILY_THREE.md; do not edit.\n" +
  "export const PICKER_WORKFLOW = " + JSON.stringify(workflow) + ";\n";
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")).replace(/\r\n/g, "\n") !== output)
    throw Error("Drive's picker workflow is out of date. Run node tools/generate_picker_workflow.mjs.");
  console.log("Drive workflow matches the maintained Claude skill.");
} else {
  await writeFile(target, output, "utf8");
  console.log("Generated picker-workflow.js.");
}
