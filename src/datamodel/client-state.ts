import { generatePresence } from "@rocicorp/rails";
import type { WriteTransaction } from "@rocicorp/reflect";
import { randInt } from "../util/rand";

const colors = [
  "#f94144",
  "#f3722c",
  "#f8961e",
  "#f9844a",
  "#f9c74f",
  "#90be6d",
  "#43aa8b",
  "#4d908e",
  "#577590",
  "#277da1",
];
const avatars = [
  ["🐶", "Puppy"],
  ["🐱", "Kitty"],
  ["🐭", "Mouse"],
  ["🐹", "Hamster"],
  ["🐰", "Bunny"],
  ["🦊", "Fox"],
  ["🐻", "Bear"],
  ["🐼", "Panda"],
  ["🐻‍❄️", "Polar Bear"],
  ["🐨", "Koala"],
  ["🐯", "Tiger"],
  ["🦁", "Lion"],
  ["🐮", "Cow"],
  ["🐷", "Piggy"],
  ["🐵", "Monkey"],
  ["🐣", "Chick"],
];

import { z } from "zod";
import { getParse } from "./zod";

export const userInfoSchema = z.object({
  avatar: z.string(),
  name: z.string(),
  color: z.string(),
});

export const clientStateSchema = z.object({
  clientID: z.string(),
  cursor: z.union([
    z.object({
      x: z.number(),
      y: z.number(),
    }),
    z.null(),
  ]),
  overID: z.string(),
  selectedID: z.string(),
  userInfo: userInfoSchema,
});

export type UserInfo = z.infer<typeof userInfoSchema>;
export type ClientState = z.infer<typeof clientStateSchema>;

export const {
  init: initClientState,
  get: getClientState,
  mustGet: mustGetClientState,
  set: setClientState,
  update: updateClientState,
} = generatePresence("client-state", getParse(clientStateSchema));

export async function setCursor(
  tx: WriteTransaction,
  { x, y }: { x: number; y: number }
): Promise<void> {
  await updateClientState(tx, { cursor: { x, y } });
}

export async function overShape(
  tx: WriteTransaction,
  shapeID: string
): Promise<void> {
  await updateClientState(tx, { overID: shapeID });
}

export async function selectShape(
  tx: WriteTransaction,
  shapeID: string
): Promise<void> {
  await updateClientState(tx, { selectedID: shapeID });
}

export function randUserInfo(): UserInfo {
  const [avatar, name] = avatars[randInt(0, avatars.length - 1)];
  return {
    avatar,
    name,
    color: colors[randInt(0, colors.length - 1)],
  };
}
