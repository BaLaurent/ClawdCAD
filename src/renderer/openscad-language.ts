import type { languages, editor, Position, CancellationToken, IRange } from 'monaco-editor'

export const OPENSCAD_LANGUAGE_ID = 'openscad'

/** Base language config without onEnterRules (those need runtime Monaco enums). */
const baseLanguageConfig: languages.LanguageConfiguration = {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/'],
  },
  brackets: [
    ['{', '}'],
    ['[', ']'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
  ],
  surroundingPairs: [
    { open: '{', close: '}' },
    { open: '[', close: ']' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
  ],
  indentationRules: {
    increaseIndentPattern: /^.*\{[^}"']*$|^.*\([^)"']*$|^.*\[[^\]"']*$/,
    decreaseIndentPattern: /^\s*[}\])].*$/,
  },
  folding: {
    markers: {
      start: /\{/,
      end: /\}/,
    },
  },
}

/** Build full language config with onEnterRules using runtime Monaco enums. */
function buildLanguageConfig(monaco: typeof import('monaco-editor')): languages.LanguageConfiguration {
  const { Indent, IndentOutdent } = monaco.languages.IndentAction
  return {
    ...baseLanguageConfig,
    onEnterRules: [
      { beforeText: /^\s*.*\{\s*(\/\/.*)?$/, afterText: /^\s*\}/, action: { indentAction: IndentOutdent } },
      { beforeText: /^\s*.*\{\s*(\/\/.*)?$/, action: { indentAction: Indent } },
      { beforeText: /^\s*.*\[\s*(\/\/.*)?$/, afterText: /^\s*\]/, action: { indentAction: IndentOutdent } },
      { beforeText: /^\s*.*\[\s*(\/\/.*)?$/, action: { indentAction: Indent } },
      { beforeText: /^\s*.*\(\s*(\/\/.*)?$/, afterText: /^\s*\)/, action: { indentAction: IndentOutdent } },
      { beforeText: /^\s*.*\(\s*(\/\/.*)?$/, action: { indentAction: Indent } },
    ],
  }
}

export const openscadTokensProvider: languages.IMonarchLanguage = {
  keywords: [
    'module', 'function', 'if', 'else', 'for', 'let', 'each',
    'intersection_for', 'assign', 'use', 'include',
    'true', 'false', 'undef',
  ],

  builtinModules: [
    // 3D primitives
    'cube', 'sphere', 'cylinder', 'polyhedron',
    // 2D primitives
    'circle', 'square', 'polygon', 'text',
    // Transformations
    'translate', 'rotate', 'scale', 'mirror', 'multmatrix',
    'color', 'offset', 'hull', 'minkowski', 'resize',
    // Boolean operations
    'union', 'difference', 'intersection',
    // Extrusion
    'linear_extrude', 'rotate_extrude',
    // Import/Export
    'import', 'surface', 'projection',
    // Other
    'render', 'children', 'echo', 'assert',
  ],

  builtinFunctions: [
    // Math
    'abs', 'sign', 'sin', 'cos', 'tan', 'acos', 'asin', 'atan', 'atan2',
    'floor', 'ceil', 'round', 'ln', 'log', 'pow', 'sqrt', 'exp',
    'min', 'max', 'norm', 'cross',
    // String
    'str', 'chr', 'ord', 'len', 'search', 'concat',
    // Type
    'is_undef', 'is_bool', 'is_num', 'is_string', 'is_list',
    // Other
    'lookup', 'rands', 'version', 'version_num', 'parent_module',
  ],

  specialVariables: [
    '$fn', '$fa', '$fs', '$t', '$vpr', '$vpt', '$vpd', '$vpf',
    '$children', '$preview',
  ],

  operators: [
    '=', '>', '<', '!', '~', '?', ':',
    '==', '<=', '>=', '!=', '&&', '||',
    '+', '-', '*', '/', '%', '^',
  ],

  symbols: /[=><!~?:&|+\-*/^%]+/,

  tokenizer: {
    root: [
      // Special variables ($fn, $fa, etc.)
      [/\$[a-zA-Z_]\w*/, 'variable.predefined'],

      // Identifiers and keywords
      [/[a-zA-Z_]\w*/, {
        cases: {
          '@keywords': 'keyword',
          '@builtinModules': 'type',
          '@builtinFunctions': 'support.function',
          '@default': 'identifier',
        },
      }],

      // Whitespace
      { include: '@whitespace' },

      // Delimiters and operators
      [/[{}()[\]]/, '@brackets'],
      [/[;,.]/, 'delimiter'],
      [/@symbols/, {
        cases: {
          '@operators': 'operator',
          '@default': '',
        },
      }],

      // Numbers
      [/\d*\.\d+([eE][-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],

      // Strings
      [/"([^"\\]|\\.)*$/, 'string.invalid'],
      [/"/, { token: 'string.quote', bracket: '@open', next: '@string' }],
    ],

    string: [
      [/[^\\"]+/, 'string'],
      [/\\./, 'string.escape'],
      [/"/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
    ],

    whitespace: [
      [/[ \t\r\n]+/, 'white'],
      [/\/\*/, 'comment', '@comment'],
      [/\/\/.*$/, 'comment'],
    ],

    comment: [
      [/[^/*]+/, 'comment'],
      [/\*\//, 'comment', '@pop'],
      [/[/*]/, 'comment'],
    ],
  },
}

/** Build completion items from the token lists. */
function buildCompletionProvider(monaco: typeof import('monaco-editor')): languages.CompletionItemProvider {
  const { CompletionItemKind } = monaco.languages

  const keywordItems = (openscadTokensProvider.keywords as string[]).map(kw => ({
    label: kw,
    kind: CompletionItemKind.Keyword,
    insertText: kw,
    detail: 'keyword',
  }))

  const moduleItems = (openscadTokensProvider.builtinModules as string[]).map(mod => ({
    label: mod,
    kind: CompletionItemKind.Module,
    insertText: mod + '($0)',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: 'built-in module',
  }))

  const functionItems = (openscadTokensProvider.builtinFunctions as string[]).map(fn => ({
    label: fn,
    kind: CompletionItemKind.Function,
    insertText: fn + '($0)',
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: 'built-in function',
  }))

  const specialVarItems = (openscadTokensProvider.specialVariables as string[]).map(sv => ({
    label: sv,
    kind: CompletionItemKind.Variable,
    insertText: sv,
    detail: 'special variable',
  }))

  const allItems = [...keywordItems, ...moduleItems, ...functionItems, ...specialVarItems]

  return {
    triggerCharacters: ['$'],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    provideCompletionItems(model: editor.ITextModel, position: Position, _context: languages.CompletionContext, _token: CancellationToken): languages.ProviderResult<languages.CompletionList> {
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }

      // Also detect $ prefix for special variables
      const lineContent = model.getLineContent(position.lineNumber)
      const charBefore = lineContent[word.startColumn - 2]
      const isDollarPrefix = charBefore === '$'

      let suggestions: languages.CompletionItem[]
      if (isDollarPrefix) {
        // Only show special variables when typing after $
        suggestions = specialVarItems.map(item => ({
          ...item,
          range: {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn - 1, // include the $
            endColumn: word.endColumn,
          },
        }))
      } else {
        suggestions = allItems.map(item => ({ ...item, range }))
      }

      return { suggestions }
    },
  }
}

/** Extract user-defined module/function names from the editor model. */
function getUserDefinedSymbols(model: editor.ITextModel, monaco: typeof import('monaco-editor')): languages.CompletionItem[] {
  const { CompletionItemKind } = monaco.languages
  const text = model.getValue()
  const symbols: languages.CompletionItem[] = []
  const seen = new Set<string>()

  // Match "module name(" or "function name("
  const regex = /\b(module|function)\s+([a-zA-Z_]\w*)\s*\(/g
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const kind = match[1]
    const name = match[2]
    if (!seen.has(name)) {
      seen.add(name)
      symbols.push({
        label: name,
        kind: kind === 'module' ? CompletionItemKind.Module : CompletionItemKind.Function,
        insertText: name + '($0)',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: `user-defined ${kind}`,
        range: undefined as unknown as IRange, // Will be set at call site
      })
    }
  }
  return symbols
}

/** Register the OpenSCAD language with Monaco. Call once before mounting editors. */
export function registerOpenSCADLanguage(monaco: typeof import('monaco-editor')): void {
  // Only register if not already registered
  const registered = monaco.languages.getLanguages().some(l => l.id === OPENSCAD_LANGUAGE_ID)
  if (registered) return

  monaco.languages.register({ id: OPENSCAD_LANGUAGE_ID, extensions: ['.scad'], aliases: ['OpenSCAD', 'openscad'] })
  monaco.languages.setLanguageConfiguration(OPENSCAD_LANGUAGE_ID, buildLanguageConfig(monaco))
  monaco.languages.setMonarchTokensProvider(OPENSCAD_LANGUAGE_ID, openscadTokensProvider)

  // Register completion provider for auto-complete
  const baseProvider = buildCompletionProvider(monaco)
  monaco.languages.registerCompletionItemProvider(OPENSCAD_LANGUAGE_ID, {
    triggerCharacters: baseProvider.triggerCharacters,
    provideCompletionItems(model, position, context, token) {
      const result = baseProvider.provideCompletionItems(model, position, context, token) as languages.CompletionList
      // Add user-defined symbols from current file
      const userSymbols = getUserDefinedSymbols(model, monaco)
      const word = model.getWordUntilPosition(position)
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      }
      for (const sym of userSymbols) {
        sym.range = range
        result.suggestions.push(sym)
      }
      return result
    },
  })
}
