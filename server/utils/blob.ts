import { tError } from "./i18n";

export const moveBlob = async (source: string, target: string) => {
  try {
    const blob = await hubBlob().get(source);
    if (blob) {
      await hubBlob().put(target, blob);
      await hubBlob().del(source);
    }
  } catch (err) {
    failBlob("errors.cantMove");
  }
};

export const copyBlob = async (source: string, target: string) => {
  try {
    const blob = await hubBlob().get(source);
    if (blob) {
      return hubBlob().put(target, blob);
    }
  } catch (err) {
    failBlob("errors.cantCopy");
  }
};

export const deleteBlob = async (path: string, timestamp: number) => {
  try {
    const blob = await hubBlob().get(path);
    if (blob) {
      await hubBlob().put(`_trash/${timestamp}/${path}`, blob);
      await hubBlob().del(path);
    }
  } catch (err) {
    failBlob("errors.cantDelete");
  }
};

function failBlob(key: string): never {
  throw createError({
    status: 500,
    message: tError(useEvent(), key),
  });
}
