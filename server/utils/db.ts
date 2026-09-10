import { ulid } from "ulidx";
import type { FileRecord, UserRecord } from "../storage/types";
import { userRepository } from "../repositories/user";
import { bucketRepository } from "../repositories/bucket";
import { fileRepository } from "../repositories/file";
import { shareRepository } from "../repositories/share";
import { favoriteRepository } from "../repositories/favorite";

const perPage = 12;

type QueryString = Record<string, unknown>;

function toApiUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    country: user.country,
    status: user.status,
    provider: user.provider,
    locale: user.locale ?? null,
    createdAt: new Date(user.createdAt),
  };
}

function toApiFile(file: FileRecord, extra: Record<string, unknown> = {}) {
  return {
    id: file.id,
    name: file.name,
    path: file.path,
    type: file.type,
    contentType: file.contentType,
    size: file.size,
    preview: file.preview,
    visibility: file.visibility,
    sharedCount: file.sharedCount,
    count: file.count,
    dimensions: file.dimensions,
    bucketName: file.bucketName,
    userId: file.userId,
    parentId: file.parentId,
    metadata: file.metadata,
    createdAt: new Date(file.createdAt),
    updatedAt: new Date(file.updatedAt),
    deletedAt: file.deletedAt ? new Date(file.deletedAt) : null,
    ...extra,
  };
}

function sortFiles(list: FileRecord[], queryString: QueryString) {
  const sortBy = (queryString.sortBy as string) || "createdAt";
  const order = (queryString.order as string) || "desc";
  const dir = order === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name) * dir;
    const av = (a as unknown as Record<string, unknown>)[sortBy];
    const bv = (b as unknown as Record<string, unknown>)[sortBy];
    const an = typeof av === "number" ? av : 0;
    const bn = typeof bv === "number" ? bv : 0;
    return (an - bn) * dir;
  });
}

function paginate<T>(list: T[], queryString: QueryString) {
  const page = Number(queryString.page || 1);
  if (page <= 0) {
    throw createError({ status: 404, message: "Invalid Request" });
  }
  const start = (page - 1) * perPage;
  const data = list.slice(start, start + perPage);
  const nextPage = data.length === perPage ? page + 1 : null;
  return { data, nextPage };
}

export async function createUser(data: CreateUserType) {
  const now = Date.now();
  return userRepository.create({
    id: data.id,
    name: data.name,
    email: data.email,
    avatar: data.avatar,
    provider: data.provider,
    status: "active",
    createdAt: data.createdAt ? new Date(data.createdAt).getTime() : now,
  });
}

export async function getUserByEmail(email: string) {
  const user = await userRepository.getByEmail(email);
  return user ? toApiUser(user) : null;
}

export async function getUser(id: string) {
  const user = await userRepository.get(id);
  return user ? toApiUser(user) : null;
}

export const getBucket = async (name: string) => {
  return bucketRepository.getByName(name);
};

export const getBucketSize = async (bucketName: string) => {
  const bucket = await bucketRepository.getByName(bucketName);
  if (!bucket) return 0;
  const files = await fileRepository.listByUser(bucket.userId);
  return files
    .filter((file) => file.bucketName === bucketName && file.type !== "folder" && !file.deletedAt)
    .reduce((sum, file) => sum + (file.size || 0), 0);
};

export const getUserBucket = async (userId: string) => {
  try {
    const bucket = await bucketRepository.getByUser(userId);
    if (!bucket) return null;
    const size = await getBucketSize(bucket.name);
    return { ...bucket, size };
  } catch (error) {
    console.log(error);
    return null;
  }
};

export const createBucket = async (name: string, userId: string) => {
  const hasBucket = await getBucket(name);
  if (hasBucket) {
    throw createError({ status: 400, message: "Bucket already exists" });
  }
  const now = Date.now();
  return bucketRepository.create({
    id: ulid() as string,
    name,
    userId,
    size: 0,
    count: 0,
    createdAt: now,
    updatedAt: now,
  });
};

async function withFavorite(userId: string, files: FileRecord[]) {
  const favs = await favoriteRepository.list(userId);
  const set = new Set(favs);
  return files.map((file) =>
    toApiFile(file, { isFavorite: set.has(file.id) ? new Date() : null })
  );
}

