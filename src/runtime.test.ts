import { expect, test } from "vitest";
import type { Event, Plugin, PluginDependencies } from "./plugin.ts";
import { Runtime } from "./runtime.ts";

test("runtime/create", () => {
	// biome-ignore lint/correctness/noUnusedVariables: unused for testing
	const runtime = new Runtime();
});

test("runtime/register_plugin", () => {
	class InitPluginA implements Plugin {
		manifest = {
			name: "InitPluginA",
		};
		setDependencies(_dependencies: PluginDependencies): void {}
		async initialize(): Promise<void> {}
		async terminate(): Promise<void> {}
		async start(): Promise<void> {}
		async stop(): Promise<void> {}
		onEvent(_event: Event): void {}
	}

	class InitPluginB extends InitPluginA {
		manifest = {
			name: "InitPluginB",
		};
	}

	class InitPluginC extends InitPluginA {
		manifest = {
			name: "InitPluginC",
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
	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginA",
		"InitPluginB",
	]);
	runtime.register(pluginC);
	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);

	runtime.unregister(pluginC.manifest.name);
	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginA",
		"InitPluginB",
	]);
	runtime.unregister(pluginB.manifest.name);
	expect(runtime.getRegistrationNames()).toEqual(["InitPluginA"]);
	runtime.unregister(pluginA.manifest.name);
	expect(runtime.getRegistrationNames()).toEqual([]);

	expect(runtime.getRegistrationNames()).toEqual([]);
	runtime.register(pluginC);
	expect(runtime.getRegistrationNames()).toEqual(["InitPluginC"]);
	runtime.register(pluginB);
	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginC",
		"InitPluginB",
	]);
	runtime.register(pluginA);
	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginC",
		"InitPluginB",
		"InitPluginA",
	]);

	runtime.unregister(pluginB.manifest.name);
	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginC",
		"InitPluginA",
	]);
	runtime.unregister(pluginC.manifest.name);
	expect(runtime.getRegistrationNames()).toEqual(["InitPluginA"]);
	runtime.unregister(pluginA.manifest.name);
	expect(runtime.getRegistrationNames()).toEqual([]);
});

test("runtime/lifecycle", async () => {
	const initializedPluginNames: string[] = [];
	const terminatedPluginNames: string[] = [];
	const startedPluginNames: string[] = [];
	const stoppedPluginNames: string[] = [];

	class InitPluginA implements Plugin {
		manifest = {
			name: "InitPluginA",
		};
		setDependencies(_dependencies: PluginDependencies): void {}
		async initialize(): Promise<void> {
			initializedPluginNames.push(this.manifest.name);
		}
		async terminate(): Promise<void> {
			terminatedPluginNames.push(this.manifest.name);
		}
		async start(): Promise<void> {
			startedPluginNames.push(this.manifest.name);
		}
		async stop(): Promise<void> {
			stoppedPluginNames.push(this.manifest.name);
		}
		onEvent(_event: Event): void {}
	}

	class InitPluginB extends InitPluginA {
		manifest = {
			name: "InitPluginB",
		};
	}

	class InitPluginC extends InitPluginA {
		manifest = {
			name: "InitPluginC",
		};
	}

	const runtime = new Runtime();
	const pluginA = new InitPluginA();
	const pluginB = new InitPluginB();
	const pluginC = new InitPluginC();
	runtime.register(pluginA);
	runtime.register(pluginB);
	runtime.register(pluginC);
	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(false);
	expect(runtime.isStarted()).toBe(false);

	await runtime.initialize();
	expect(initializedPluginNames).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(true);
	expect(runtime.isStarted()).toBe(false);

	await runtime.start();
	expect(startedPluginNames).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(true);
	expect(runtime.isStarted()).toBe(true);

	await runtime.stop();
	expect(stoppedPluginNames).toEqual([
		"InitPluginC",
		"InitPluginB",
		"InitPluginA",
	]);
	expect(runtime.isInitialized()).toBe(true);
	expect(runtime.isStarted()).toBe(false);

	await runtime.start();
	expect(startedPluginNames).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(true);
	expect(runtime.isStarted()).toBe(true);

	await runtime.stop();
	expect(stoppedPluginNames).toEqual([
		"InitPluginC",
		"InitPluginB",
		"InitPluginA",
		"InitPluginC",
		"InitPluginB",
		"InitPluginA",
	]);
	expect(runtime.isInitialized()).toBe(true);
	expect(runtime.isStarted()).toBe(false);

	await runtime.terminate();
	expect(terminatedPluginNames).toEqual([
		"InitPluginC",
		"InitPluginB",
		"InitPluginA",
	]);
	expect(runtime.isInitialized()).toBe(false);
	expect(runtime.isStarted()).toBe(false);
});

