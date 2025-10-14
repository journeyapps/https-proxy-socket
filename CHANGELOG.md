# @journeyapps/https-proxy-socket

## 1.0.0

### Major Changes

- 73fb7f7: ## 1.2.2

  ### Major Changes
  - Removed support for mssql (tedious).
    - If you require this functionality please use [v0.2.2](https://www.npmjs.com/package/@journeyapps/https-proxy-socket/v/0.2.2) instead.
  - Support for MongoDB connection via https proxy added.
    - npx script added to retrieve replica members from a MongoDB connection string.

  ### Minor Changes
  - Updated dependencies.

  ### Patch Changes
  - Convert to Vitest for all tests
  - Refactoring and cleanup of codebase
  - Changesets added
  - GitHub workflows added for CI and publishing.
  - Switched repository to `pnpm` as package manager.
  - Package is published with support for esm and cjs
