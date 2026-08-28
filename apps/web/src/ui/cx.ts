/**
 * Join class names, dropping the absent ones.
 *
 * CSS-module members are typed `string | undefined`, so a template literal over
 * them is a lint error and, worse, can render the literal "undefined" into a
 * class attribute. One helper removes both problems.
 */
export function cx(...classes: readonly (string | false | null | undefined)[]): string {
  return classes
    .filter((value): value is string => typeof value === "string" && value !== "")
    .join(" ");
}
