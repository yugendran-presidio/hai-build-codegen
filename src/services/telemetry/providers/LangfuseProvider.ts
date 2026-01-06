import { Langfuse, LangfuseTraceClient } from "langfuse"
import { ClineAccountUserInfo } from "@/services/auth/AuthService"
import { anthropicModels, bedrockModels, geminiModels, type ModelInfo, vertexModels } from "@/shared/api"
import { getGitUserInfo } from "@/utils/git"
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
		distinctId?: string,
	) {
		// Always ensure we have a session ID
		this.distinctId = distinctId || `${Date.now()}-${Math.random().toString(36).substring(2)}`
		this.langfuse = new Langfuse({
			secretKey: apiKey,
			publicKey,
			baseUrl,
			requestTimeout: 10000,
			enabled: true,
		})
		// Create a root trace for task events
		const rootTraceId = `root-${Date.now()}`
		this.traceClient = this.langfuse.trace({
			id: rootTraceId,
			name: "hai-build-code-generator",
			timestamp: new Date(),
			userId: this.gitUserInfo.username,
			sessionId: this.distinctId,
			metadata: {
				user: this.gitUserInfo.username,
				email: this.gitUserInfo.email,
			},
		} as any) // Temporary type assertion until we fix the types
		this.enabled = true
		console.info(`[LangfuseProvider] Initialized with trace ${rootTraceId}`)
	}

	public log(event: string, properties?: TelemetryProperties): void {
		if (!this.enabled || event !== "task.conversation_turn" || !properties) return

		try {
			const { cacheWriteTokens, cacheReadTokens, totalCost, model, provider } = properties
			if (cacheWriteTokens !== undefined || cacheReadTokens !== undefined) {
				// Get model configuration based on the provider and model name
				const modelId = (model as string) || "unknown"
				const modelProvider = (provider as string) || "unknown"

				let modelConfig: ModelInfo | undefined

				switch (modelProvider) {
					case "bedrock":
						modelConfig = Object.entries(bedrockModels).find(([key]) => modelId.includes(key))?.[1]
						break
					case "anthropic":
						modelConfig = Object.entries(anthropicModels).find(([key]) => modelId.includes(key))?.[1]
						break
					case "vertex":
						modelConfig = Object.entries(vertexModels).find(([key]) => modelId.includes(key))?.[1]
						break
					case "gemini":
						modelConfig = Object.entries(geminiModels).find(([key]) => modelId.includes(key))?.[1]
						break
					default:
						modelConfig = undefined
				}

				this.traceClient?.generation({
					name: event,
					model: modelId,
					userId: this.gitUserInfo.username,
					sessionId: this.distinctId,
					modelParameters: {
						provider: (provider as string) || "unknown",
					},
					usage: {
						input: (cacheWriteTokens as number) || 0,
						output: (cacheReadTokens as number) || 0,
						total: ((cacheWriteTokens as number) || 0) + ((cacheReadTokens as number) || 0),
						totalCost: (totalCost as number) || 0,
					},
					metadata: {
						user: this.gitUserInfo.username,
						email: this.gitUserInfo.email,
						promptVersion: "default",
						cacheWriteTokens: cacheWriteTokens || 0,
						cacheReadTokens: cacheReadTokens || 0,
						totalCost: totalCost || 0,
						apiProvider: provider || "bedrock",
						embeddingProvider: "none",
						maxTokens: modelConfig?.maxTokens || 8192,
						contextWindow: modelConfig?.contextWindow || 200000,
						supportsImages: modelConfig?.supportsImages || false,
						supportsPromptCache: modelConfig?.supportsPromptCache || true,
						inputPrice: modelConfig?.inputPrice || 0.8,
						outputPrice: modelConfig?.outputPrice || 4.0,
						cacheWritesPrice: modelConfig?.cacheWritesPrice || 1.0,
						cacheReadsPrice: modelConfig?.cacheReadsPrice || 0.08,
					},
				} as any) // Temporary type assertion until we fix the types
			}
		} catch (error) {
			console.error("[LangfuseProvider] Failed to log event:", error)
		}
	}

	public logRequired(event: string, properties?: TelemetryProperties): void {
		if (!this.enabled || event !== "task.conversation_turn" || !properties) return

		try {
			this.traceClient?.event({
				name: event,
				userId: this.gitUserInfo.username,
				sessionId: this.distinctId,
				metadata: {
					...properties,
					email: this.gitUserInfo.email,
					user: this.gitUserInfo.username,
				},
			} as any) // Temporary type assertion until we fix the types
		} catch (error) {
			console.error("[LangfuseProvider] Failed to log required event:", error)
		}
	}

	public identifyUser(userInfo?: ClineAccountUserInfo, properties?: TelemetryProperties): void {
		if (!this.enabled || !this.traceClient) return

		try {
			this.traceClient.update({
				userId: this.gitUserInfo.username,
				sessionId: this.distinctId,
				metadata: {
					...properties,
					email: this.gitUserInfo.email,
					displayName: this.gitUserInfo.username,
				},
			} as any) // Temporary type assertion until we fix the types
		} catch (error) {
			console.error("[LangfuseProvider] Failed to identify user:", error)
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

		try {
			this.traceClient?.score({
				name,
				value,
				userId: this.gitUserInfo.username,
				sessionId: this.distinctId,
				metadata: {
					...attributes,
					user: this.gitUserInfo.username,
					email: this.gitUserInfo.email,
				},
			} as any) // Temporary type assertion until we fix the types
		} catch (error) {
			console.error("[LangfuseProvider] Failed to record counter:", error)
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

		try {
			this.traceClient?.score({
				name,
				value,
				userId: this.gitUserInfo.username,
				sessionId: this.distinctId,
				metadata: {
					...attributes,
					type: "histogram",
					userId: this.gitUserInfo.username,
					email: this.gitUserInfo.email,
				},
			} as any) // Temporary type assertion until we fix the types
		} catch (error) {
			console.error("[LangfuseProvider] Failed to record histogram:", error)
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

		try {
			this.traceClient?.score({
				name,
				value,
				userId: this.gitUserInfo.username,
				sessionId: this.distinctId,
				metadata: {
					...attributes,
					type: "gauge",
					userId: this.gitUserInfo.username,
					email: this.gitUserInfo.email,
				},
			} as any) // Temporary type assertion until we fix the types
		} catch (error) {
			console.error("[LangfuseProvider] Failed to record gauge:", error)
		}
	}

	public setTraceClient(taskId: string, isNew: boolean = false) {
		if (!this.enabled || !taskId) return

		try {
			// Start / Re-Create a new trace in Langfuse
			this.traceClient = this.langfuse.trace({
				id: taskId,
				name: "hai-build-code-generator",
				userId: this.gitUserInfo.username,
				sessionId: this.distinctId,
				metadata: {
					user: this.gitUserInfo.username,
					email: this.gitUserInfo.email,
					type: "task",
				},
				...(isNew ? { timestamp: new Date() } : {}),
			} as any) // Temporary type assertion until we fix the types
			console.info(`[LangfuseProvider] Created trace for task ${taskId}`)
		} catch (error) {
			console.error("[LangfuseProvider] Failed to create trace:", error)
		}
	}

	public setDistinctId(distinctId: string) {
		const oldDistinctId = this.distinctId
		this.distinctId = distinctId
		// Update the current trace with the new session ID
		if (this.traceClient && oldDistinctId !== distinctId) {
			// Create a new trace to ensure proper session tracking
			const rootTraceId = `root-${Date.now()}-${Math.random().toString(36).substring(2)}`
			this.traceClient = this.langfuse.trace({
				id: rootTraceId,
				name: "hai-build-code-generator",
				timestamp: new Date(),
				userId: this.gitUserInfo.username,
				sessionId: this.distinctId,
				metadata: {
					user: this.gitUserInfo.username,
					email: this.gitUserInfo.email,
					type: "root",
				},
			} as any)
			console.info(`[LangfuseProvider] Created new trace with updated session ID ${rootTraceId}`)
		}
	}

	public async dispose(): Promise<void> {
		if (!this.enabled) return

		try {
			if (this.traceClient) {
				// Only flush if we have active traces
				await this.langfuse.flushAsync()
				await this.langfuse.shutdownAsync()
				console.info("[LangfuseProvider] Disposed and flushed all events")
			}
		} catch (error) {
			console.error("[LangfuseProvider] Error during dispose:", error)
		}
	}

	// TAG:HAI
	/** Git user information (username and email) for tracking user identity */
	// This is used to identify the user in PostHog and Langfuse
	private readonly gitUserInfo: {
		username: string
		email: string
	} = getGitUserInfo()
}
