import type { IHaiStory, IHaiTask } from "@shared/hai-task"
import { EmptyRequest } from "@shared/proto/cline/common"
import { HaiStory, HaiTask, HaiTaskDataResponse } from "@shared/proto/cline/ui"
import * as vscode from "vscode"
import { getRequestRegistry, StreamingResponseHandler } from "../grpc-handler"
import { Controller } from "../index"

// Keep track of active HAI task data subscriptions per workspace
const activeHaiTaskDataSubscriptions = new Map<string, Set<StreamingResponseHandler<HaiTaskDataResponse>>>()

/**
 * Get the current workspace ID
 */
function getWorkspaceId(): string {
	return vscode.workspace.workspaceFolders?.[0]?.uri.toString() || "default"
}

/**
 * Subscribe to HAI task data updates
 * @param controller The controller instance
 * @param request The empty request
 * @param responseStream The streaming response handler
 * @param requestId The ID of the request (passed by the gRPC handler)
 */
export async function subscribeToHaiTaskData(
	controller: Controller,
	_request: EmptyRequest,
	responseStream: StreamingResponseHandler<HaiTaskDataResponse>,
	requestId?: string,
): Promise<void> {
	const workspaceId = getWorkspaceId()
	let workspaceSubscriptions = activeHaiTaskDataSubscriptions.get(workspaceId)
	if (!workspaceSubscriptions) {
		workspaceSubscriptions = new Set()
		activeHaiTaskDataSubscriptions.set(workspaceId, workspaceSubscriptions)
	}

	// Add this subscription to the active subscriptions
	workspaceSubscriptions.add(responseStream)

	// Send initial data if available in stateManager
	const haiConfig = controller.stateManager.getWorkspaceStateKey("haiConfig")
	const haiTaskList = controller.stateManager.getWorkspaceStateKey("haiTaskList")

	if (haiConfig && haiTaskList) {
		const protoStories = haiTaskList.map((story) => convertToProtoStory(story))
		const response = HaiTaskDataResponse.create({
			stories: protoStories,
			folderPath: haiConfig.folder,
			timestamp: haiConfig.ts,
		})

		try {
			await responseStream(response, false)
		} catch (error) {
			console.error("Error sending initial HAI task data:", error)
		}
	}

	// Register cleanup when the connection is closed
	const cleanup = () => {
		workspaceSubscriptions?.delete(responseStream)
		if (workspaceSubscriptions?.size === 0) {
			activeHaiTaskDataSubscriptions.delete(workspaceId)
		}
	}

	// Register the cleanup function with the request registry if we have a requestId
	if (requestId) {
		getRequestRegistry().registerRequest(requestId, cleanup, { type: "hai_task_data_subscription" }, responseStream)
	}
}

/**
 * Send HAI task data update to all active subscribers in the current workspace
 * @param data The task data containing stories, folder path, and timestamp
 */
export async function sendHaiTaskDataUpdate(data: {
	stories: IHaiStory[]
	folderPath: string
	timestamp: string
}): Promise<void> {
	const workspaceId = getWorkspaceId()
	const workspaceSubscriptions = activeHaiTaskDataSubscriptions.get(workspaceId)

	if (!workspaceSubscriptions || workspaceSubscriptions.size === 0) {
		return
	}

	// Convert IHaiStory[] to HaiStory[] (proto format)
	const protoStories = data.stories.map((story) => convertToProtoStory(story))

	const response = HaiTaskDataResponse.create({
		stories: protoStories,
		folderPath: data.folderPath,
		timestamp: data.timestamp,
	})

	// Send the event to all active subscribers in THIS workspace
	const promises = Array.from(workspaceSubscriptions).map(async (responseStream) => {
		try {
			await responseStream(
				response,
				false, // Not the last message
			)
		} catch (error) {
			console.error("Error sending HAI task data update:", error)
			// Remove the subscription if there was an error
			workspaceSubscriptions.delete(responseStream)
		}
	})

	await Promise.all(promises)
}

/**
 * Convert IHaiStory to proto HaiStory format
 */
function convertToProtoStory(story: IHaiStory): HaiStory {
	return HaiStory.create({
		id: story.id,
		prdId: story.prdId,
		name: story.name,
		description: story.description,
		storyTicketId: story.storyTicketId || "",
		tasks: story.tasks.map((task) => convertToProtoTask(task)),
	})
}

/**
 * Convert IHaiTask to proto HaiTask format
 */
function convertToProtoTask(task: IHaiTask): HaiTask {
	return HaiTask.create({
		id: task.id,
		list: task.list,
		acceptance: task.acceptance,
		subTaskTicketId: task.subTaskTicketId || "",
		status: task.status,
	})
}
