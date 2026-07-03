// Fixtures are bundled at build time via import.meta.glob rather than fetched
// from /src at runtime. A leading-slash fetch works under Vite dev but 404s in
// a production build (the src/ tree is gone, and the absolute path ignores the
// deploy base such as GitHub Pages' /<repo>/). Bundling resolves the JSON
// through Vite so it works under any base. JSON modules expose the parsed
// object as the default export.
const modules = import.meta.glob('./fixtures/*.json');

export async function loadFixtureScene(name) {
  const loader = modules[`./fixtures/${name}.json`];
  if (!loader) throw new Error(`loadFixture: no fixture "${name}"`);
  return (await loader()).default;
}

export function fixtureNames() {
  return Object.keys(modules).map((path) => path.match(/([^/]+)\.json$/)[1]);
}
