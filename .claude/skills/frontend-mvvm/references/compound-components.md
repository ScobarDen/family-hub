# Compound components and presets

A component that keeps growing props to cover one more variant ends up with a prop per variant and a body full of conditions nobody can read. Split it into a **compound**: a root and flat parts the caller assembles. Keep the common assembly as a **preset** so the usual case stays a one-liner.

## When to go compound

The trigger is the role of a prop, not the count. The first **structural prop** is enough:

- shows or hides a part: `showHeader`, `hideFooter`, `withAvatar`;
- replaces a part: `renderActions`, `footerSlot`, `headerContent`;
- picks a layout of parts: `variant: 'compact' | 'full'` when the variants differ in which parts exist.

A prop that is data (`title`, `items`, `disabled`) or a visual token (`size`, `tone`) stays a prop.

## Rules

1. **Flat named exports.** `CardRoot`, `CardHeader`, `CardBody`, `CardActions`, each listed in `index.ts`. No `Card.Header` namespace: a client component reached through a dot breaks inside React Server Components, tree-shakes worse, and hides what the entity exports. Vue follows the same rule so there is one convention for both.
2. **The root owns UI state, the ViewModel owns domain state.** Open, expanded, selected tab live in the root and reach the parts through context. Everything domain arrives from the ViewModel as props on the root or on a part. A part fetches nothing and decides nothing; it is View.
3. **A part outside its root throws.** The context is typed, and the hook that reads it throws `CardHeader must be used within CardRoot` instead of returning `undefined`.
4. **Build interactive compounds on the project's headless library.** Dialog, select, tabs, popover, menu: if Radix, Reka UI, Headless UI or Ark is installed, wrap its parts. Focus trapping, keyboard and ARIA are its job. Hand-written compounds are for structure: card, page header, section, list item.

## Presets

A preset is a ready assembly of a compound, inserted into markup as one tag.

- **Rule of three.** Three identical assemblies earn a preset. Two do not.
- **A preset takes data and callbacks only.** Its structure is fixed. A frequent new variant gets a second preset; a rare one is assembled from the parts in place. A structural prop on a preset turns it back into the component the compound replaced.
- **Placement** (`feod-preset` §2): the compound is a common entity under `common/`. A preset that names domain concepts (`UserCard`) lives in the module that uses it; a purely visual preset (`ConfirmDialog`) sits beside its compound in `common/`.

## React

All parts in one file, `common/card/card.view.tsx`:

```tsx
type CardContextValue = { expanded: boolean; toggle: () => void }

const CardContext = createContext<CardContextValue | null>(null)

function useCardContext(part: string) {
  const context = useContext(CardContext)
  if (!context) throw new Error(`${part} must be used within CardRoot`)
  return context
}

export function CardRoot({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const value = useMemo(() => ({ expanded, toggle: () => setExpanded(v => !v) }), [expanded])
  return (
    <CardContext.Provider value={value}>
      <article>{children}</article>
    </CardContext.Provider>
  )
}

export function CardActions({ children }: { children: ReactNode }) {
  const { expanded, toggle } = useCardContext('CardActions')
  return (
    <footer>
      {children}
      <button onClick={toggle}>{expanded ? 'Less' : 'More'}</button>
    </footer>
  )
}
```

The preset in the module, `modules/team/user-card.view.tsx`:

```tsx
export function UserCard({ user, onMessage }: UserCardProps) {
  return (
    <CardRoot>
      <CardHeader title={user.name} avatarUrl={user.avatarUrl} />
      <CardBody>{user.role}</CardBody>
      <CardActions>
        <Button onClick={onMessage}>Message</Button>
      </CardActions>
    </CardRoot>
  )
}
```

`user` is UI-shaped ViewModel output, not a DTO.

## Vue

Each part is its own SFC: `common/card/card-root.view.vue`, `card-actions.view.vue`. In a module they would move into a `view/` folder (`role-files` §4); `common` stays one folder deep (FEOD `no-common-deep`), so the parts sit flat in `common/card/`. The context pair lives in `common/card/card.lib.ts`.

A project-wide `createContext` in `common/`, modelled on Reka UI's, gives the typed key and the throw. If `@vueuse/core` is already installed, `createInjectionState` does the same job, but its injector returns `undefined` outside the provider, so wrap it with the throw.

```ts
import { inject as vueInject, provide as vueProvide, type InjectionKey } from 'vue'

export function createContext<T>(providerName: string) {
  const key: InjectionKey<T> = Symbol(`${providerName}Context`)
  const inject = (part: string) => {
    const context = vueInject(key, null)
    if (!context) throw new Error(`${part} must be used within ${providerName}`)
    return context
  }
  const provide = (value: T) => vueProvide(key, value)
  return [inject, provide] as const
}
```

```ts
// card.lib.ts
export const [injectCardContext, provideCardContext] = createContext<CardContext>('CardRoot')
```

```vue
<!-- card-root.view.vue -->
<script setup lang="ts">
const expanded = ref(false)
provideCardContext({ expanded, toggle: () => (expanded.value = !expanded.value) })
</script>

<template><article><slot /></article></template>
```

```vue
<!-- card-actions.view.vue -->
<script setup lang="ts">
const { expanded, toggle } = injectCardContext('CardActions')
</script>

<template>
  <footer><slot :expanded="expanded" :toggle="toggle" /></footer>
</template>
```

- **Default slot** for content.
- **Scoped slot** when the caller needs a part's state (`v-slot="{ expanded }"`).
- **`asChild`** (render the caller's element with the part's behaviour) comes from the headless library; do not reimplement it.

## Sources

- [Reka UI: composition and `asChild`](https://reka-ui.com/docs/guides/composition.md), [inject context](https://reka-ui.com/docs/guides/inject-context.md), [`createContext` source](https://github.com/unovue/reka-ui/blob/v2/packages/core/src/shared/createContext.ts)
- [VueUse `createInjectionState`](https://vueuse.org/shared/createInjectionState/)
- [Vuetify0 compound components and slot props](https://0.vuetifyjs.com/guide/fundamentals/components.md)
