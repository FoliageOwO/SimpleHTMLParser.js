namespace SimpleHTMLParser {
  export enum NodeType {
    Element = 1,
    Text = 3,
    Document = 9,
  }

  export type Attributes = { [key: string]: string };
  export type AttrFilterValue = string | true;
  export type AttrFilter = { [key: string]: AttrFilterValue };

  type ParentNode = Document | Element;

  const VOID_ELEMENTS: { [key: string]: true } = {
    area: true,
    base: true,
    br: true,
    col: true,
    embed: true,
    hr: true,
    img: true,
    input: true,
    link: true,
    meta: true,
    param: true,
    source: true,
    track: true,
    wbr: true,
  };

  const RAWTEXT_ELEMENTS: { [key: string]: true } = {
    script: true,
    style: true,
    textarea: true,
  };

  const ENTITY_MAP: { [key: string]: string } = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  export abstract class NodeBase {
    public nodeType: NodeType;
    public parent: ParentNode | null = null;
    public children: NodeBase[] = [];

    protected constructor(type: NodeType) {
      this.nodeType = type;
    }

    public get parentElement(): Element | null {
      return this.parent && this.parent.nodeType === NodeType.Element
        ? (this.parent as Element)
        : null;
    }

    public get textContent(): string {
      let out = "";
      const stack: NodeBase[] = [];
      for (let i = this.children.length - 1; i >= 0; i--) {
        stack.push(this.children[i]);
      }
      while (stack.length) {
        const node = stack.pop() as NodeBase;
        if (node.nodeType === NodeType.Text) {
          out += (node as TextNode).data;
          continue;
        }
        if (node.children.length) {
          for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push(node.children[i]);
          }
        }
      }
      return out;
    }

    public text(): string {
      return this.textContent;
    }
  }

  export class TextNode extends NodeBase {
    public data: string;

    constructor(text: string) {
      super(NodeType.Text);
      this.data = text;
    }

    public get textContent(): string {
      return this.data;
    }
  }

  export class Element extends NodeBase {
    public tagName: string;
    public attributes: Attributes;

    constructor(tagName: string, attributes?: Attributes) {
      super(NodeType.Element);
      this.tagName = tagName.toLowerCase();
      this.attributes = attributes ? { ...attributes } : {};
    }

    public appendChild(node: NodeBase): void {
      node.parent = this;
      this.children.push(node);
    }

    public getAttribute(name: string): string | null {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(this.attributes, key)
        ? this.attributes[key]
        : null;
    }

    public setAttribute(name: string, value: string): void {
      this.attributes[name.toLowerCase()] = value;
    }

    public hasAttribute(name: string): boolean {
      return Object.prototype.hasOwnProperty.call(
        this.attributes,
        name.toLowerCase()
      );
    }

    public removeAttribute(name: string): void {
      delete this.attributes[name.toLowerCase()];
    }

    public attr(name: string, value?: string): string | null | this {
      if (value === undefined) {
        return this.getAttribute(name);
      }
      this.setAttribute(name, value);
      return this;
    }

    public get id(): string {
      return this.getAttribute("id") || "";
    }

    public get className(): string {
      return this.getAttribute("class") || "";
    }

    public get classList(): string[] {
      return splitClassList(this.className);
    }

    public matches(selector: string): boolean {
      return matchesSelector(this, selector);
    }

    public querySelector(selector: string): Element | null {
      return querySelectorOne(this, selector, false);
    }

    public querySelectorAll(selector: string): Element[] {
      return querySelectorAll(this, selector, false);
    }

    public select(selector: string): Element[] {
      return this.querySelectorAll(selector);
    }

    public selectOne(selector: string): Element | null {
      return this.querySelector(selector);
    }

    public find(tag?: string, attrs?: AttrFilter): Element | null {
      return findInTree(this, tag, attrs, true);
    }

    public findAll(tag?: string, attrs?: AttrFilter): Element[] {
      return findAllInTree(this, tag, attrs, true);
    }
  }

  export class Document extends NodeBase {
    constructor() {
      super(NodeType.Document);
    }

    public appendChild(node: NodeBase): void {
      node.parent = this;
      this.children.push(node);
    }

    public get documentElement(): Element | null {
      for (let i = 0; i < this.children.length; i++) {
        const node = this.children[i];
        if (node.nodeType === NodeType.Element) {
          return node as Element;
        }
      }
      return null;
    }

    public querySelector(selector: string): Element | null {
      return querySelectorOne(this, selector, false);
    }

    public querySelectorAll(selector: string): Element[] {
      return querySelectorAll(this, selector, false);
    }

    public select(selector: string): Element[] {
      return this.querySelectorAll(selector);
    }

    public selectOne(selector: string): Element | null {
      return this.querySelector(selector);
    }

    public getElementById(id: string): Element | null {
      return this.querySelector("#" + id);
    }

    public find(tag?: string, attrs?: AttrFilter): Element | null {
      return findInTree(this, tag, attrs, true);
    }

    public findAll(tag?: string, attrs?: AttrFilter): Element[] {
      return findAllInTree(this, tag, attrs, true);
    }
  }

  export class DOMParser {
    public parseFromString(html: string): Document {
      return parse(html);
    }
  }

  export function parse(html: string): Document {
    const doc = new Document();
    const stack: ParentNode[] = [doc];
    let i = 0;
    const len = html.length;
    const lowerHtml = html.toLowerCase();

    while (i < len) {
      const ch = html.charCodeAt(i);
      if (ch === 60) {
        if (i + 3 < len && html.slice(i, i + 4) === "<!--") {
          const end = html.indexOf("-->", i + 4);
          i = end === -1 ? len : end + 3;
          continue;
        }
        if (i + 1 < len && html.charCodeAt(i + 1) === 33) {
          const end = html.indexOf(">", i + 2);
          i = end === -1 ? len : end + 1;
          continue;
        }
        if (i + 1 < len && html.charCodeAt(i + 1) === 47) {
          const end = html.indexOf(">", i + 2);
          if (end === -1) {
            break;
          }
          const tagName = html
            .slice(i + 2, end)
            .trim()
            .toLowerCase();
          if (tagName) {
            for (let s = stack.length - 1; s > 0; s--) {
              const node = stack[s];
              if (
                node.nodeType === NodeType.Element &&
                (node as Element).tagName === tagName
              ) {
                stack.length = s;
                break;
              }
            }
          }
          i = end + 1;
          continue;
        }

        let j = i + 1;
        while (
          j < len &&
          !isWhitespace(html.charCodeAt(j)) &&
          html.charCodeAt(j) !== 47 &&
          html.charCodeAt(j) !== 62
        ) {
          j++;
        }
        const rawTagName = html.slice(i + 1, j);
        if (!rawTagName) {
          i++;
          continue;
        }
        const tagName = rawTagName.toLowerCase();
        const attrs: Attributes = {};
        let selfClosing = false;

        while (j < len) {
          const code = html.charCodeAt(j);
          if (isWhitespace(code)) {
            j++;
            continue;
          }
          if (code === 47) {
            selfClosing = true;
            j++;
            while (j < len && isWhitespace(html.charCodeAt(j))) {
              j++;
            }
            if (j < len && html.charCodeAt(j) === 62) {
              j++;
              break;
            }
            continue;
          }
          if (code === 62) {
            j++;
            break;
          }

          const nameStart = j;
          while (j < len) {
            const c = html.charCodeAt(j);
            if (isWhitespace(c) || c === 61 || c === 47 || c === 62) {
              break;
            }
            j++;
          }
          const name = html.slice(nameStart, j).toLowerCase();
          while (j < len && isWhitespace(html.charCodeAt(j))) {
            j++;
          }
          let value = "";
          if (j < len && html.charCodeAt(j) === 61) {
            j++;
            while (j < len && isWhitespace(html.charCodeAt(j))) {
              j++;
            }
            if (
              j < len &&
              (html.charCodeAt(j) === 34 || html.charCodeAt(j) === 39)
            ) {
              const quote = html.charCodeAt(j);
              j++;
              const valueStart = j;
              while (j < len && html.charCodeAt(j) !== quote) {
                j++;
              }
              value = html.slice(valueStart, j);
              if (j < len && html.charCodeAt(j) === quote) {
                j++;
              }
            } else {
              const valueStart = j;
              while (j < len) {
                const c = html.charCodeAt(j);
                if (isWhitespace(c) || c === 47 || c === 62) {
                  break;
                }
                j++;
              }
              value = html.slice(valueStart, j);
            }
          }
          if (name) {
            attrs[name] = decodeEntities(value);
          }
        }

        const element = new Element(tagName, attrs);
        const parent = stack[stack.length - 1];
        parent.appendChild(element);

        if (!selfClosing && !VOID_ELEMENTS[tagName]) {
          if (RAWTEXT_ELEMENTS[tagName]) {
            const closeTag = "</" + tagName + ">";
            const closeIndex = lowerHtml.indexOf(closeTag, j);
            if (closeIndex === -1) {
              const rawText = html.slice(j);
              if (rawText) {
                element.appendChild(new TextNode(rawText));
              }
              i = len;
              continue;
            }
            const rawText = html.slice(j, closeIndex);
            if (rawText) {
              element.appendChild(new TextNode(rawText));
            }
            i = closeIndex + closeTag.length;
            continue;
          }
          stack.push(element);
        }

        i = j;
        continue;
      }

      const next = html.indexOf("<", i);
      const end = next === -1 ? len : next;
      const rawText = html.slice(i, end);
      if (rawText) {
        const text = decodeEntities(rawText);
        if (text) {
          const parent = stack[stack.length - 1];
          parent.appendChild(new TextNode(text));
        }
      }
      i = end;
    }

    return doc;
  }

  type SelectorAttr = { name: string; value?: string };
  type SelectorPart = {
    tag?: string;
    id?: string;
    classes: string[];
    attrs: SelectorAttr[];
  };
  type SelectorStep = { combinator: " " | ">"; part: SelectorPart };

  function querySelectorOne(
    root: NodeBase,
    selector: string,
    includeRoot: boolean
  ): Element | null {
    const groups = parseSelectorList(selector);
    let found: Element | null = null;
    walkElements(root, includeRoot, (el) => {
      for (let i = 0; i < groups.length; i++) {
        if (matchesSelectorChain(el, groups[i])) {
          found = el;
          return false;
        }
      }
      return true;
    });
    return found;
  }

  function querySelectorAll(
    root: NodeBase,
    selector: string,
    includeRoot: boolean
  ): Element[] {
    const groups = parseSelectorList(selector);
    const results: Element[] = [];
    walkElements(root, includeRoot, (el) => {
      for (let i = 0; i < groups.length; i++) {
        if (matchesSelectorChain(el, groups[i])) {
          results.push(el);
          break;
        }
      }
      return true;
    });
    return results;
  }

  function findInTree(
    root: NodeBase,
    tag?: string,
    attrs?: AttrFilter,
    includeRoot?: boolean
  ): Element | null {
    let found: Element | null = null;
    const tagName = tag ? tag.toLowerCase() : "";
    walkElements(root, Boolean(includeRoot), (el) => {
      if (matchesTagAndAttrs(el, tagName, attrs)) {
        found = el;
        return false;
      }
      return true;
    });
    return found;
  }

  function findAllInTree(
    root: NodeBase,
    tag?: string,
    attrs?: AttrFilter,
    includeRoot?: boolean
  ): Element[] {
    const results: Element[] = [];
    const tagName = tag ? tag.toLowerCase() : "";
    walkElements(root, Boolean(includeRoot), (el) => {
      if (matchesTagAndAttrs(el, tagName, attrs)) {
        results.push(el);
      }
      return true;
    });
    return results;
  }

  function matchesTagAndAttrs(
    el: Element,
    tagName: string,
    attrs?: AttrFilter
  ): boolean {
    if (tagName && tagName !== "*" && el.tagName !== tagName) {
      return false;
    }
    if (!attrs) {
      return true;
    }
    for (const rawKey in attrs) {
      if (!Object.prototype.hasOwnProperty.call(attrs, rawKey)) {
        continue;
      }
      const key = rawKey.toLowerCase();
      const value = attrs[rawKey];
      if (key === "class" || key === "classname") {
        if (value === true) {
          if (!el.hasAttribute("class")) {
            return false;
          }
        } else {
          const wanted = splitClassList(value);
          const classes = el.classList;
          for (let i = 0; i < wanted.length; i++) {
            if (classes.indexOf(wanted[i]) === -1) {
              return false;
            }
          }
        }
        continue;
      }
      if (key === "id") {
        if (value === true) {
          if (!el.hasAttribute("id")) {
            return false;
          }
        } else if (el.id !== value) {
          return false;
        }
        continue;
      }
      if (value === true) {
        if (!el.hasAttribute(key)) {
          return false;
        }
      } else if (el.getAttribute(key) !== value) {
        return false;
      }
    }
    return true;
  }

  function matchesSelector(element: Element, selector: string): boolean {
    const groups = parseSelectorList(selector);
    for (let i = 0; i < groups.length; i++) {
      if (matchesSelectorChain(element, groups[i])) {
        return true;
      }
    }
    return false;
  }

  function matchesSelectorChain(
    element: Element,
    steps: SelectorStep[]
  ): boolean {
    if (!steps.length) {
      return false;
    }
    let index = steps.length - 1;
    if (!matchesSelectorPart(element, steps[index].part)) {
      return false;
    }
    let current: Element | null = element;
    while (index > 0) {
      const combinator = steps[index].combinator;
      const target = steps[index - 1].part;
      if (combinator === ">") {
        current = current ? current.parentElement : null;
        if (!current || !matchesSelectorPart(current, target)) {
          return false;
        }
        index--;
        continue;
      }
      let parent: Element | null = current ? current.parentElement : null;
      while (parent && !matchesSelectorPart(parent, target)) {
        parent = parent.parentElement;
      }
      if (!parent) {
        return false;
      }
      current = parent;
      index--;
    }
    return true;
  }

  function matchesSelectorPart(el: Element, part: SelectorPart): boolean {
    if (part.tag && part.tag !== "*" && el.tagName !== part.tag) {
      return false;
    }
    if (part.id && el.id !== part.id) {
      return false;
    }
    if (part.classes.length) {
      const classes = el.classList;
      for (let i = 0; i < part.classes.length; i++) {
        if (classes.indexOf(part.classes[i]) === -1) {
          return false;
        }
      }
    }
    if (part.attrs.length) {
      for (let i = 0; i < part.attrs.length; i++) {
        const attr = part.attrs[i];
        if (!el.hasAttribute(attr.name)) {
          return false;
        }
        if (
          attr.value !== undefined &&
          el.getAttribute(attr.name) !== attr.value
        ) {
          return false;
        }
      }
    }
    return true;
  }

  function parseSelectorList(selector: string): SelectorStep[][] {
    const groups = splitSelectorGroups(selector);
    const list: SelectorStep[][] = [];
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i].trim();
      if (!group) {
        continue;
      }
      const steps = parseSelectorGroup(group);
      if (steps.length) {
        list.push(steps);
      }
    }
    return list;
  }

  function splitSelectorGroups(selector: string): string[] {
    const groups: string[] = [];
    let start = 0;
    let depth = 0;
    let quote = 0;
    for (let i = 0; i < selector.length; i++) {
      const code = selector.charCodeAt(i);
      if (quote) {
        if (code === quote) {
          quote = 0;
        }
        continue;
      }
      if (code === 34 || code === 39) {
        quote = code;
        continue;
      }
      if (code === 91) {
        depth++;
        continue;
      }
      if (code === 93 && depth) {
        depth--;
        continue;
      }
      if (code === 44 && depth === 0) {
        groups.push(selector.slice(start, i));
        start = i + 1;
      }
    }
    groups.push(selector.slice(start));
    return groups;
  }

  function parseSelectorGroup(input: string): SelectorStep[] {
    const steps: SelectorStep[] = [];
    let i = 0;
    let combinator: " " | ">" = " ";
    while (i < input.length) {
      while (i < input.length && isWhitespace(input.charCodeAt(i))) {
        i++;
      }
      if (i >= input.length) {
        break;
      }
      if (input.charCodeAt(i) === 62) {
        combinator = ">";
        i++;
        continue;
      }
      const parsed = parseSimpleSelector(input, i);
      steps.push({ combinator, part: parsed.part });
      i = parsed.next;
      combinator = " ";
    }
    return steps;
  }

  function parseSimpleSelector(
    input: string,
    start: number
  ): { part: SelectorPart; next: number } {
    const part: SelectorPart = { classes: [], attrs: [] };
    let i = start;
    while (i < input.length) {
      const code = input.charCodeAt(i);
      if (isWhitespace(code) || code === 62 || code === 44) {
        break;
      }
      if (code === 35) {
        i++;
        const id = readIdentifier(input, i);
        if (id.value) {
          part.id = id.value;
        }
        i = id.next;
        continue;
      }
      if (code === 46) {
        i++;
        const cls = readIdentifier(input, i);
        if (cls.value) {
          part.classes.push(cls.value);
        }
        i = cls.next;
        continue;
      }
      if (code === 91) {
        const parsed = readAttributeSelector(input, i);
        if (parsed.attr.name) {
          part.attrs.push(parsed.attr);
        }
        i = parsed.next;
        continue;
      }
      if (code === 42) {
        part.tag = "*";
        i++;
        continue;
      }
      const name = readIdentifier(input, i);
      if (name.value) {
        if (!part.tag) {
          part.tag = name.value.toLowerCase();
        }
        i = name.next;
        continue;
      }
      i++;
    }
    return { part, next: i };
  }

  function readAttributeSelector(
    input: string,
    start: number
  ): { attr: SelectorAttr; next: number } {
    let i = start + 1;
    while (i < input.length && isWhitespace(input.charCodeAt(i))) {
      i++;
    }
    const nameData = readIdentifier(input, i);
    let name = nameData.value.toLowerCase();
    i = nameData.next;
    while (i < input.length && isWhitespace(input.charCodeAt(i))) {
      i++;
    }
    let value: string | undefined;
    if (i < input.length && input.charCodeAt(i) === 61) {
      i++;
      while (i < input.length && isWhitespace(input.charCodeAt(i))) {
        i++;
      }
      if (
        i < input.length &&
        (input.charCodeAt(i) === 34 || input.charCodeAt(i) === 39)
      ) {
        const quote = input.charCodeAt(i);
        i++;
        const valueStart = i;
        while (i < input.length && input.charCodeAt(i) !== quote) {
          i++;
        }
        value = input.slice(valueStart, i);
        if (i < input.length && input.charCodeAt(i) === quote) {
          i++;
        }
      } else {
        const valueStart = i;
        while (i < input.length) {
          const code = input.charCodeAt(i);
          if (isWhitespace(code) || code === 93) {
            break;
          }
          i++;
        }
        value = input.slice(valueStart, i);
      }
    }
    while (i < input.length && isWhitespace(input.charCodeAt(i))) {
      i++;
    }
    if (i < input.length && input.charCodeAt(i) === 93) {
      i++;
    }
    if (!name) {
      name = "";
    }
    return { attr: { name, value }, next: i };
  }

  function readIdentifier(
    input: string,
    start: number
  ): { value: string; next: number } {
    let i = start;
    while (i < input.length && isIdentifierChar(input.charCodeAt(i))) {
      i++;
    }
    return { value: input.slice(start, i), next: i };
  }

  function isIdentifierChar(code: number): boolean {
    return (
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      code === 45 ||
      code === 95 ||
      code === 58
    );
  }

  function isWhitespace(code: number): boolean {
    return code <= 32;
  }

  function splitClassList(value: string): string[] {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    return trimmed.split(/\s+/);
  }

  function decodeEntities(text: string): string {
    if (text.indexOf("&") === -1) {
      return text;
    }
    return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body) => {
      if (body[0] === "#") {
        const hex = body[1] === "x" || body[1] === "X";
        const num = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
        if (!isNaN(num)) {
          return String.fromCharCode(num);
        }
        return match;
      }
      const decoded = ENTITY_MAP[body];
      return decoded ? decoded : match;
    });
  }

  function walkElements(
    root: NodeBase,
    includeRoot: boolean,
    cb: (el: Element) => boolean | void
  ): void {
    const stack: NodeBase[] = [];
    if (includeRoot) {
      stack.push(root);
    } else {
      for (let i = root.children.length - 1; i >= 0; i--) {
        stack.push(root.children[i]);
      }
    }
    while (stack.length) {
      const node = stack.pop() as NodeBase;
      if (node.nodeType === NodeType.Element) {
        const el = node as Element;
        const res = cb(el);
        if (res === false) {
          return;
        }
        for (let i = el.children.length - 1; i >= 0; i--) {
          stack.push(el.children[i]);
        }
      } else if (node.children.length) {
        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }
  }
}

declare const module: { exports: unknown } | undefined;

if (typeof module !== "undefined" && module && module.exports) {
  module.exports = SimpleHTMLParser;
}
