import { Langfuse, LangfuseTraceClient } from "langfuse"
import type { ClineAccountUserInfo } from "../../auth/AuthService"
import type { ITelemetryProvider, TelemetryProperties, TelemetrySettings } from "./ITelemetryProvider"

/**
 * Langfuse telemetry provider implementation
 * Handles sending telemetry events to Langfuse
 */
export class LangfuseProvider implements ITelemetryProvider {
	private langfuse: Langfuse
	private traceClient?: LangfuseTraceClient
	private enabled: boolean = false
	private userId?: string
	private distinctId?: string

	constructor(
		private apiKey: string,
		private publicKey: string,
		private baseUrl?: string,
	) {
		this.langfuse = new Langfuse({
			secretKey: apiKey,
			publicKey,
			baseUrl,
			requestTimeout: 10000,
			enabled: true,
		})
		// Create a root trace for non-task events
		this.traceClient = this.langfuse.trace({
			id: "root",
			name: "hai-extension",
			timestamp: new Date(),
		})
	}

	public log(event: string, properties?: TelemetryProperties): void {
		if (!this.enabled) return

		try {
			// Handle conversation turn events specially to track model usage
			if (event === "task.conversation_turn" && properties) {
				const { tokensIn, tokensOut, model, provider, totalCost } = properties
				if (tokensIn !== undefined || tokensOut !== undefined) {
					this.traceClient?.generation({
						name: event,
						model: (model as string) || "unknown",
						modelParameters: {
							provider: (provider as string) || "unknown",
						},
						usage: {
							input: (tokensIn as number) || 0,
							output: (tokensOut as number) || 0,
							total: ((tokensIn as number) || 0) + ((tokensOut as number) || 0),
							totalCost: (totalCost as number) || 0,
						},
						metadata: {
							...properties,
							userId: this.userId,
						},
					})
					return
				}
			}

			// For all other events, use regular event tracking
			this.traceClient?.event({
				name: event,
				metadata: {
					...properties,
					userId: this.userId,
				},
			})
		} catch (error) {
			console.error("[LangfuseProvider] Failed to log event:", error)
		}
	}

	public logRequired(event: string, properties?: TelemetryProperties): void {
		try {
			this.traceClient?.event({
				name: event,
				metadata: {
					...properties,
					userId: this.userId,
				},
			})
		} catch (error) {
			console.error("[LangfuseProvider] Failed to log required event:", error)
		}
	}

	public identifyUser(userInfo: ClineAccountUserInfo, properties?: TelemetryProperties): void {
		this.userId = userInfo.id
		if (this.traceClient) {
			this.traceClient.update({
				userId: userInfo.id,
				metadata: {
					...properties,
					email: userInfo.email,
					displayName: userInfo.displayName,
				},
			})
		}
	}

	public setOptIn(optIn: boolean): void {
		this.enabled = optIn
	}

	public isEnabled(): boolean {
		return this.enabled
	}

	public getSettings(): TelemetrySettings {
		return {
			extensionEnabled: this.enabled,
			hostEnabled: true,
			level: this.enabled ? "all" : "off",
		}
	}

	public name(): string {
		return "langfuse"
	}

	public recordCounter(
		name: string,
		value: number,
		attributes?: TelemetryProperties,
		description?: string,
		required?: boolean,
	): void {
		if (!this.enabled && !required) return

		if (this.traceClient) {
			this.traceClient.score({
				name,
				value,
				metadata: {
					...attributes,
					userId: this.userId,
				},
			})
		}
	}

	public recordHistogram(
		name: string,
		value: number,
		attributes?: TelemetryProperties,
		description?: string,
		required?: boolean,
	): void {
		if (!this.enabled && !required) return

		if (this.traceClient) {
			this.traceClient.score({
				name,
				value,
				metadata: {
					...attributes,
					type: "histogram",
					userId: this.userId,
				},
			})
		}
	}

	public recordGauge(
		name: string,
		value: number | null,
		attributes?: TelemetryProperties,
		description?: string,
		required?: boolean,
	): void {
		if (!this.enabled && !required) return
		if (value === null) return

		if (this.traceClient) {
			this.traceClient.score({
				name,
				value,
				metadata: {
					...attributes,
					type: "gauge",
					userId: this.userId,
				},
			})
		}
	}

	public setTraceClient(taskId: string, isNew: boolean = false) {
		try {
			// Start / Re-Create a new trace in Langfuse
			this.traceClient = this.langfuse.trace({
				id: taskId,
				name: "hai-extension",
				sessionId: this.distinctId,
				metadata: {
					user: this.userId,
				},
				...(isNew ? { timestamp: new Date() } : {}),
			})
			console.info(`[LangfuseProvider] Created trace for task ${taskId}`)
		} catch (error) {
			console.error("[LangfuseProvider] Failed to create trace:", error)
		}
	}

	public setDistinctId(distinctId: string) {
		this.distinctId = distinctId
	}

	public async dispose(): Promise<void> {
		// Clean up Langfuse client
		await this.langfuse.shutdownAsync()
	}
}
