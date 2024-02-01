export const reflectServer = process.env.NEXT_PUBLIC_REFLECT_SERVER
  ? applyTemplate(process.env.NEXT_PUBLIC_REFLECT_SERVER)
  : "";

function applyTemplate(template: string) {
  const f = new Function(
    "NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF",
    `return \`${template}\``
  );
  const branchName = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ?? "";
  return f(branchName.replace(/[a-zA-Z0-9]/g, "-"));
}
