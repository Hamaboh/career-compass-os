import type { AccessBinding, AiBinding, AppBindings } from "./bindings";

const disabledAccess: AccessBinding = {
  async verify() {
    return null;
  },
};
const disabledAi: AiBinding = {
  async propose() {
    throw new Error("External AI is disabled in Implementation 0");
  },
};

export function createFakeBindings(): AppBindings {
  return {
    APP_ENV: "ci",
    DB: {
      prepare: () => {
        throw new Error("Fake D1 does not execute queries");
      },
    },
    PRIVATE_FILES: {
      async get() {
        return null;
      },
      async put() {
        throw new Error("Fake R2 is read-only");
      },
      async delete() {
        /* synthetic no-op */
      },
    },
    ACCESS: disabledAccess,
    AI: disabledAi,
  };
}
