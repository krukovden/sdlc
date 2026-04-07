'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Returns the absolute path for a file given a base directory and relative path.
 * @param {string} baseDir
 * @param {string} relativePath
 * @returns {string}
 */
function resolve(baseDir, relativePath) {
  return path.join(baseDir, relativePath);
}

/**
 * Asserts that a file exists at baseDir/relativePath.
 * @param {string} baseDir
 * @param {string} relativePath
 */
function assertFileExists(baseDir, relativePath) {
  const full = resolve(baseDir, relativePath);
  assert.ok(
    fs.existsSync(full),
    `File "${full}" does not exist`
  );
}

/**
 * Asserts that a file does NOT exist at baseDir/relativePath.
 * @param {string} baseDir
 * @param {string} relativePath
 */
function assertFileNotExists(baseDir, relativePath) {
  const full = resolve(baseDir, relativePath);
  assert.ok(
    !fs.existsSync(full),
    `File "${full}" exists but should not`
  );
}

/**
 * Asserts that a file contains the given pattern (string or RegExp).
 * @param {string} baseDir
 * @param {string} relativePath
 * @param {string|RegExp} pattern
 */
function assertFileContains(baseDir, relativePath, pattern) {
  const full = resolve(baseDir, relativePath);
  const content = fs.readFileSync(full, 'utf8');
  const found =
    pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern);
  assert.ok(
    found,
    `Pattern ${pattern} not found in "${full}"`
  );
}

/**
 * Asserts that a file does NOT contain the given pattern (string or RegExp).
 * @param {string} baseDir
 * @param {string} relativePath
 * @param {string|RegExp} pattern
 */
function assertFileNotContains(baseDir, relativePath, pattern) {
  const full = resolve(baseDir, relativePath);
  const content = fs.readFileSync(full, 'utf8');
  const found =
    pattern instanceof RegExp ? pattern.test(content) : content.includes(pattern);
  assert.ok(
    !found,
    `Pattern ${pattern} found in "${full}" but should not`
  );
}

/**
 * Asserts that two files (given as absolute paths) have identical content.
 * @param {string} path1
 * @param {string} path2
 */
function assertFilesEqual(path1, path2) {
  const content1 = fs.readFileSync(path1, 'utf8');
  const content2 = fs.readFileSync(path2, 'utf8');
  assert.ok(
    content1 === content2,
    `Files "${path1}" and "${path2}" differ`
  );
}

/**
 * Asserts that a file is a valid (non-empty) Markdown file with at least one heading.
 * @param {string} baseDir
 * @param {string} relativePath
 */
function assertValidMarkdown(baseDir, relativePath) {
  const full = resolve(baseDir, relativePath);
  const content = fs.readFileSync(full, 'utf8');
  assert.ok(content.trim().length > 0, `Markdown file "${full}" is empty`);
  assert.ok(/^#\s+.+/m.test(content), `Markdown file "${full}" has no heading`);
}

/**
 * Asserts that a file contains valid JSON (JSON.parse must succeed).
 * @param {string} baseDir
 * @param {string} relativePath
 */
function assertValidJSON(baseDir, relativePath) {
  const full = resolve(baseDir, relativePath);
  const content = fs.readFileSync(full, 'utf8');
  // JSON.parse will throw on invalid JSON — let the error propagate naturally.
  JSON.parse(content);
}

/**
 * Asserts that a file is a valid TOML document:
 *   - Non-empty
 *   - Contains at least one key=value or [section] line
 *   - Has no unclosed (odd-count) double-quote sequences within any single line
 * @param {string} baseDir
 * @param {string} relativePath
 */
function assertValidTOML(baseDir, relativePath) {
  const full = resolve(baseDir, relativePath);
  const content = fs.readFileSync(full, 'utf8');

  assert.ok(content.trim().length > 0, `TOML file "${full}" is empty`);

  const lines = content.split('\n');

  // Must have at least one key=value assignment or [section] header
  const hasStructure = lines.some(
    (line) => /^\s*\[.+\]/.test(line) || /^\s*\w[\w.-]*\s*=/.test(line)
  );
  assert.ok(hasStructure, `TOML file "${full}" has no key=value or [section] lines`);

  // Check for unclosed double quotes on each line (ignore comment lines)
  for (const line of lines) {
    const stripped = line.replace(/\s*#.*$/, ''); // strip inline comments
    const quoteCount = (stripped.match(/"/g) || []).length;
    assert.ok(
      quoteCount % 2 === 0,
      `TOML file "${full}" has unclosed double quotes on line: ${line}`
    );
  }
}

/**
 * Checked HTML tag names.
 */
const HTML_TAGS = ['div', 'table', 'ul', 'ol', 'pre', 'p', 'span', 'body', 'html', 'head'];

/**
 * Asserts that an HTML file has balanced open/close counts for a set of common tags.
 * @param {string} baseDir
 * @param {string} relativePath
 */
function assertValidHTML(baseDir, relativePath) {
  const full = resolve(baseDir, relativePath);
  const content = fs.readFileSync(full, 'utf8');

  for (const tag of HTML_TAGS) {
    const openPattern = new RegExp(`<${tag}[\\s>]`, 'gi');
    const closePattern = new RegExp(`</${tag}>`, 'gi');

    const openCount = (content.match(openPattern) || []).length;
    const closeCount = (content.match(closePattern) || []).length;

    assert.ok(
      openCount === closeCount,
      `HTML file "${full}": <${tag}> open/close counts differ (open=${openCount}, close=${closeCount})`
    );
  }
}

module.exports = {
  assertFileExists,
  assertFileNotExists,
  assertFileContains,
  assertFileNotContains,
  assertFilesEqual,
  assertValidMarkdown,
  assertValidJSON,
  assertValidTOML,
  assertValidHTML,
};
