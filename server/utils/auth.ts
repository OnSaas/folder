import { createUser, getUserByEmail } from "./db";
import { tError } from "./i18n";

export const uuid = () => crypto.randomUUID();

export const authHandler = async ({
  name,
  email,
  provider,
  avatar,
}: UserParams) => {
  const event = useEvent();
  const { auth: authConfig } = useAppConfig();
  if (!authConfig.providers.includes(provider)) {
    throw createError({
      message: tError(event, "auth.providerNotAllowed"),
      status: 403,
    });
  }
  if (!email) {
    throw createError({
      message: tError(event, "auth.emailRequired"),
      status: 400,
    });
  }
  if (authConfig.emails.length && !authConfig.emails.includes(email)) {
    throw createError({
      message: tError(event, "auth.emailNotAllowed"),
      status: 403,
    });
  }
  const domain = email.split("@")[1];
  if (authConfig.domains.length && !authConfig.domains.includes(domain)) {
    throw createError({
      message: tError(event, "auth.emailNotAllowed"),
      status: 403,
    });
  }
  const registeredUser = await getUserByEmail(email);
  if (registeredUser) {
    if (registeredUser.status !== "active") {
      throw createError({
        message: tError(event, "auth.userInactive"),
        status: 403,
      });
    }
    return registeredUser;
  } else {
    if (!authConfig.allowSignup) {
      throw createError({
        message: tError(event, "auth.signupNotAllowed"),
        status: 403,
      });
    }
    const newUser: CreateUserType = {
      id: uuid(),
      name,
      email,
      provider,
      avatar,
      createdAt: new Date(),
    };
    await createUser(newUser);
    return newUser;
  }
};