function applyFileFilters(list: FileRecord[], queryString: QueryString) {
  let next = list.filter((file) => !file.deletedAt);
  if (queryString["filters[contentType]"]) {
    next = next.filter(
      (file) => file.contentType === queryString["filters[contentType]"]
    );
  }
  if (queryString["filters[shared]"] === "no") {
    next = next.filter((file) => file.sharedCount === 0);
  }
  if (queryString["filters[shared]"] === "yes") {
    next = next.filter((file) => file.sharedCount !== 0);
  }
  if (
    queryString["filters[visibility]"] &&
    ["public", "private"].includes(queryString["filters[visibility]"] as string)
  ) {
    next = next.filter(
      (file) => file.visibility === queryString["filters[visibility]"]
    );
  }
  return next;
}

// @ts-ignore
export const getFiles = async (event, userId: string) => {
  const queryString = getQuery(event) as QueryString;
  const params = getRouterParams(event);
  const parentId = (params.id as string) || "root";
  const bucketName = params.bucket as string;
  let list = await fileRepository.listChildren(bucketName, parentId);
  list = list.filter((file) => file.userId === userId);
  list = applyFileFilters(list, queryString);
  const sorted = sortFiles(list, queryString);
  const page = paginate(sorted, queryString);
  return {
    data: await withFavorite(userId, page.data),
    nextPage: page.nextPage,
  };
};

export const getFile = async (
  bucketName: string,
  path: string,
  deletedAt?: Date
) => {
  if (deletedAt) {
    const bucket = await bucketRepository.getByName(bucketName);
    if (!bucket) return null;
    const trash = await fileRepository.listTrash(bucket.userId);
    const match = trash.find(
      (file) =>
        file.bucketName === bucketName &&
        file.path === path &&
        file.deletedAt &&
        Math.abs(file.deletedAt - deletedAt.getTime()) < 1000
    );
    return match ? toApiFile(match) : null;
  }
  const file = await fileRepository.getByPath(bucketName, path);
  return file ? toApiFile(file) : null;
};

export const getFolder = async (id: string) => {
  const file = await fileRepository.get(id);
  return file ? toApiFile(file) : null;
};

