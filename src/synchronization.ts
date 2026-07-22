export class Deferred<T> {
	private _promise: Promise<T>;
	private resolveCallback!: (value: T | PromiseLike<T>) => void;
	private rejectCallback!: (reason?: unknown) => void;
	constructor() {
		this._promise = new Promise<T>((resolve, reject) => {
			this.resolveCallback = resolve;
			this.rejectCallback = reject;
		});
	}
	promise() {
		return this._promise;
	}
	resolve(value: T | PromiseLike<T>) {
		return this.resolveCallback(value);
	}
	reject(reason?: unknown) {
		return this.rejectCallback(reason);
	}
}

export class Mutex {
	private _deferred: Deferred<void>;

	constructor() {
		this._deferred = new Deferred<void>();
		this._deferred.resolve();
	}

	async lock(): Promise<() => void> {
		const previous = this._deferred;
		const next = new Deferred<void>();
		this._deferred = next;
		await previous.promise();
		return () => {
			return next.resolve();
		};
	}
}

export class RollbackError extends AggregateError {}

export class RollbackHelper<T> {
	private readonly perform: (value: T) => Promise<void>;
	private readonly rollback: (value: T) => Promise<void>;
	private readonly describe?: (value: T) => string;
	constructor(
		perform: (value: T) => Promise<void>,
		rollback: (value: T) => Promise<void>,
		descriptor?: (value: T) => string,
	) {
		this.perform = perform;
		this.rollback = rollback;
		this.describe = descriptor;
	}
	async run(values: readonly T[]): Promise<void> {
		const completedValues: T[] = [];
		for (const value of values) {
			try {
				await this.perform(value);
				completedValues.push(value);
			} catch (performError) {
				const rollbackErrors: unknown[] = [];
				for (const completed of completedValues.toReversed()) {
					try {
						await this.rollback(completed);
					} catch (rollbackError) {
						rollbackErrors.push(rollbackError);
					}
				}
				if (rollbackErrors.length > 0) {
					throw new RollbackError(
						[performError, ...rollbackErrors],
						this.describe
							? `${this.describe(value)} failed. Rollback was not successful`
							: "Rollback not successful",
					);
				}
				throw performError;
			}
		}
	}
}

export async function BestEffort<T>(
	values: readonly T[],
	perform: (value: T) => Promise<void>,
	describe?: (value: T) => string,
): Promise<void> {
	const errors: unknown[] = [];
	const failedDescriptions: string[] = [];
	for (const value of values) {
		try {
			await perform(value);
		} catch (runError) {
			errors.push(runError);
			if (describe) {
				failedDescriptions.push(describe(value));
			}
		}
	}
	if (errors.length > 0) {
		throw new AggregateError(
			errors,
			describe
				? `Failed values: ${failedDescriptions.join(", ")}.`
				: "One or more values failed to run.",
		);
	}
}
