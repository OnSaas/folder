import { keys } from "../storage/keys";
import { addToList, getList, removeFromList, setJson } from "../storage/kv";

export const favoriteRepository = {
  async list(userId: string): Promise<string[]> {
    return getList(keys.favorites(userId));
  },

  async has(userId: string, fileId: string): Promise<boolean> {
    const list = await getList(keys.favorites(userId));
    return list.includes(fileId);
  },

  async add(userId: string, fileId: string): Promise<void> {
    await addToList(keys.favorites(userId), fileId);
  },

  async remove(userId: string, fileId: string): Promise<void> {
    await removeFromList(keys.favorites(userId), fileId);
  },

  async setAll(userId: string, fileIds: string[]): Promise<void> {
    await setJson(keys.favorites(userId), fileIds);
  },
};