export const ensurePath = async (
  bucketName: string,
  fullPath: string,
  userId: string,
  isFile?: boolean
) => {
  fullPath = cleanPath(fullPath);
  const pathSegments = fullPath.split("/");
  if (isFile) pathSegments.pop();
  let current = { id: "root", path: "" };
  if (pathSegments.length > 1) {
    current.path = pathSegments[0];
    for (let i = 1; i < pathSegments.length; i++) {
      current.path = current.path
        ? `${current.path}/${pathSegments[i]}`
        : pathSegments[i];
      const folderExists = await fileRepository.getByPath(bucketName, current.path);
      if (!folderExists) {
        const folderId = ulid() as string;
        const now = Date.now();
        await fileRepository.create({
          id: folderId,
          name: pathSegments[i],
          path: current.path,
          type: "folder",
          contentType: "folder",
          size: 0,
          visibility: "inherit",
          preview: null,
          dimensions: null,
          count: 0,
          parentId: current.id,
          bucketName,
          userId,
          sharedCount: 0,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
        current.id = folderId;
      } else {
        if (folderExists.type !== "folder") {
          throw createError({
            status: 400,
            message: `Path conflict: '${current.path}' exists but is not a folder`,
          });
        }
        current.id = folderExists.id;
        current.path = folderExists.path;
      }
    }
  }
  return current;
};

export const insertUpdateFile = async (
  bucketName: string,
  parentId: string,
  data: any
) => {
  const { userId } = data;
  const path = cleanPath(data.fullPath);
  const existing = await fileRepository.getByPath(bucketName, path);
  if (existing) {
    return toApiFile(
      await fileRepository.update({
        ...existing,
        size: data.size,
        updatedAt: Date.now(),
      }, existing)
    );
  }
  const parent = await ensurePath(bucketName, path, userId, true);
  const fileType = getFileType(data.contentType);
  const preview = fileType === "image" ? path : null;
  if (preview) {
    await setFolderThumbnail(parent.id, preview);
  }
  const now = Date.now();
  const created = await fileRepository.create({
    id: ulid() as string,
    name: path.split("/").pop() || "",
    path,
    type: fileType,
    size: data.size,
    contentType: data.contentType,
    dimensions: data.dimensions,
    visibility: "inherit",
    preview,
    count: 0,
    userId,
    bucketName,
    parentId: parent.id,
    sharedCount: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
  await updateCount(parent.id);
  return toApiFile(created);
};

export const getParent = async (bucketName: string, id: string) => {
  let parent = { path: bucketName, id: "root" };
  if (id && id !== "root") {
    const folder = await fileRepository.get(id);
    if (folder && folder.type === "folder" && folder.bucketName === bucketName) {
      parent = { path: folder.path, id: folder.id };
    } else {
      throw createError({ status: 404, message: "Folder not found" });
    }
  }
  return parent;
};

export const isParentPublic = async (
  bucketName: string,
  path: string
): Promise<boolean> => {
  const parentPath = path.split("/").slice(0, -1).join("/");
  if (parentPath) {
    const parent = await fileRepository.getByPath(bucketName, parentPath);
    if (parent && parent.visibility === "public") return true;
    if (parent && parent.visibility === "inherit") {
      return await isParentPublic(bucketName, parentPath);
    }
  }
  return false;
};

export const searchFiles = async (bucketName: string, query: string) => {
  const bucket = await bucketRepository.getByName(bucketName);
  if (!bucket) return [];
  const files = await fileRepository.listByUser(bucket.userId);
  const q = query.toLowerCase();
  return files
    .filter(
      (file) =>
        file.bucketName === bucketName &&
        !file.deletedAt &&
        file.name.toLowerCase().includes(q)
    )
    .map((file) => ({
      id: file.id,
      name: file.name,
      path: file.path,
      type: file.type,
    }));
};

export const setFavorite = async (userId: string, fileId: string) => {
  await favoriteRepository.add(userId, fileId);
  return { success: true };
};

export const unsetFavorite = async (userId: string, fileId: string) => {
  await favoriteRepository.remove(userId, fileId);
  return { success: true };
};

export const ensureFile = async (bucketName: string, id: string) => {
  const file = await fileRepository.get(id);
  if (!file || file.bucketName !== bucketName) {
    throw createError({ status: 404, message: "File not found" });
  }
  return toApiFile(file);
};

export const getBreadcrumb = async (bucketName: string, path: string) => {
  if (!path || path === bucketName) return [];
  const pathSegments = path.split("/");
  const pathsToQuery: string[] = [];
  for (let i = 1; i <= pathSegments.length; i++) {
    const currentPath = pathSegments.slice(0, i).join("/");
    if (currentPath && currentPath !== bucketName) pathsToQuery.push(currentPath);
  }
  const ordered = [];
  for (const currentPath of pathsToQuery) {
    const file = await fileRepository.getByPath(bucketName, currentPath);
    if (file) {
      ordered.push({
        id: file.id,
        name: file.name,
        visibility: file.visibility,
      });
    }
  }
  return ordered;
};

export const getFavorites = async (event: any, userId: string) => {
  const queryString = getQuery(event) as QueryString;
  const params = getRouterParams(event);
  const ids = await favoriteRepository.list(userId);
  const files = (await fileRepository.getMany(ids)).filter(
    (file) => file.bucketName === params.bucket && !file.deletedAt
  );
  const sorted = sortFiles(files, queryString);
  const page = paginate(sorted, queryString);
  return {
    data: await withFavorite(userId, page.data),
    nextPage: page.nextPage,
  };
};

export const getSharedWithMe = async (userId: string, queryString: any) => {
  const shares = await shareRepository.listByUser(userId);
  const files = await fileRepository.getMany(shares.map((s) => s.fileId));
  const live = files.filter((file) => !file.deletedAt);
  const sorted = sortFiles(live, queryString);
  const page = paginate(sorted, queryString);
  const shareByFile = new Map(shares.map((s) => [s.fileId, s]));
  return {
    data: page.data.map((file) =>
      toApiFile(file, {
        role: shareByFile.get(file.id)?.role,
        sharedAt: shareByFile.get(file.id)
          ? new Date(shareByFile.get(file.id)!.createdAt)
          : null,
      })
    ),
    nextPage: page.nextPage,
  };
};

export const getPublished = async (event: any, userId: string) => {
  const queryString = getQuery(event) as QueryString;
  const files = (await fileRepository.listByUser(userId)).filter(
    (file) => file.visibility === "public" && !file.deletedAt
  );
  const sorted = sortFiles(files, queryString);
  const page = paginate(sorted, queryString);
  return {
    data: await withFavorite(userId, page.data),
    nextPage: page.nextPage,
  };
};

export const getRecent = async (event: any, userId: string) => {
  const queryString = getQuery(event) as QueryString;
  const files = (await fileRepository.listByUser(userId)).filter(
    (file) => !file.deletedAt
  );
  const sorted = sortFiles(files, { ...queryString, sortBy: "updatedAt", order: "desc" });
  const page = paginate(sorted, queryString);
  return {
    data: await withFavorite(userId, page.data),
    nextPage: page.nextPage,
  };
};

export const setVisibility = async (bucketName: string, data: IFile) => {
  const file = await fileRepository.get(data.id);
  if (file && file.bucketName === bucketName) {
    await fileRepository.update({ ...file, visibility: data.visibility }, file);
    return { success: true };
  }
  return { success: false };
};

export const shareFiles = async (
  bucketName: string,
  files: IFile[],
  members: Member[]
) => {
  for (const file of files) {
    await ensureFile(bucketName, file.id);
    const record = await fileRepository.get(file.id);
    if (!record) continue;
    for (const member of members) {
      const user = await userRepository.getByEmail(member.email);
      if (!user) continue;
      await shareRepository.create({
        fileId: file.id,
        userId: user.id,
        role: member.role || "viewer",
        createdAt: Date.now(),
      });
    }
    const shares = await shareRepository.listByFile(file.id);
    await fileRepository.update({ ...record, sharedCount: shares.length }, record);
  }
  return { success: true };
};

export const getNestedFolders = async (bucketName: string, userId: string) => {
  const folders = (await fileRepository.listByUser(userId)).filter(
    (file) =>
      file.bucketName === bucketName && file.type === "folder" && !file.deletedAt
  );
  if (folders.length > 0) return makeNested(folders, "root");
  return [];
};

export const makeNested = (list: FileRecord[], parentId: string): any[] => {
  return list
    .filter((item) => item.parentId === parentId)
    .map((item) => ({
      id: item.id,
      path: item.path,
      label: item.name,
      icon: "lucide:folder",
      children: makeNested(list, item.id),
    }));
};

export const updateContentType = async (id: string, contentType: string) => {
  const file = await fileRepository.get(id);
  if (!file) return;
  return fileRepository.update({ ...file, contentType }, file);
};

export const getComputedVisibility = async (bucketName: string, file: any) => {
  if (file.visibility && file.visibility !== "inherit") return file.visibility;
  if (file.parentId === "root") return "private";
  const folderPath = file.path.split("/").slice(0, -1).join("/");
  const breadcrumb = await getBreadcrumb(bucketName, folderPath);
  return getVisibility(breadcrumb, file.visibility);
};

export const transformList = async (bucketName: string, files: any) => {
  const data = await Promise.all(
    files.data.map(async (file: any) => ({
      ...file,
      visibility: await getComputedVisibility(bucketName, file),
    }))
  );
  return { data, nextPage: files.nextPage };
};

export const setFolderThumbnail = async (id: string, previewUrl: string) => {
  if (id === "root") return;
  const folder = await fileRepository.get(id);
  if (folder && folder.type === "folder") {
    let previews: string[] = [];
    if (folder.preview) {
      try {
        const parsed = JSON.parse(folder.preview);
        if (Array.isArray(parsed)) previews = parsed;
      } catch {
        previews = [];
      }
    }
    if (!previews.includes(previewUrl) && previews.length < 4) {
      previews.push(previewUrl);
      await fileRepository.update(
        { ...folder, preview: JSON.stringify(previews) },
        folder
      );
    }
  }
};

export const updateCount = async (id: string) => {
  if (id === "root") return;
  const folder = await fileRepository.get(id);
  if (!folder) return;
  await fileRepository.update({ ...folder, count: (folder.count || 0) + 1 }, folder);
};

export const getFilesRecursive = async (bucketName: string, items: string[]) => {
  return fileRepository.listRecursiveIds(bucketName, items);
};

export const deleteFiles = async (bucketName: string, items: string[]) => {
  const deletedAt = Date.now();
  const allIds = await getFilesRecursive(bucketName, items);
  const records = await fileRepository.getMany(allIds);
  await Promise.all(
    records.map(async (item) => {
      if (item.deletedAt) return;
      await fileRepository.update({ ...item, deletedAt }, item);
      if (item.type !== "folder") {
        await moveBlob(
          item.path,
          `.trash/${bucketName}/${new Date(deletedAt).toISOString()}/${item.path}`
        );
      }
    })
  );
  return { success: true, deleted: allIds.length };
};

export const getTrashed = async (event: any, userId: string) => {
  const queryString = getQuery(event) as QueryString;
  const files = await fileRepository.listTrash(userId);
  const sorted = [...files].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
  const page = paginate(sorted, queryString);
  return {
    data: page.data.map((file) => toApiFile(file)),
    nextPage: page.nextPage,
  };
};

async function rewriteDescendants(
  file: FileRecord,
  oldPath: string,
  newPath: string
) {
  const ids = await fileRepository.listRecursiveIds(file.bucketName, [file.id]);
  const records = await fileRepository.getMany(ids);
  for (const child of records) {
    if (child.id === file.id) continue;
    if (!child.path.startsWith(oldPath + "/") && child.path !== oldPath) continue;
    const nextPath = newPath + child.path.slice(oldPath.length);
    const previousPath = child.path;
    await fileRepository.update({ ...child, path: nextPath }, child);
    if (child.type !== "folder") {
      await moveBlob(previousPath, nextPath);
    }
  }
}

export const renameFile = async (
  bucketName: string,
  fileId: string,
  name: string
) => {
  const file = await fileRepository.get(fileId);
  if (!file || file.bucketName !== bucketName) {
    throw createError({ status: 404, message: "File not found" });
  }
  const parentPath = file.path.split("/").slice(0, -1).join("/");
  const newPath = parentPath ? `${parentPath}/${name}` : name;
  const conflict = await fileRepository.getByPath(bucketName, newPath);
  if (conflict && conflict.id !== file.id) {
    throw createError({ status: 400, message: "Name already exists" });
  }
  const oldPath = file.path;
  if (file.type !== "folder") {
    await moveBlob(oldPath, newPath);
  }
  await fileRepository.update({ ...file, name, path: newPath }, file);
  if (file.type === "folder") {
    await rewriteDescendants(file, oldPath, newPath);
  }
  return { success: true };
};

export const moveFile = async (
  bucketName: string,
  fileId: string,
  parentId: string
) => {
  const file = await fileRepository.get(fileId);
  if (!file || file.bucketName !== bucketName) {
    throw createError({ status: 404, message: "File not found" });
  }
  const parent = await getParent(bucketName, parentId);
  const newPath = cleanPath(`${parent.path}/${file.name}`);
  if (newPath === file.path) return { success: true };
  const conflict = await fileRepository.getByPath(bucketName, newPath);
  if (conflict) {
    throw createError({ status: 400, message: "Target already exists" });
  }
  const oldPath = file.path;
  if (file.type !== "folder") {
    await moveBlob(oldPath, newPath);
  }
  await fileRepository.update(
    { ...file, parentId: parent.id, path: newPath },
    file
  );
  if (file.type === "folder") {
    await rewriteDescendants({ ...file, parentId: parent.id, path: newPath }, oldPath, newPath);
  }
  return { success: true };
};

export const copyFileItem = async (
  bucketName: string,
  fileId: string,
  name: string
) => {
  const file = await fileRepository.get(fileId);
  if (!file || file.bucketName !== bucketName) {
    throw createError({ status: 404, message: "File not found" });
  }
  const parentPath = file.path.split("/").slice(0, -1).join("/");
  const newPath = parentPath ? `${parentPath}/${name}` : name;
  const conflict = await fileRepository.getByPath(bucketName, newPath);
  if (conflict) {
    throw createError({ status: 400, message: "Name already exists" });
  }
  if (file.type !== "folder") {
    await copyBlob(file.path, newPath);
  }
  const now = Date.now();
  const created = await fileRepository.create({
    ...file,
    id: ulid() as string,
    name,
    path: newPath,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    sharedCount: 0,
  });
  await updateCount(file.parentId);
  return toApiFile(created);
};
