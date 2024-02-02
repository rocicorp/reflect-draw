export const reflectServer = process.env.NEXT_PUBLIC_REFLECT_SERVER!;

if (!reflectServer) {
  throw new Error("Required env var NEXT_PUBLIC_REFLECT_SERVER is not defined");
}
