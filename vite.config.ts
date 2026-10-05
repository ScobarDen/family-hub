import { defineConfig } from "vite-plus";

type Pattern = { regex: string; message: string; allowTypeImports?: boolean };

const extension = String.raw`(\.([cm]?[jt]sx?))?$`;

function role(...roles: string[]): Pattern {
  return {
    regex: String.raw`\.(${roles.join("|")})` + extension,
    message: "Crosses a role boundary.",
  };
}

const deepImport = {
  regex: "^@/(modules|common|pages)/[^/]+/.+",
  message: "Import the entity root, not its insides.",
};
const globalImport = {
  regex: "^@/global(/|$)",
  message: "Only the entry connects global.",
};
const reactuse = {
  name: "@siberiacancode/reactuse",
  message: "reactuse holds ephemeral DOM state and lives only in *.view.tsx.",
};

function restrict(
  patterns: Pattern[],
  { allowReactuse = false }: { allowReactuse?: boolean } = {},
): { "no-restricted-imports": ["error", object] } {
  return {
    "no-restricted-imports": ["error", { paths: allowReactuse ? [] : [reactuse], patterns }],
  };
}

function webSource(glob: string): string {
  return `apps/web/src/${glob}`;
}

function apiSource(glob: string): string {
  return `apps/api/src/${glob}`;
}

const generated = ["apps/api/worker-configuration.d.ts", "apps/api/migrations/**"];
const vendoredSkills = [".claude/skills/**", "skills-lock.json"];

function isVendoredSkill(file: string): boolean {
  const path = file.replaceAll("\\", "/");

  return path.includes("/.claude/skills/") || path.endsWith("/skills-lock.json");
}

// Windows runs `vp` through a .cmd shim capped at 8191 characters, which a skills update overflows.
function checkStagedFiles(files: readonly string[]): string[] {
  const checked = files.filter((file) => !isVendoredSkill(file));

  if (checked.length === 0) {
    return [];
  }

  const command = `vp check --fix ${checked.map((file) => JSON.stringify(file)).join(" ")}`;

  return [command, command];
}

const tests = ["**/*.test.{ts,tsx}"];
const testCode = [...tests, "apps/*/test/**"];
const configs = ["**/vite.config.ts", "**/drizzle.config.ts"];

type SizeLimits = Record<string, ["error" | "warn", object]>;

const sourceSizeLimits: SizeLimits = {
  "max-lines-per-function": ["error", { max: 40, skipBlankLines: true }],
  "max-statements": ["error", { max: 15 }],
  "max-lines": ["warn", { max: 200, skipBlankLines: true, skipComments: true }],
};

const testSizeLimits: SizeLimits = {
  "max-lines-per-function": ["error", { max: 300, skipBlankLines: true }],
  "max-statements": ["error", { max: 40 }],
  "max-lines": ["warn", { max: 500, skipBlankLines: true, skipComments: true }],
};

