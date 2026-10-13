type Bucket = {
  id: string;
  name: string;
  userId: string;
  size?: number;
  count?: number;
};

type FolderBreadcrumb = {
  id: string;
  name: string;
  visibility: "public" | "private" | "inherit";
};
