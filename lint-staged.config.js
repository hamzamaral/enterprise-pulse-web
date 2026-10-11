const GENERATED = ['/src/api/generated/', '/src/routeTree.gen.ts'];

const isSource = (file) => !GENERATED.some((part) => file.replaceAll('\\', '/').includes(part));
const quote = (files) => files.map((file) => `"${file}"`).join(' ');

export default {
  '*.{ts,tsx}': (files) => {
    const sources = files.filter(isSource);
    return sources.length
      ? [`eslint --fix --no-warn-ignored ${quote(sources)}`, `prettier --write ${quote(sources)}`]
      : [];
  },
  '*.{css,json,md}': (files) => `prettier --write ${quote(files)}`,
};