export default defineConfig({
  fmt: {
    ignorePatterns: [...generated, ...vendoredSkills, "docs/research/**"],
    sortImports: {
      groups: [
        "builtin",
        "external",
        "workspace",
        "internal",
        ["parent", "sibling", "index"],
        "unknown",
      ],
      customGroups: [{ groupName: "workspace", elementNamePattern: ["@family-hub/**"] }],
      internalPattern: ["@/"],
      newlinesBetween: true,
    },
  },
  staged: {
    "*.{js,mjs,cjs,ts,tsx,json,jsonc,md,yaml,yml}": checkStagedFiles,
  },
  lint: {
    ignorePatterns: [...generated, ...vendoredSkills],
    plugins: ["eslint", "typescript", "unicorn", "oxc", "import"],
    categories: { correctness: "error", suspicious: "error" },
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "@stylistic", specifier: "@stylistic/eslint-plugin" },
      { name: "unicorn-js", specifier: "eslint-plugin-unicorn" },
    ],
    options: { typeAware: true, typeCheck: true, reportUnusedDisableDirectives: "error" },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "unicorn/no-abusive-eslint-disable": "error",

      "@stylistic/padding-line-between-statements": [
        "error",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: ["const", "let"], next: "*" },
        { blankLine: "any", prev: ["const", "let"], next: ["const", "let"] },
        { blankLine: "always", prev: "*", next: "multiline-block-like" },
        { blankLine: "always", prev: "multiline-block-like", next: "*" },
      ],
      curly: ["error", "all"],
      "arrow-body-style": ["error", "as-needed"],
      "func-style": ["error", "declaration"],

      ...sourceSizeLimits,
      complexity: ["error", { max: 8 }],
      "max-depth": ["error", { max: 3 }],
      "max-params": ["error", { max: 3 }],

      "no-else-return": "error",
      "no-lonely-if": "error",
      "no-nested-ternary": "error",
      "no-negated-condition": "error",
      "unicorn/no-negation-in-equality-check": "error",
      "unicorn/prefer-logical-operator-over-ternary": "error",
      eqeqeq: "error",
      "prefer-const": "error",
      "no-var": "error",
      "no-param-reassign": "error",
      "no-plusplus": "error",
      "no-sequences": "error",
      "no-void": "error",
      "no-continue": "error",
      "no-labels": "error",
      "no-implicit-coercion": "error",
      "prefer-template": "error",
      "object-shorthand": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "unicorn/no-useless-undefined": "error",
      "unicorn/explicit-length-check": "error",
      "unicorn/no-await-expression-member": "error",
      "unicorn/no-unreadable-array-destructuring": "error",
      "unicorn/no-unreadable-iife": "error",
      "no-magic-numbers": ["error", { ignore: [0, 1, -1], ignoreArrayIndexes: true }],

      "unicorn/no-array-reduce": "error",
      "unicorn/no-array-for-each": "error",
      "typescript/prefer-for-of": "error",
      "unicorn/prefer-array-some": "error",
      "unicorn/prefer-array-find": "error",
      "unicorn/prefer-array-flat-map": "error",
      "typescript/prefer-includes": "error",

      "unicorn/consistent-function-scoping": "error",
      "default-param-last": "error",
      "unicorn/prefer-default-parameters": "error",
      "unicorn/no-object-as-default-parameter": "error",
      "no-empty-function": "error",
      "id-length": ["error", { min: 2, exceptions: ["_"] }],

      "typescript/no-floating-promises": "error",
      "typescript/no-misused-promises": "error",
      "typescript/switch-exhaustiveness-check": "error",
      "typescript/strict-boolean-expressions": "error",
      "typescript/prefer-nullish-coalescing": "error",
      "typescript/return-await": "error",
      "typescript/no-unnecessary-type-assertion": "error",
      "typescript/no-unnecessary-type-arguments": "error",
      "typescript/no-unnecessary-boolean-literal-compare": "error",
      "typescript/no-unnecessary-template-expression": "error",
      "typescript/only-throw-error": "error",
      "typescript/prefer-promise-reject-errors": "error",
      "typescript/consistent-type-definitions": ["error", "type"],
      "typescript/consistent-type-imports": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-non-null-assertion": "error",
      "typescript/array-type": ["error", { default: "array-simple" }],
      "typescript/no-inferrable-types": "error",
      "typescript/prefer-function-type": "error",
      "typescript/consistent-indexed-object-style": "error",
      "typescript/consistent-generic-constructors": "error",
      "typescript/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", "ts-ignore": true, "ts-nocheck": true },
      ],

      "unicorn-js/consistent-boolean-name": "error",
      "unicorn-js/name-replacements": [
        "error",
        {
          replacements: {
            db: false,
            env: false,
            lib: false,
            repo: false,
            props: false,
            ref: false,
            refs: false,
            params: false,
          },
        },
      ],
      "unicorn/filename-case": ["error", { case: "kebabCase" }],

      "import/no-duplicates": "error",
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-default-export": "error",
    },
    overrides: [
      {
        files: ["apps/web/**/*.{ts,tsx}"],
        plugins: ["react"],
        rules: {
          "no-console": "error",
          "react/rules-of-hooks": "error",
          "react/exhaustive-deps": "error",
          "react/no-array-index-key": "error",
          "react/self-closing-comp": "error",
          "react/jsx-boolean-value": "error",
          "react/jsx-curly-brace-presence": "error",
          "react/jsx-fragments": "error",
          "react/jsx-no-useless-fragment": "error",
          "react/hook-use-state": "error",
          "react/no-multi-comp": "error",
          "react/no-danger": "error",
          "react/jsx-pascal-case": "error",
          // The automatic JSX runtime needs no React in scope.
          "react/react-in-jsx-scope": "off",
        },
      },
      {
        files: tests,
        plugins: ["vitest"],
        rules: {
          ...testSizeLimits,
          "vitest/no-focused-tests": "error",
          "vitest/no-disabled-tests": "error",
          "vitest/expect-expect": "error",
        },
      },
      { files: [...testCode, ...configs], rules: { "no-magic-numbers": "off" } },
      {
        files: ["apps/*/test/**"],
        rules: { "typescript/no-unsafe-type-assertion": "off" },
      },
      { files: configs, rules: { "max-lines": "off" } },
      {
        files: [...configs, apiSource("index.ts")],
        rules: { "import/no-default-export": "off" },
      },
      {
        files: ["apps/*/src/**/*.{ts,tsx}"],
        rules: restrict([deepImport, globalImport, role("dto")]),
      },
      {
        files: ["apps/*/src/**/*.test.{ts,tsx}"],
        rules: restrict([deepImport, globalImport]),
      },
      {
        files: [webSource("app/main.tsx")],
        rules: restrict([deepImport, role("dto")]),
      },
      { files: [webSource("**/*.dto.ts")], rules: restrict([deepImport, globalImport]) },
      {
        files: [webSource("**/*.api.ts")],
        rules: restrict([deepImport, globalImport, role("vm", "view")]),
      },
      {
        files: [webSource("**/*.model.ts")],
        rules: restrict([deepImport, globalImport, role("vm", "view", "dto")]),
      },
      {
        files: [webSource("**/*.vm.ts")],
        rules: restrict([
          deepImport,
          globalImport,
          role("view", "dto"),
          { ...role("api"), allowTypeImports: true },
        ]),
      },
      {
        files: [webSource("**/*.view.tsx")],
        rules: restrict([deepImport, globalImport, role("api", "dto")], { allowReactuse: true }),
      },
      {
        files: [apiSource("**/*.route.ts")],
        rules: restrict([deepImport, globalImport, role("repo")]),
      },
      {
        files: [apiSource("**/*.service.ts")],
        rules: restrict([deepImport, globalImport, role("route")]),
      },
      {
        files: [apiSource("**/*.repo.ts")],
        rules: restrict([deepImport, globalImport, role("route", "service")]),
      },
    ],
  },
  run: {
    cache: true,
  },
});
