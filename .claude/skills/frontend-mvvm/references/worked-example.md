# Worked example: a shop frontend

A made-up but typical React + Vite shop: catalog, cart, checkout with delivery and payment, a REST backend. The "before" is the layout most projects grow into by themselves, sorted by technical kind (`components/`, `hooks/`, `utils/`, `types/`). The "after" touches every level and every role folder.

## Before

```
src/
  App.tsx                   router, providers, query client (280 lines)
  polyfills.ts
  api/
    client.ts               fetch wrapper, base URL
    checkout.ts             order, promo, delivery, payment: fetch + DTO types + mapping (410 lines)
    products.ts
  components/
    Button.tsx
    ProductCard.tsx         takes ProductDto, formats price itself
    Checkout/
      Checkout.tsx          useQuery, form state, promo, totals, handlers, markup (620 lines)
      DeliveryForm.tsx      takes OrderDto, maps slots itself
      PaymentForm.tsx
  hooks/
    useCheckout.ts
    useDebounce.ts
  utils/
    format.ts               formatMoney, formatDate, calcDiscount
    constants.ts            API_URL, FREE_SHIPPING_FROM, PROMO_ENABLED
  types/
    index.ts                DTOs, domain types and props of everything
  pages/
    CatalogPage.tsx
    CheckoutPage.tsx        markup + useCheckout + reads the cart store directly
```

To answer "which fields of the order endpoint does the UI use" you read `api/checkout.ts`, `types/index.ts`, `Checkout.tsx` and `DeliveryForm.tsx`, and `utils/` gives no hint which of its functions are product rules.

## Before → after

| Before | Problem | After |
| --- | --- | --- |
| `api/checkout.ts`, 410 lines | four flows' transport, DTOs and mapping in one file | `checkout/api/checkout.api.ts`, `checkout/api/promo-code.api.ts`, `checkout/dto/`, and `delivery.api.ts` / `payment.api.ts` in their submodules; each `.api` maps its DTO into domain types |
| `types/index.ts` | DTOs, domain types and props in one bag | DTOs in `.dto.ts` next to their `.api`, domain types in the `.model.ts` that owns them, props next to their View; `checkout.types.ts` keeps only `CheckoutStep`, which the VM and two Views share |
| `components/Checkout/Checkout.tsx`, 620 lines | fetch, state, totals, handlers and markup in one component | `vm/checkout.vm.ts` (the hook: queries, handlers, UI-shaped data), `view/checkout.view.tsx` (root View), `view/order-summary.view.tsx`, totals in `model/order-total.model.ts` |
| `hooks/useCheckout.ts` | a business hook filed by technical kind | it is the ViewModel: merged into `checkout/vm/checkout.vm.ts` |
| `hooks/useDebounce.ts` | neutral infrastructure next to business code | `common/use-debounce/` |
| `DeliveryForm.tsx` takes `OrderDto` | the DTO travels into a leaf that maps it again | submodule `checkout/delivery/` with its own VM; its View gets `{ label, value }[]` slots |
| `PaymentForm.tsx` | a part with its own reason to change hidden in a folder of components | submodule `checkout/payment/` |
| `utils/format.ts` → `formatMoney` | looks like checkout code, is not: it names no product term | `common/format-money/` |
| `utils/format.ts` → `calcDiscount` | looks like a utility, is not: it is a pricing rule | `checkout/model/order-total.model.ts` |
| `utils/constants.ts` | a transport setting and product rules in one file | `API_URL` into `common/http-client/`; `FREE_SHIPPING_FROM`, `PROMO_ENABLED` into `checkout/config/` |
| `components/Button.tsx` | fine as code, lives next to product components | `common/button/` |
| `components/ProductCard.tsx` takes `ProductDto` | a catalog View reading a DTO | `catalog/view/product-card.view.tsx`, fed by `catalog.vm.ts` |
| `pages/CheckoutPage.tsx` | markup of the module in a page, and a page reaching into the cart store | `pages/checkout/checkout.view.tsx` mounts `Checkout` and hands it the cart; `checkout.route.ts` declares the URL |
| `App.tsx`, 280 lines | router, providers and client setup in one file | `app/main.tsx`, `app/router.ts`, `app/providers.tsx` |
| `polyfills.ts` | wired by the entry, imported by nobody | `global/polyfills.ts` |

## After

```
src/
  global/
    polyfills.ts
    vite-env.d.ts
  app/
    main.tsx
    router.ts
    providers.tsx
  common/
    button/
      index.ts
      view/
        button.view.tsx
        button.stories.tsx
    format-money/
      index.ts
      lib/
        format-money.lib.ts
        format-money.lib.test.ts
    http-client/
      index.ts
      http-client.api.ts
      http-client.config.ts
    use-debounce/
      index.ts
      use-debounce.lib.ts
  modules/
    cart/
      index.ts
      README.md
      cart.model.ts
      cart.vm.ts
      cart.view.tsx
    catalog/
      index.ts
      README.md
      catalog.api.ts
      catalog.dto.ts
      catalog.model.ts
      catalog.vm.ts
      view/
        catalog.view.tsx
        product-card.view.tsx
    checkout/
      index.ts
      README.md
      checkout.types.ts
      api/
        checkout.api.ts
        promo-code.api.ts
      dto/
        order.dto.ts
        promo-code.dto.ts
      config/
        promo.config.ts
        shipping.config.ts
      model/
        order.model.ts
        order-total.model.ts
        order-total.model.test.ts
      vm/
        checkout.vm.ts
        checkout.vm.test.ts
      view/
        checkout.view.tsx
        order-summary.view.tsx
      delivery/
        index.ts
        delivery.api.ts
        delivery.dto.ts
        delivery.model.ts
        delivery.vm.ts
        delivery.view.tsx
        lib/
          slot-range.lib.ts
          slot-range.lib.test.ts
      payment/
        index.ts
        payment.api.ts
        payment.vm.ts
        payment.view.tsx
  pages/
    catalog/
      index.ts
      catalog.route.ts
      catalog.view.tsx
    checkout/
      index.ts
      checkout.route.ts
      checkout.view.tsx
```

What each part shows:

- `cart` is fully flat: one file per role. `catalog` grew only its Views into a folder. `checkout` has a folder for every crowded role and single files (`checkout.types.ts`) at the root.
- `delivery` and `payment` are submodules: their own `index.ts`, the same one-file-or-folder layout, visible outside only if `checkout/index.ts` re-exports them.
- `checkout` never imports `cart`. The page is the mediator and passes the cart in; the checkout README lists `cartSource` under "Injected".
- `common` entities name no product term, and each has its own `index.ts`.

## The page as mediator

`pages/checkout/checkout.view.tsx` is the page from `SKILL.md` §5: both imports end at a module root, and `Checkout` is the hooks adapter in `checkout/view/checkout.view.tsx` that calls `useCheckout` from `checkout/vm/checkout.vm.ts`.
