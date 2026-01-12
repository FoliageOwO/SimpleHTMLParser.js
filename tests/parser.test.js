const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function loadParser() {
  const distPath = path.join(__dirname, "..", "dist", "index.js");
  const code = fs.readFileSync(distPath, "utf8");
  const context = {};
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "index.js" });
  if (!context.SimpleHTMLParser) {
    throw new Error("SimpleHTMLParser not found in build output.");
  }
  return context.SimpleHTMLParser;
}

const parser = loadParser();

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`✓ ${name}\n`);
  } catch (err) {
    process.stderr.write(`✗ ${name}\n`);
    throw err;
  }
}

test("parse basic structure and text", () => {
  const doc = parser.parse("<div id='app'><span class='x'>hi</span></div>");
  const el = doc.getElementById("app");
  assert.ok(el);
  assert.strictEqual(el.tagName, "div");
  const span = el.querySelector("span");
  assert.ok(span);
  assert.strictEqual(span.className, "x");
  assert.strictEqual(span.textContent, "hi");
});

test("querySelectorAll with descendant and child combinators", () => {
  const doc = parser.parse(
    "<div><span class='a'></span><section><span class='b'></span></section></div>"
  );
  assert.strictEqual(doc.querySelectorAll("div span").length, 2);
  assert.strictEqual(doc.querySelectorAll("div > span").length, 1);
  assert.strictEqual(doc.querySelector("div > span").className, "a");
});

test("attribute selectors and filters", () => {
  const doc = parser.parse("<div data-id='1'></div><div data-id='2'></div>");
  assert.strictEqual(doc.querySelectorAll("[data-id]").length, 2);
  assert.strictEqual(
    doc.querySelector("[data-id='2']").getAttribute("data-id"),
    "2"
  );
  const found = doc.find("div", { "data-id": "1" });
  assert.ok(found);
  assert.strictEqual(found.getAttribute("data-id"), "1");
});

test("entity decoding", () => {
  const doc = parser.parse("<p>&amp;&lt;&#65;</p>");
  const p = doc.querySelector("p");
  assert.ok(p);
  assert.strictEqual(p.textContent, "&<A");
});

test("nbsp decoding", () => {
  const doc = parser.parse("<p>a&nbsp;b</p>");
  const p = doc.querySelector("p");
  assert.ok(p);
  assert.strictEqual(p.textContent, "a b");
});

test("self-closing and void elements", () => {
  const doc = parser.parse("<div><img src='a'/><br>tail</div>");
  const div = doc.querySelector("div");
  assert.ok(div);
  assert.strictEqual(div.querySelectorAll("img").length, 1);
  assert.strictEqual(div.querySelectorAll("br").length, 1);
  assert.strictEqual(div.textContent, "tail");
});

test("rawtext elements keep inner markup as text", () => {
  const html =
    "<div><script>var x = \"<span>y</span>\";</script><p id='infoTable'></p></div>";
  const doc = parser.parse(html);
  const script = doc.querySelector("script");
  assert.ok(script);
  assert.strictEqual(script.textContent, 'var x = "<span>y</span>";');
  assert.ok(doc.querySelector("#infoTable"));
});
