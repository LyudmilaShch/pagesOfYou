import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // *.spec.ts is the suite from main (print resolution and photo upload).
    // The Konva text-box test stays a *.test.ts file and is listed on its own:
    // the other *.test.ts files are Node's test runner, not Vitest.
    include: [
      'src/**/*.spec.ts',
      'src/modules/editor/utils/text-box-layout.test.ts',
    ],
    environment: 'node',
  },
})
