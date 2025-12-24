import { Empty, EmptyRequest } from "@shared/proto/cline/common"
import { getRequestRegistry, StreamingResponseHandler } from "../grpc-handler"
import { Controller } from "../index"

// Keep track of the active haiBuildTaskListClicked subscription (singleton pattern)
let activeHaiBuildTaskListClickedSubscription: StreamingResponseHandler<Empty> | undefined

/**
 * Subscribe to haiBuildTaskListClicked events
 * @param controller The controller instance
 * @param request The empty request
 * @param responseStream The streaming response handler
 * @param requestId The ID of the request (passed by the gRPC handler)
 */
export async function subscribeToHaiBuildTaskListClicked(
	_controller: Controller,
	_request: EmptyRequest,
	responseStream: StreamingResponseHandler<Empty>,
	requestId?: string,
): Promise<void> {
	console.log(`[DEBUG] set up haiBuildTaskListClicked subscription`)

	// Set the active subscription
	activeHaiBuildTaskListClickedSubscription = responseStream

	// Register cleanup when the connection is closed
	const cleanup = () => {
		activeHaiBuildTaskListClickedSubscription = undefined
	}

	// Register the cleanup function with the request registry if we have a requestId
	if (requestId) {
		getRequestRegistry().registerRequest(requestId, cleanup, { type: "haiBuildTaskListClicked_subscription" }, responseStream)
	}
}

/**
 * Send a haiBuildTaskListClicked event to the active subscription
 */
export async function sendHaiBuildTaskListClickedEvent(): Promise<void> {
	// Get the active subscription
	const responseStream = activeHaiBuildTaskListClickedSubscription

	if (!responseStream) {
		console.error(`[DEBUG] No active haiBuildTaskListClicked subscription`)
		return
	}

	try {
		const event = Empty.create({})
		await responseStream(
			event,
			false, // Not the last message
		)
	} catch (error) {
		console.error(`Error sending haiBuildTaskListClicked event:`, error)
		// Remove the subscription if there was an error
		activeHaiBuildTaskListClickedSubscription = undefined
	}
}
