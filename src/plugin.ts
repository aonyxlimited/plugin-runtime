interface EventEmitter {
  emit(event: unknown): void;
}

export type PluginDependencies = {
  emitter: EventEmitter;
};

type Manifest = Readonly<{
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
  initialize(): Promise<void>;
  deinitialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  onEvent(event: Event): void;
};
