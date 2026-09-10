export const keys = {
  user: (id: string) => `user:${id}`,
  userEmail: (email: string) => `idx:user:email:${email.toLowerCase()}`,
  bucket: (id: string) => `bucket:${id}`,
  bucketName: (name: string) => `idx:bucket:name:${name}`,
  userBucket: (userId: string) => `idx:user:${userId}:bucket`,
  userFiles: (userId: string) => `idx:user:${userId}:files`,
  userRoot: (userId: string) => `idx:user:${userId}:root`,
  file: (id: string) => `file:${id}`,
  children: (bucket: string, parentId: string) =>
    `idx:children:${bucket}:${parentId}`,
  path: (bucket: string, path: string) => `idx:path:${bucket}:${path}`,
  favorites: (userId: string) => `idx:favorites:${userId}`,
  share: (id: string) => `share:${id}`,
  sharedUser: (userId: string) => `idx:shared:user:${userId}`,
  sharedFile: (fileId: string) => `idx:shared:file:${fileId}`,
  trash: (userId: string) => `idx:trash:${userId}`,
};
