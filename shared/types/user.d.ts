type CreateUserType = {
  id: string;
  name: string;
  locale?: "en" | "zh-CN" | null;
  createdAt: Date;
};

type UserParams = {
  name: string;
};