test("runtime/lifecycle-error-initialize", async () => {
	const initializedPluginNames: string[] = [];
	const terminatedPluginNames: string[] = [];
	const startedPluginNames: string[] = [];
	const stoppedPluginNames: string[] = [];

	class InitPluginA implements Plugin {
		manifest = {
			name: "InitPluginA",
		};
		setDependencies(_dependencies: PluginDependencies): void {}
		async initialize(): Promise<void> {
			initializedPluginNames.push(this.manifest.name);
		}
		async terminate(): Promise<void> {
			terminatedPluginNames.push(this.manifest.name);
		}
		async start(): Promise<void> {
			startedPluginNames.push(this.manifest.name);
		}
		async stop(): Promise<void> {
			stoppedPluginNames.push(this.manifest.name);
		}
		onEvent(_event: Event): void {}
	}

	class TestError extends Error {}

	class InitPluginB extends InitPluginA {
		manifest = {
			name: "InitPluginB",
		};
	}

	class InitPluginInitFailer extends InitPluginA {
		manifest = {
			name: "InitPluginC",
		};
		async initialize(): Promise<void> {
			throw new TestError();
		}
	}

	const runtime = new Runtime();
	const pluginA = new InitPluginA();
	const pluginB = new InitPluginB();
	const pluginC = new InitPluginInitFailer();
	runtime.register(pluginA);
	runtime.register(pluginB);
	runtime.register(pluginC);

	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(false);
	expect(runtime.isStarted()).toBe(false);

	try {
		await runtime.initialize();
	} catch (e) {
		expect(e).toBeInstanceOf(TestError);
	}

	expect(initializedPluginNames).toEqual(["InitPluginA", "InitPluginB"]);
	expect(terminatedPluginNames).toEqual(["InitPluginB", "InitPluginA"]);
	expect(runtime.isInitialized()).toBe(false);
	expect(runtime.isStarted()).toBe(false);
});

test("runtime/lifecycle-error-initialize-refail", async () => {
	const initializedPluginNames: string[] = [];
	const terminatedPluginNames: string[] = [];
	const startedPluginNames: string[] = [];
	const stoppedPluginNames: string[] = [];

	class InitPluginA implements Plugin {
		manifest = {
			name: "InitPluginA",
		};
		setDependencies(_dependencies: PluginDependencies): void {}
		async initialize(): Promise<void> {
			initializedPluginNames.push(this.manifest.name);
		}
		async terminate(): Promise<void> {
			terminatedPluginNames.push(this.manifest.name);
		}
		async start(): Promise<void> {
			startedPluginNames.push(this.manifest.name);
		}
		async stop(): Promise<void> {
			stoppedPluginNames.push(this.manifest.name);
		}
		onEvent(_event: Event): void {}
	}

	class TestError extends Error {}

	class InitPluginB extends InitPluginA {
		manifest = {
			name: "InitPluginB",
		};
		async terminate(): Promise<void> {
			throw new TestError();
		}
	}

	class InitPluginInitFailer extends InitPluginA {
		manifest = {
			name: "InitPluginC",
		};
		async initialize(): Promise<void> {
			throw new TestError();
		}
	}

	const runtime = new Runtime();
	const pluginA = new InitPluginA();
	const pluginB = new InitPluginB();
	const pluginC = new InitPluginInitFailer();
	runtime.register(pluginA);
	runtime.register(pluginB);
	runtime.register(pluginC);

	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(false);
	expect(runtime.isStarted()).toBe(false);

	try {
		await runtime.initialize();
	} catch (e) {
		expect(e).toBeInstanceOf(AggregateError);
	}

	expect(initializedPluginNames).toEqual(["InitPluginA", "InitPluginB"]);
	expect(terminatedPluginNames).toEqual(["InitPluginA"]);
	expect(runtime.isInitialized()).toBe(false);
	expect(runtime.isStarted()).toBe(false);
	expect(runtime.isFaulted()).toBe(true);
});

