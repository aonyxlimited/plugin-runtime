import type { Event, Plugin, PluginDependencies } from "./plugin.ts";
import {
  BestEffort,
  Mutex,
  RollbackError,
  RollbackHelper,
} from "./synchronization.ts";

export class Runtime {
  // Registrations
  private registrationNames: Set<string> = new Set();
  private plugins: Plugin[] = [];

  getRegistrationNames = () => this.plugins.map((r) => r.manifest.name);

  private sharedDependencies: PluginDependencies = {
    emitter: this,
  };

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

  // Lifecycles

  private state:
    | "uninitialized"
    | "initializing"
    | "inactive"
    | "starting"
    | "running"
    | "stopping"
    | "terminating"
    | "terminated"
    | "faulted" = "uninitialized";
  private stateLock: Mutex = new Mutex();

  isInitialized = () => {
    return (
      this.state === "inactive" ||
      this.state === "starting" ||
      this.state === "running" ||
      this.state === "stopping"
    );
  };

  isStarted = () => {
    return this.state === "running";
  };

  private async changeState(desiredState: typeof this.state): Promise<void> {
    const unlock = await this.stateLock.lock();
    try {
      while (this.state !== desiredState) {
        switch (this.state) {
          case "uninitialized":
            if (desiredState === "terminated") {
              this.state = "terminated";
              break;
            }
            this.state = "initializing";
            try {
              const helper = new RollbackHelper<Plugin>(
                (value) => value.initialize(),
                (value) => value.deinitialize(),
                (value) => value.manifest.name,
              );
              await helper.run(this.plugins);
              this.state = "inactive";
            } catch (error) {
              if (error instanceof RollbackError) {
                this.state = "faulted";
              } else {
                this.state = "uninitialized";
              }
              throw error;
            }
            break;
          case "inactive":
            if (desiredState !== "terminated") {
              this.state = "starting";
              try {
                const helper = new RollbackHelper<Plugin>(
                  (value) => value.start(),
                  (value) => value.stop(),
                  (value) => value.manifest.name,
                );
                await helper.run(this.plugins);
                this.state = "running";
              } catch (error) {
                if (error instanceof RollbackError) {
                  this.state = "faulted";
                } else {
                  this.state = "inactive";
                }
                throw error;
              }
              break;
            } else {
              this.state = "terminating";
              try {
                await BestEffort<Plugin>(
                  this.plugins.toReversed(),
                  (value) => value.deinitialize(),
                  (value) => value.manifest.name,
                );
              } catch (e) {
                this.state = "faulted";
                throw e;
              }
              this.state = "terminated";
              break;
            }
          case "running":
            this.state = "stopping";
            try {
              await BestEffort<Plugin>(
                this.plugins.toReversed(),
                (value) => value.stop(),
                (value) => value.manifest.name,
              );
            } catch (e) {
              this.state = "faulted";
              throw e;
            }
            this.state = "inactive";
            break;
          case "initializing":
          case "starting":
          case "stopping":
          case "terminating":
            throw new Error(
              `Invalid state: ${this.state}. Lifecycle may have failed.`,
            );
          case "terminated":
            throw new Error(
              "Runtime system is terminated, and will not make changes.",
            );
          case "faulted":
            throw new Error(
              "Runtime system is faulted, and cannot make changes.",
            );
        }
      }
    } finally {
      unlock();
    }
  }

  async initialize(): Promise<void> {
    return this.changeState("inactive");
  }

  async deinitialize(): Promise<void> {
    return this.changeState("terminated");
  }

  async start(): Promise<void> {
    return this.changeState("running");
  }

  async stop(): Promise<void> {
    return this.changeState("inactive");
  }

  // Events

  private events: Event[] = [];
  private isEmitting: boolean = false;

  private async emitAll(): Promise<void> {
    if (this.isEmitting) {
      return;
    }
    this.isEmitting = true;
    while (this.events.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: checked by while loop
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
