# Rollback Guide

Set:

```env
NEXT_PUBLIC_GLOBAL_NEURAL_DESIGN_V1=false
```

Redeploy Vercel. The route observer and header signals return no visual output. CSS remains inert because selectors require `html[data-h2o-neural="on"]`.

For full rollback, revert the integration commit. No database rollback is needed.
