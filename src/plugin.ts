export type PluginDependencies = {};

export type Manifest = Readonly<{
  name: string;
}>;

export type Event = Readonly<{
  id: string;
  type: string;
  timestamp: number;
  parent: string | null;
  payload: unknown;
}>;

export type Plugin = {
  manifest: Manifest;
  inject(dependencies: PluginDependencies): void;
  onEvent(event: Event): void;
  initialize(): Promise<void>;
  deinitialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};
