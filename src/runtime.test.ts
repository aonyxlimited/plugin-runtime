import { expect, test } from 'vitest'
import { Runtime } from './runtime.ts'
import { Plugin, Event, PluginDependencies } from './plugin.ts';


test('runtime/create', () => {
    const runtime = new Runtime();
});

test('runtime/register_plugin', () => {
    class InitPluginA implements Plugin {
        manifest = {
            name: "InitPluginA"
        };
        inject(dependencies: PluginDependencies): void { }
        async initialize(): Promise<void> {
        }
        async deinitialize(): Promise<void> {
        }
        async start(): Promise<void> {
        }
        async stop(): Promise<void> {
        }
        onEvent(event: Event): void { }
    };

    class InitPluginB extends InitPluginA {
        manifest = {
            name: "InitPluginB"
        };
    }

    class InitPluginC extends InitPluginA {
        manifest = {
            name: "InitPluginC"
        };
    }

    const runtime = new Runtime();
    const pluginA = new InitPluginA();
    const pluginB = new InitPluginB();
    const pluginC = new InitPluginC();

    expect(runtime.getRegistrationNames()).toEqual([]);
    runtime.register(pluginA);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginA"]);
    runtime.register(pluginB);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginA", "InitPluginB"]);
    runtime.register(pluginC);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginA", "InitPluginB", "InitPluginC"]);

    runtime.unregister(pluginC.manifest.name);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginA", "InitPluginB"]);
    runtime.unregister(pluginB.manifest.name);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginA"]);
    runtime.unregister(pluginA.manifest.name);
    expect(runtime.getRegistrationNames()).toEqual([]);

    expect(runtime.getRegistrationNames()).toEqual([]);
    runtime.register(pluginC);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginC"]);
    runtime.register(pluginB);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginC", "InitPluginB"]);
    runtime.register(pluginA);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginC", "InitPluginB", "InitPluginA"]);

    runtime.unregister(pluginB.manifest.name);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginC", "InitPluginA"]);
    runtime.unregister(pluginC.manifest.name);
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginA"]);
    runtime.unregister(pluginA.manifest.name);
    expect(runtime.getRegistrationNames()).toEqual([]);
});

test('runtime/init_plugin', async () => {
    const initializedPluginNames: string[] = [];

    class InitPluginA implements Plugin {
        manifest = {
            name: "InitPluginA"
        };
        inject(dependencies: PluginDependencies): void { }
        async initialize(): Promise<void> {
            initializedPluginNames.push(this.manifest.name);
        }
        async deinitialize(): Promise<void> {
        }
        async start(): Promise<void> {
        }
        async stop(): Promise<void> {
        }
        onEvent(event: Event): void { }
    };

    class InitPluginB extends InitPluginA {
        manifest = {
            name: "InitPluginB"
        };
    }

    class InitPluginC extends InitPluginA {
        manifest = {
            name: "InitPluginC"
        };
    }

    const runtime = new Runtime();
    const pluginA = new InitPluginA();
    const pluginB = new InitPluginB();
    const pluginC = new InitPluginC();
    runtime.register(pluginA);
    runtime.register(pluginB);
    runtime.register(pluginC);
    await runtime.initialize();
    expect(runtime.getRegistrationNames()).toEqual(["InitPluginA", "InitPluginB", "InitPluginC"]);
});