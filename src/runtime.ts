import type { Event, Plugin, PluginDependencies } from "./plugin.ts";

export class Runtime {
  private registrationNames: Set<string> = new Set();
  private plugins: Plugin[] = [];
  getRegistrationNames = () => this.plugins.map(r => r.manifest.name);

  private sharedDependencies: PluginDependencies = {
    emitter: this
  };

  private initialized: "deinitialized" | "initializing" | "initialized" | "deinitializing" = "deinitialized"
  isInitialized = () => this.initialized;

  private started: "stopped" | "starting" | "started" | "stopping" = "stopped";
  isStarted = () => this.started;

  private events: Event[] = [];
  private isEmitting: boolean = false;

  register(plugin: Plugin): boolean {
    if (this.registrationNames.has(plugin.manifest.name)) {
      return false;
    }
    this.registrationNames.add(plugin.manifest.name);
    this.plugins.push(plugin);
    plugin.inject(this.sharedDependencies);
    return true;
  }

  unregister(registrationName: string): boolean {
    if (!this.registrationNames.has(registrationName)) {
      return false;
    }

    const index = this.plugins.findIndex(
      (plugin) => plugin.manifest.name === registrationName,
    );

    if (index === -1) {
      return false;
    }

    this.registrationNames.delete(registrationName);
    this.plugins.splice(index, 1);

    return true;
  }

  async initialize(): Promise<void> {
    for (const plugin of this.plugins) {
      await plugin.initialize();
    }
  }

  async deinitialize(): Promise<void> {
    for (const plugin of this.plugins.toReversed()) {
      await plugin.deinitialize();
    }
  }

  async start(): Promise<void> {
    if (this.started === "starting" || this.started === "started") {
      return;
    }

    this.started = "starting";

    for (const plugin of this.plugins) {
      await plugin.start();
    }

    this.started = "started";
  }

  async stop(): Promise<void> {
    if (!this.started)
      for (const registration of this.plugins.toReversed()) {
        await registration.plugin.stop();
      }
  }

  private async emitAll(): Promise<void> {
    if (this.isEmitting) {
      return;
    }
    this.isEmitting = true;
    while (this.events.length > 0) {
      const event = this.events.shift()!;
      await this.emit(event);
    }
    this.isEmitting = false;
  }

  async emit(event: Event): Promise<void> {
    this.events.push(event);
    return this.emitAll();
  }
}
