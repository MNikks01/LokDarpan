/**
 * A command's own arguments, without the `--` pnpm passes through.
 *
 * `pnpm --filter … <script> -- --flag` hands the script `-- --flag`, and
 * `node:util`'s `parseArgs` reads everything after `--` as positional, so every
 * flag is refused as an unexpected argument. Stripping one leading `--` makes
 * the documented form and a direct `tsx` call behave the same.
 */
export function cliArgs(argv: readonly string[] = process.argv): string[] {
  const args = argv.slice(2);
  return args[0] === "--" ? args.slice(1) : args;
}
