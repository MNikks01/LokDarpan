export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "web",
        "api",
        "money",
        "neutrality",
        "contracts",
        "database",
        "observability",
        "ingestion",
        "docs",
        "ci",
        "deps",
        "repo",
      ],
    ],
    "subject-case": [2, "never", ["upper-case", "pascal-case", "start-case"]],
    "body-max-line-length": [0],
  },
};
