'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  assertFileExists,
  assertFileNotExists,
  assertFileContains,
  assertFileNotContains,
  assertFilesEqual,
  assertValidMarkdown,
  assertValidJSON,
  assertValidTOML,
  assertValidHTML,
} = require('./file-assertions.js');

// ---------------------------------------------------------------------------
// Temp dir helpers
// ---------------------------------------------------------------------------

let tmpDir;

function writeFile(relativePath, content) {
  const full = path.join(tmpDir, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
  return full;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('file-assertions helpers', () => {
  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-assertions-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // assertFileExists
  // -------------------------------------------------------------------------
  describe('assertFileExists', () => {
    it('passes when file exists', () => {
      writeFile('exists.txt', 'hello');
      assert.doesNotThrow(() => assertFileExists(tmpDir, 'exists.txt'));
    });

    it('throws "does not exist" when file is missing', () => {
      assert.throws(
        () => assertFileExists(tmpDir, 'missing.txt'),
        (err) => {
          assert.ok(err.message.includes('does not exist'), `Unexpected message: ${err.message}`);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // assertFileNotExists
  // -------------------------------------------------------------------------
  describe('assertFileNotExists', () => {
    it('passes when file does not exist', () => {
      assert.doesNotThrow(() => assertFileNotExists(tmpDir, 'ghost.txt'));
    });

    it('throws "exists but should not" when file is present', () => {
      writeFile('unwanted.txt', 'oops');
      assert.throws(
        () => assertFileNotExists(tmpDir, 'unwanted.txt'),
        (err) => {
          assert.ok(
            err.message.includes('exists but should not'),
            `Unexpected message: ${err.message}`
          );
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // assertFileContains
  // -------------------------------------------------------------------------
  describe('assertFileContains', () => {
    before(() => {
      writeFile('content.txt', 'Hello, World!\nSecond line here.');
    });

    it('passes for string pattern that is present', () => {
      assert.doesNotThrow(() => assertFileContains(tmpDir, 'content.txt', 'Hello'));
    });

    it('passes for RegExp pattern that matches', () => {
      assert.doesNotThrow(() => assertFileContains(tmpDir, 'content.txt', /Second\s+line/));
    });

    it('throws "not found in" for missing string pattern', () => {
      assert.throws(
        () => assertFileContains(tmpDir, 'content.txt', 'NOPE'),
        (err) => {
          assert.ok(err.message.includes('not found in'), `Unexpected message: ${err.message}`);
          return true;
        }
      );
    });

    it('throws "not found in" for non-matching RegExp', () => {
      assert.throws(
        () => assertFileContains(tmpDir, 'content.txt', /^XYZ/),
        (err) => {
          assert.ok(err.message.includes('not found in'), `Unexpected message: ${err.message}`);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // assertFileNotContains
  // -------------------------------------------------------------------------
  describe('assertFileNotContains', () => {
    before(() => {
      writeFile('nocontain.txt', 'Some safe content.');
    });

    it('passes when string is absent', () => {
      assert.doesNotThrow(() => assertFileNotContains(tmpDir, 'nocontain.txt', 'forbidden'));
    });

    it('passes when RegExp does not match', () => {
      assert.doesNotThrow(() => assertFileNotContains(tmpDir, 'nocontain.txt', /FORBIDDEN/i));
    });

    it('throws matching "found in.*but should not" when string is present', () => {
      assert.throws(
        () => assertFileNotContains(tmpDir, 'nocontain.txt', 'safe'),
        (err) => {
          assert.ok(
            /found in.*but should not/.test(err.message),
            `Unexpected message: ${err.message}`
          );
          return true;
        }
      );
    });

    it('throws matching "found in.*but should not" when RegExp matches', () => {
      assert.throws(
        () => assertFileNotContains(tmpDir, 'nocontain.txt', /[Ss]afe/),
        (err) => {
          assert.ok(
            /found in.*but should not/.test(err.message),
            `Unexpected message: ${err.message}`
          );
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // assertFilesEqual
  // -------------------------------------------------------------------------
  describe('assertFilesEqual', () => {
    it('passes when two files have identical content', () => {
      const a = writeFile('equal-a.txt', 'same content');
      const b = writeFile('equal-b.txt', 'same content');
      assert.doesNotThrow(() => assertFilesEqual(a, b));
    });

    it('throws "differ" when files have different content', () => {
      const a = writeFile('diff-a.txt', 'AAA');
      const b = writeFile('diff-b.txt', 'BBB');
      assert.throws(
        () => assertFilesEqual(a, b),
        (err) => {
          assert.ok(err.message.includes('differ'), `Unexpected message: ${err.message}`);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // assertValidMarkdown
  // -------------------------------------------------------------------------
  describe('assertValidMarkdown', () => {
    it('passes for valid markdown with heading', () => {
      writeFile('valid.md', '# Hello\n\nSome content here.');
      assert.doesNotThrow(() => assertValidMarkdown(tmpDir, 'valid.md'));
    });

    it('throws "empty" for an empty file', () => {
      writeFile('empty.md', '');
      assert.throws(
        () => assertValidMarkdown(tmpDir, 'empty.md'),
        (err) => {
          assert.ok(err.message.includes('empty'), `Unexpected message: ${err.message}`);
          return true;
        }
      );
    });

    it('throws "no heading" for file with content but no heading', () => {
      writeFile('noheading.md', 'Just a paragraph, no heading.');
      assert.throws(
        () => assertValidMarkdown(tmpDir, 'noheading.md'),
        (err) => {
          assert.ok(err.message.includes('no heading'), `Unexpected message: ${err.message}`);
          return true;
        }
      );
    });
  });

  // -------------------------------------------------------------------------
  // assertValidJSON
  // -------------------------------------------------------------------------
  describe('assertValidJSON', () => {
    it('passes for valid JSON', () => {
      writeFile('valid.json', '{"key": "value", "num": 42}');
      assert.doesNotThrow(() => assertValidJSON(tmpDir, 'valid.json'));
    });

    it('throws for invalid JSON', () => {
      writeFile('invalid.json', '{key: value}');
      assert.throws(() => assertValidJSON(tmpDir, 'invalid.json'));
    });
  });

  // -------------------------------------------------------------------------
  // assertValidTOML
  // -------------------------------------------------------------------------
  describe('assertValidTOML', () => {
    it('passes for valid TOML with key=value', () => {
      writeFile('valid.toml', '[section]\nname = "hello"\ncount = 42\n');
      assert.doesNotThrow(() => assertValidTOML(tmpDir, 'valid.toml'));
    });

    it('throws "empty" for empty file', () => {
      writeFile('empty.toml', '');
      assert.throws(
        () => assertValidTOML(tmpDir, 'empty.toml'),
        (err) => {
          assert.ok(err.message.includes('empty'), `Unexpected message: ${err.message}`);
          return true;
        }
      );
    });

    it('throws for file with no key=value or [section] lines', () => {
      writeFile('nostructure.toml', 'just a plain sentence\nanother line');
      assert.throws(() => assertValidTOML(tmpDir, 'nostructure.toml'));
    });

    it('throws for unclosed quotes', () => {
      writeFile('badquote.toml', 'name = "unclosed\n');
      assert.throws(() => assertValidTOML(tmpDir, 'badquote.toml'));
    });
  });

  // -------------------------------------------------------------------------
  // assertValidHTML
  // -------------------------------------------------------------------------
  describe('assertValidHTML', () => {
    it('passes for balanced HTML tags', () => {
      const html = [
        '<html>',
        '<head><title>Test</title></head>',
        '<body>',
        '<div><p>Hello</p></div>',
        '</body>',
        '</html>',
      ].join('\n');
      writeFile('valid.html', html);
      assert.doesNotThrow(() => assertValidHTML(tmpDir, 'valid.html'));
    });

    it('throws "differ" for unbalanced div tags', () => {
      const html = '<html><body><div><div></div></body></html>';
      writeFile('unbalanced.html', html);
      assert.throws(
        () => assertValidHTML(tmpDir, 'unbalanced.html'),
        (err) => {
          assert.ok(err.message.includes('differ'), `Unexpected message: ${err.message}`);
          return true;
        }
      );
    });

    it('throws "differ" for unbalanced table tags', () => {
      const html = '<html><body><table><table></table></body></html>';
      writeFile('unbalanced-table.html', html);
      assert.throws(
        () => assertValidHTML(tmpDir, 'unbalanced-table.html'),
        (err) => {
          assert.ok(err.message.includes('differ'), `Unexpected message: ${err.message}`);
          return true;
        }
      );
    });
  });
});
