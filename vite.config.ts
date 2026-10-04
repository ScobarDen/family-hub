import { defineConfig } from "vite-plus";

const ext = String.raw`(\.([cm]?[jt]sx?))?$`;
const role = (...roles: string[]) => ({
  regex: String.raw`\.(${roles.join("|")})` + ext,
  message: "Crosses a role boundary.",
});
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

type Pattern = { regex: string; message: string; allowTypeImports?: boolean };

const restrict = (
  patterns: Pattern[],
  { allowReactuse = false }: { allowReactuse?: boolean } = {},
): { "no-restricted-imports": ["error", object] } => ({
  "no-restricted-imports": ["error", { paths: allowReactuse ? [] : [reactuse], patterns }],
});

const web = (glob: string) => `apps/web/src/${glob}`;

const generated = ["apps/api/worker-configuration.d.ts", "apps/api/migrations/**"];

export default defineConfig({
  fmt: {
    ignorePatterns: [...generated, "docs/research/**"],
  },
  lint: {
    ignorePatterns: generated,
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    overrides: [
      {
        files: ["apps/*/src/**/*.{ts,tsx}"],
        rules: {
          ...restrict([deepImport, globalImport, role("dto")]),
          "max-lines": ["warn", { max: 200, skipBlankLines: true, skipComments: true }],
        },
      },
      {
        files: ["apps/*/src/**/*.test.{ts,tsx}"],
        rules: {
          ...restrict([deepImport, globalImport]),
          "max-lines": ["warn", { max: 500, skipBlankLines: true, skipComments: true }],
        },
      },
      {
        files: [web("app/main.tsx")],
        rules: restrict([deepImport, role("dto")]),
      },
      { files: [web("**/*.dto.ts")], rules: restrict([deepImport, globalImport]) },
      {
        files: [web("**/*.api.ts")],
        rules: restrict([deepImport, globalImport, role("vm", "view")]),
      },
      {
        files: [web("**/*.model.ts")],
        rules: restrict([deepImport, globalImport, role("vm", "view", "dto")]),
      },
      {
        files: [web("**/*.vm.ts")],
        rules: restrict([
          deepImport,
          globalImport,
          role("view", "dto"),
          { ...role("api"), allowTypeImports: true },
        ]),
      },
      {
        files: [web("**/*.view.tsx")],
        rules: restrict([deepImport, globalImport, role("api", "dto")], { allowReactuse: true }),
      },
    ],
  },
  run: {
    cache: true,
  },
});
