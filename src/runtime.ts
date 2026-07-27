import type { Event, Plugin, PluginDependencies } from "./plugin.ts";
import {
  BestEffort,
  Mutex,
  RollbackError,
  RollbackHelper,
} from "./synchronization.ts";

export class RuntimeError extends Error {}

export class Runtime implements Plugin {
  // Plugin
  manifest: Readonly<{ name: string }>;
  private sharedDependencies: PluginDependencies = {
    emitter: this,
  };

  constructor(name?: string) {
    this.manifest = {
      name: name ?? crypto.randomUUID(),
    };
  }

  // Registrations
  private registrationNames: Set<string> = new Set();
  private plugins: Plugin[] = [];

  getRegistrationNames = () => this.plugins.map((r) => r.manifest.name);

  register(plugin: Plugin): boolean {
    if (this.registrationNames.has(plugin.manifest.name)) {
      return false;
    }
    this.registrationNames.add(plugin.manifest.name);
    this.plugins.push(plugin);
    plugin.setDependencies(this.sharedDependencies);
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

  setDependencies(dependencies: PluginDependencies): void {
    this.sharedDependencies = dependencies;
    for (const plugin of this.plugins) {
      plugin.setDependencies(dependencies);
    }
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
    | "terminated" = "uninitialized";
  private stateLock: Mutex = new Mutex();

  private faulted: boolean = false;

  isFaulted(): boolean {
    return this.faulted === true;
  }

  resetFault() {
    this.faulted = false;
  }

  isInitialized(): boolean {
    if (this.isFaulted()) {
      return false;
    }
    return (
      this.state === "inactive" ||
      this.state === "starting" ||
      this.state === "running" ||
      this.state === "stopping"
    );
  }

  isStarted(): boolean {
    if (this.isFaulted()) {
      return false;
    }
    return this.state === "running";
  }

  private async changeState(desiredState: typeof this.state): Promise<void> {
    const unlock = await this.stateLock.lock();
    if (this.faulted === true) {
      throw new RuntimeError(
        "Runtime system is faulted, and cannot make changes.",
      );
    }
    try {
      while (this.state !== desiredState) {
        switch (this.state) {
          case "uninitialized":
            if (desiredState === "terminated") {
              this.state = "terminating";
              try {
                await BestEffort<Plugin>(
                  this.plugins.toReversed(),
                  (value) => value.terminate(),
                  (value) => value.manifest.name,
                );
              } catch (e) {
                this.faulted = true;
                throw e;
              } finally {
                this.state = "terminated";
              }
              break;
            } else {
              this.state = "initializing";
              try {
                const helper = new RollbackHelper<Plugin>(
                  (value) => value.initialize(),
                  (value) => value.terminate(),
                  (value) => value.manifest.name,
                );
                await helper.run(this.plugins);
                this.state = "inactive";
              } catch (error) {
                this.state = "uninitialized";
                if (error instanceof RollbackError) {
                  this.faulted = true;
                }
                throw error;
              }
              break;
            }
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
                this.state = "inactive";
                if (error instanceof RollbackError) {
                  this.faulted = true;
                }
                throw error;
              }
              break;
            } else {
              this.state = "terminating";
              try {
                await BestEffort<Plugin>(
                  this.plugins.toReversed(),
                  (value) => value.terminate(),
                  (value) => value.manifest.name,
                );
              } catch (e) {
                this.faulted = true;
                throw e;
              } finally {
                this.state = "terminated";
              }
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
              this.faulted = true;
              throw e;
            } finally {
              this.state = "inactive";
            }
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
        }
      }
    } finally {
      unlock();
    }
  }

  async initialize(): Promise<void> {
    return this.changeState("inactive");
  }

  async terminate(): Promise<void> {
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

  onEvent(event: Event): void {
    this.emit(event);
  }
}
