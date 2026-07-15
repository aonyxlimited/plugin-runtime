import type { Plugin } from "./plugin.ts";

type RuntimeRegistration = {
  plugin: Plugin;
};

export class Runtime {
  private registrationNames: Set<string> = new Set();
  private registrations: RuntimeRegistration[] = [];

  register(registration: RuntimeRegistration): boolean {
    if (this.registrationNames.has(registration.plugin.manifest.name)) {
      return false;
    }
    this.registrationNames.add(registration.plugin.manifest.name);
    this.registrations.push(registration);
    return true;
  }

  unregister(registrationName: string): boolean {
    if (!this.registrationNames.has(registrationName)) {
      return false;
    }

    const index = this.registrations.findIndex(
      (val) => val.plugin.manifest.name === registrationName,
    );

    if (index === -1) {
      return false;
    }

    this.registrationNames.delete(registrationName);
    this.registrations.splice(index, 1);

    return true;
  }

  async initialize(): Promise<void> {
    for (const registration of this.registrations) {
      await registration.plugin.initialize();
    }
  }

  async deinitialize(): Promise<void> {
    for (const registration of this.registrations.toReversed()) {
      await registration.plugin.deinitialize();
    }
  }

  async start(): Promise<void> {
    for (const registration of this.registrations) {
      await registration.plugin.start();
    }
  }

  async stop(): Promise<void> {
    for (const registration of this.registrations.toReversed()) {
      await registration.plugin.stop();
    }
  }
}