test("runtime/lifecycle-error-start", async () => {
	const initializedPluginNames: string[] = [];
	const terminatedPluginNames: string[] = [];
	const startedPluginNames: string[] = [];
	const stoppedPluginNames: string[] = [];

	class InitPluginA implements Plugin {
		manifest = {
			name: "InitPluginA",
		};
		setDependencies(_dependencies: PluginDependencies): void {}
		async initialize(): Promise<void> {
			initializedPluginNames.push(this.manifest.name);
		}
		async terminate(): Promise<void> {
			terminatedPluginNames.push(this.manifest.name);
		}
		async start(): Promise<void> {
			startedPluginNames.push(this.manifest.name);
		}
		async stop(): Promise<void> {
			stoppedPluginNames.push(this.manifest.name);
		}
		onEvent(_event: Event): void {}
	}

	class TestError extends Error {}

	class InitPluginB extends InitPluginA {
		manifest = {
			name: "InitPluginB",
		};
	}

	class InitPluginStartFailer extends InitPluginA {
		manifest = {
			name: "InitPluginC",
		};
		async start(): Promise<void> {
			throw new TestError();
		}
	}

	const runtime = new Runtime();
	const pluginA = new InitPluginA();
	const pluginB = new InitPluginB();
	const pluginC = new InitPluginStartFailer();
	runtime.register(pluginA);
	runtime.register(pluginB);
	runtime.register(pluginC);

	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(false);
	expect(runtime.isStarted()).toBe(false);

	await runtime.initialize();

	expect(initializedPluginNames).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(true);
	expect(runtime.isStarted()).toBe(false);

	try {
		await runtime.start();
	} catch (e) {
		expect(e).toBeInstanceOf(TestError);
	}

	expect(startedPluginNames).toEqual(["InitPluginA", "InitPluginB"]);
	expect(stoppedPluginNames).toEqual(["InitPluginB", "InitPluginA"]);
	expect(runtime.isInitialized()).toBe(true);
	expect(runtime.isStarted()).toBe(false);
});

test("runtime/lifecycle-error-start-refail", async () => {
	const initializedPluginNames: string[] = [];
	const terminatedPluginNames: string[] = [];
	const startedPluginNames: string[] = [];
	const stoppedPluginNames: string[] = [];

	class InitPluginA implements Plugin {
		manifest = {
			name: "InitPluginA",
		};
		setDependencies(_dependencies: PluginDependencies): void {}
		async initialize(): Promise<void> {
			initializedPluginNames.push(this.manifest.name);
		}
		async terminate(): Promise<void> {
			terminatedPluginNames.push(this.manifest.name);
		}
		async start(): Promise<void> {
			startedPluginNames.push(this.manifest.name);
		}
		async stop(): Promise<void> {
			stoppedPluginNames.push(this.manifest.name);
		}
		onEvent(_event: Event): void {}
	}

	class TestError extends Error {}

	class InitPluginB extends InitPluginA {
		manifest = {
			name: "InitPluginB",
		};
		async stop(): Promise<void> {
			throw new TestError();
		}
	}

	class InitPluginStartFailer extends InitPluginA {
		manifest = {
			name: "InitPluginC",
		};
		async start(): Promise<void> {
			throw new TestError();
		}
	}

	const runtime = new Runtime();
	const pluginA = new InitPluginA();
	const pluginB = new InitPluginB();
	const pluginC = new InitPluginStartFailer();
	runtime.register(pluginA);
	runtime.register(pluginB);
	runtime.register(pluginC);

	expect(runtime.getRegistrationNames()).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(false);
	expect(runtime.isStarted()).toBe(false);

	await runtime.initialize();

	expect(initializedPluginNames).toEqual([
		"InitPluginA",
		"InitPluginB",
		"InitPluginC",
	]);
	expect(runtime.isInitialized()).toBe(true);
	expect(runtime.isStarted()).toBe(false);

	try {
		await runtime.start();
	} catch (e) {
		expect(e).toBeInstanceOf(AggregateError);
	}

	expect(startedPluginNames).toEqual(["InitPluginA", "InitPluginB"]);
	expect(stoppedPluginNames).toEqual(["InitPluginA"]);
	expect(runtime.isInitialized()).toBe(false);
	expect(runtime.isStarted()).toBe(false);
	expect(runtime.isFaulted()).toBe(true);
});
