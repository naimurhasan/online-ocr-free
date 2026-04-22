#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function printUsage() {
  console.log("Usage: npm run ocr -- <input.png> [output.txt]");
}

const [, , inputArg, outputArg] = process.argv;

if (!inputArg || inputArg === "--help" || inputArg === "-h") {
  printUsage();
  process.exit(inputArg ? 0 : 1);
}

const inputPath = path.resolve(inputArg);

if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

if (path.extname(inputPath).toLowerCase() !== ".png") {
  console.error("Only PNG input is supported.");
  process.exit(1);
}

const outputPath = outputArg
  ? path.resolve(outputArg)
  : inputPath.replace(/\.png$/i, ".txt");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-"));
const tempBase = path.join(tempDir, "result");

const command = spawnSync("tesseract", [inputPath, tempBase], {
  encoding: "utf8"
});

if (command.error) {
  console.error("Failed to run tesseract. Make sure it is installed and on your PATH.");
  console.error(command.error.message);
  process.exit(1);
}

if (command.status !== 0) {
  if (command.stderr) {
    process.stderr.write(command.stderr);
  }
  process.exit(command.status || 1);
}

const tempOutputPath = `${tempBase}.txt`;

if (!fs.existsSync(tempOutputPath)) {
  console.error("Tesseract finished without producing a .txt file.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.copyFileSync(tempOutputPath, outputPath);

console.log(`Wrote OCR text to ${outputPath}`);
