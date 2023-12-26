# How to run/build the examples

```bash
# Clone the full project
git clone git@github.com:antfu/vite-ssg.git
cd vite-ssg

# Install dependencies and build the full project
pnpm install
pnpm build

# Build and serve the examples
# Multiple pages:
pnpm example:dev
pnpm example:build
pnpm example:serve

# Multiple pages with store
pnpm example:store:dev
pnpm example:store:build
pnpm example:store:serve

# Single Page
pnpm example:single:dev
pnpm example:single:build
pnpm example:single:serve
```
