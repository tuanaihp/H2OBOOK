# Compatibility with existing H2OBOOK modules

## Neural Knowledge Experience module

This Global Neural Design System complements, not replaces:

- `components/neural-experience/*`
- `lib/neural-experience/*`
- `/academy/neural-experience`

Keep the existing public landing sections. The global module supplies shared tokens and surface-aware chrome to the rest of the app.

Feature flags may coexist:

```env
NEXT_PUBLIC_NEURAL_EXPERIENCE_V1=true
NEXT_PUBLIC_GLOBAL_NEURAL_DESIGN_V1=true
```

## Makeup Design Library Pro

`/design-library/*` is automatically mapped to the `creative` surface. Its CSS Module layout remains unchanged. The global module only styles shared shell, topbar, sidebar, inputs and app background.

## Editor and Reader

The module intentionally avoids ambient layers in `creative` and `reader` surfaces. Canvas pages and book pages are not recolored or overlaid.
