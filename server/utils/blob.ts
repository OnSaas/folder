import { tError } from "./i18n";
import { getDriver, trashObjectKey } from "../storage/drivers";

export const moveBlob = async (source: string, target: string) => {
  try {
    const driver = getDriver();
    if (driver.move) await driver.move(source, target);
    else if (driver.copy) {
      await driver.copy(source, target);
      await driver.delete(source);
    }
  } catch (err) {
    failBlob("errors.cantMove");
  }
};

export const copyBlob = async (source: string, target: string) => {
  try {
    const driver = getDriver();
    if (driver.copy) return driver.copy(source, target);
  } catch (err) {
    failBlob("errors.cantCopy");
  }
};

export const deleteBlob = async (path: string, timestamp: number) => {
  try {
    const driver = getDriver();
    const key = trashObjectKey(path, timestamp);
    if (driver.move) await driver.move(path, key);
    else if (driver.copy) {
      await driver.copy(path, key);
      await driver.delete(path);
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
