declare module "#auth-utils" {
  interface User {
    id: string;
    name: string;
    locale?: "en" | "zh-CN" | null;
  }
  interface UserSession {
    pwdFp?: string;
  }
}

export {};
