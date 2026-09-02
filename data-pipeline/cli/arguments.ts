export function readNamedArgument(name: string, argv = process.argv.slice(2)): string {
  const index = argv.indexOf(name);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`Required argument ${name} is missing.`);
  return value;
}
