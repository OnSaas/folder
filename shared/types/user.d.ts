type CreateUserType = {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  provider?: string;
  locale?: "en" | "zh-CN" | null;
  createdAt: Date;
};

type UserParams = {
  name: string;
  email?: string;
  avatar?: string;
  provider?: string;
};
