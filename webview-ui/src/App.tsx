import { IHaiClineTask, IHaiStory, IHaiTask } from "@shared/hai-task"
import type { Boolean, EmptyRequest } from "@shared/proto/cline/common"
import type { HaiTasksLoadRequest } from "@shared/proto/cline/ui"
import { useCallback, useEffect, useState } from "react"
import AccountView from "./components/account/AccountView"
import ChatView from "./components/chat/ChatView"
import DetailedView from "./components/hai/DetailedView"
import { HaiTasksList } from "./components/hai/hai-tasks-list"
import HistoryView from "./components/history/HistoryView"
import McpView from "./components/mcp/configuration/McpConfigurationView"
import OnboardingView from "./components/onboarding/OnboardingView"
import SettingsView from "./components/settings/SettingsView"
import WelcomeView from "./components/welcome/WelcomeView"
import { useClineAuth } from "./context/ClineAuthContext"
import { useExtensionState } from "./context/ExtensionStateContext"
import { Providers } from "./Providers"
import { UiServiceClient } from "./services/grpc-client"

const AppContent = () => {
	const {
		didHydrateState,
		showWelcome,
		shouldShowAnnouncement,
		showMcp,
		mcpTab,
		showSettings,
		showHistory,
		showAccount,
		showAnnouncement,
		onboardingModels,
		navigateToHaiTaskList: contextNavigateToHaiTaskList,
		showHaiTaskList,
		hideHaiTaskList,
		setShowAnnouncement,
		setShouldShowAnnouncement,
		closeMcpView,
		navigateToHistory: contextNavigateToHistory,
		navigateToSettings: contextNavigateToSettings,
		navigateToAccount: contextNavigateToAccount,
		navigateToMcp: contextNavigateToMcp,
		navigateToChat: contextNavigateToChat,
		hideSettings,
		hideHistory,
		hideAccount,
		hideAnnouncement,
	} = useExtensionState()

	const [selectedTask, setSelectedTask] = useState<IHaiClineTask | null>(null)
	const { clineUser, organizations, activeOrganization } = useClineAuth()
	const [taskList, setTaskList] = useState<IHaiStory[]>([])
	const [taskLastUpdatedTs, setTaskLastUpdatedTs] = useState<string>("")
	const [haiConfigFolder, setHaiConfigFolder] = useState<string>("")
	const [detailedTask, setDetailedTask] = useState<IHaiTask | null>(null)
	const [detailedStory, setDetailedStory] = useState<IHaiStory | null>(null)
	const [_showExperts, setShowExperts] = useState(false)

	useEffect(() => {
		if (shouldShowAnnouncement) {
			setShowAnnouncement(true)

			// Use the gRPC client instead of direct WebviewMessage
			UiServiceClient.onDidShowAnnouncement({} as EmptyRequest)
				.then((response: Boolean) => {
					setShouldShowAnnouncement(response.value)
				})
				.catch((error) => {
					console.error("Failed to acknowledge announcement:", error)
				})
		}
	}, [shouldShowAnnouncement, setShouldShowAnnouncement, setShowAnnouncement])

	// Subscribe to HAI task data updates
	useEffect(() => {
		const unsubscribe = UiServiceClient.subscribeToHaiTaskData({} as EmptyRequest, {
			onResponse: (data) => {
				// Convert proto stories back to IHaiStory format
				const stories: IHaiStory[] = data.stories.map((story) => ({
					id: story.id,
					prdId: story.prdId,
					name: story.name,
					description: story.description,
					storyTicketId: story.storyTicketId,
					tasks: story.tasks.map((task) => ({
						id: task.id,
						list: task.list,
						acceptance: task.acceptance,
						subTaskTicketId: task.subTaskTicketId,
						status: task.status,
					})),
				}))
				setTaskList(stories)
				setTaskLastUpdatedTs(data.timestamp)
				setHaiConfigFolder(data.folderPath)
			},
			onError: (error) => {
				console.error("Error in HAI task data subscription:", error)
			},
			onComplete: () => {
				console.log("HAI task data subscription completed")
			},
		})

		return () => {
			if (unsubscribe) {
				unsubscribe()
			}
		}
	}, [])

	// Subscribe to HAI Build Task List button clicks and clear detailed state
	useEffect(() => {
		const unsubscribe = UiServiceClient.subscribeToHaiBuildTaskListClicked({} as EmptyRequest, {
			onResponse: () => {
				console.log("[DEBUG] HAI Build Task List button clicked - clearing detailed state")
				// Clear detailed state when button is clicked
				setDetailedTask(null)
				setDetailedStory(null)
				// Then navigate to task list
				contextNavigateToHaiTaskList()
			},
			onError: (error) => {
				console.error("Error in HAI Build Task List button clicked subscription:", error)
			},
			onComplete: () => {
				console.log("HAI Build Task List button clicked subscription completed")
			},
		})

		return () => {
			if (unsubscribe) {
				unsubscribe()
			}
		}
	}, [contextNavigateToHaiTaskList])

	// Subscribe to MCP button clicks and clear detailed state
	useEffect(() => {
		const unsubscribe = UiServiceClient.subscribeToMcpButtonClicked({} as EmptyRequest, {
			onResponse: () => {
				console.log("[DEBUG] MCP button clicked - clearing detailed state")
				setDetailedTask(null)
				setDetailedStory(null)
				contextNavigateToMcp()
			},
			onError: (error) => {
				console.error("Error in MCP button clicked subscription:", error)
			},
			onComplete: () => {
				console.log("MCP button clicked subscription completed")
			},
		})

		return () => {
			if (unsubscribe) {
				unsubscribe()
			}
		}
	}, [contextNavigateToMcp])

	// Subscribe to History button clicks and clear detailed state
	useEffect(() => {
		const unsubscribe = UiServiceClient.subscribeToHistoryButtonClicked({} as EmptyRequest, {
			onResponse: () => {
				console.log("[DEBUG] History button clicked - clearing detailed state")
				setDetailedTask(null)
				setDetailedStory(null)
				contextNavigateToHistory()
			},
			onError: (error) => {
				console.error("Error in History button clicked subscription:", error)
			},
			onComplete: () => {
				console.log("History button clicked subscription completed")
			},
		})

		return () => {
			if (unsubscribe) {
				unsubscribe()
			}
		}
	}, [contextNavigateToHistory])

	// Subscribe to Account button clicks and clear detailed state
	useEffect(() => {
		const unsubscribe = UiServiceClient.subscribeToAccountButtonClicked({} as EmptyRequest, {
			onResponse: () => {
				console.log("[DEBUG] Account button clicked - clearing detailed state")
				setDetailedTask(null)
				setDetailedStory(null)
				contextNavigateToAccount()
			},
			onError: (error) => {
				console.error("Error in Account button clicked subscription:", error)
			},
			onComplete: () => {
				console.log("Account button clicked subscription completed")
			},
		})

		return () => {
			if (unsubscribe) {
				unsubscribe()
			}
		}
	}, [contextNavigateToAccount])

	// Subscribe to Settings button clicks and clear detailed state
	useEffect(() => {
		const unsubscribe = UiServiceClient.subscribeToSettingsButtonClicked({} as EmptyRequest, {
			onResponse: () => {
				console.log("[DEBUG] Settings button clicked - clearing detailed state")
				setDetailedTask(null)
				setDetailedStory(null)
				contextNavigateToSettings()
			},
			onError: (error) => {
				console.error("Error in Settings button clicked subscription:", error)
			},
			onComplete: () => {
				console.log("Settings button clicked subscription completed")
			},
		})

		return () => {
			if (unsubscribe) {
				unsubscribe()
			}
		}
	}, [contextNavigateToSettings])

	// Subscribe to Chat/New Task button clicks and clear detailed state
	useEffect(() => {
		const unsubscribe = UiServiceClient.subscribeToChatButtonClicked({} as EmptyRequest, {
			onResponse: () => {
				console.log("[DEBUG] Chat/New Task button clicked - clearing detailed state")
				setDetailedTask(null)
				setDetailedStory(null)
				contextNavigateToChat()
			},
			onError: (error) => {
				console.error("Error in Chat button clicked subscription:", error)
			},
			onComplete: () => {
				console.log("Chat button clicked subscription completed")
			},
		})

		return () => {
			if (unsubscribe) {
				unsubscribe()
			}
		}
	}, [contextNavigateToChat])

	// Handler for loading/configuring HAI tasks
	const handleConfigure = useCallback(
		async (loadDefault: boolean) => {
			try {
				const request: HaiTasksLoadRequest = {
					metadata: {},
					folderPath: loadDefault ? haiConfigFolder : "",
					loadDefault: loadDefault,
				}
				await UiServiceClient.loadHaiTasks(request)
			} catch (error) {
				console.error("Failed to load HAI tasks:", error)
			}
		},
		[haiConfigFolder],
	)

	// Handler for resetting HAI tasks
	const handleHaiTaskReset = useCallback(async () => {
		try {
			await UiServiceClient.resetHaiTasks({} as EmptyRequest)
		} catch (error) {
			console.error("Failed to reset HAI tasks:", error)
		}
	}, [])

	// Handler for task click
	const handleTaskClick = useCallback(
		(task: IHaiTask) => {
			setDetailedTask(task)
			const story = taskList.find((story) => story.tasks.some((t) => t.id === task.id && t === task))
			setDetailedStory(story || null)
		},
		[taskList],
	)

	// Handler for story click
	const handleStoryClick = useCallback((story: IHaiStory) => {
		setDetailedStory(story)
		setDetailedTask(null)
	}, [])

	// Handler for breadcrumb navigation
	const handleBreadcrumbClick = useCallback((type: string) => {
		if (type === "USER_STORIES") {
			setDetailedTask(null)
			setDetailedStory(null)
		} else if (type === "USER_STORY") {
			setDetailedTask(null)
		}
	}, [])

	// Wrapped navigation functions that clear detailed state
	const navigateToHistory = useCallback(() => {
		setDetailedTask(null)
		setDetailedStory(null)
		contextNavigateToHistory()
	}, [contextNavigateToHistory])

	const navigateToSettings = useCallback(
		(targetSection?: string) => {
			setDetailedTask(null)
			setDetailedStory(null)
			contextNavigateToSettings(targetSection)
		},
		[contextNavigateToSettings],
	)

	const navigateToAccount = useCallback(() => {
		setDetailedTask(null)
		setDetailedStory(null)
		contextNavigateToAccount()
	}, [contextNavigateToAccount])

	const navigateToMcp = useCallback(
		(tab?: any) => {
			setDetailedTask(null)
			setDetailedStory(null)
			contextNavigateToMcp(tab)
		},
		[contextNavigateToMcp],
	)

	const navigateToHaiTaskList = useCallback(() => {
		setDetailedTask(null)
		setDetailedStory(null)
		contextNavigateToHaiTaskList()
	}, [contextNavigateToHaiTaskList])

	const navigateToChat = useCallback(() => {
		setDetailedTask(null)
		setDetailedStory(null)
		contextNavigateToChat()
	}, [contextNavigateToChat])

	// Hide function for experts
	const _hideExperts = useCallback(() => setShowExperts(false), [])

	if (!didHydrateState) {
		return null
	}

	if (showWelcome) {
		return onboardingModels ? <OnboardingView onboardingModels={onboardingModels} /> : <WelcomeView />
	}

	return (
		<div className="flex h-screen w-full flex-col">
			{detailedTask || detailedStory ? (
				<DetailedView
					onBreadcrumbClick={handleBreadcrumbClick}
					onTaskClick={handleTaskClick}
					onTaskSelect={(selectedTask) => {
						setSelectedTask(selectedTask)
						setDetailedTask(null)
						setDetailedStory(null)
						hideHaiTaskList()
					}}
					story={detailedStory}
					task={detailedTask}
				/>
			) : (
				<>
					{showSettings && <SettingsView onDone={hideSettings} />}
					{showHistory && <HistoryView onDone={hideHistory} />}
					{showMcp && <McpView initialTab={mcpTab} onDone={closeMcpView} />}
					{showAccount && (
						<AccountView
							activeOrganization={activeOrganization}
							clineUser={clineUser}
							onDone={hideAccount}
							organizations={organizations}
						/>
					)}
					{showHaiTaskList && (
						<HaiTasksList
							haiTaskLastUpdatedTs={taskLastUpdatedTs}
							haiTaskList={taskList}
							onCancel={hideHaiTaskList}
							onConfigure={handleConfigure}
							onHaiTaskReset={handleHaiTaskReset}
							onStoryClick={handleStoryClick}
							onTaskClick={handleTaskClick}
							selectedHaiTask={(selectedTask: IHaiClineTask) => {
								setSelectedTask(selectedTask)
								hideHaiTaskList()
							}}
						/>
					)}
					{/* Do not conditionally load ChatView, it's expensive and there's state we don't want to lose (user input, disableInput, askResponse promise, etc.) */}
					<ChatView
						haiConfigFolder={haiConfigFolder}
						hideAnnouncement={hideAnnouncement}
						isHidden={showSettings || showHistory || showMcp || showAccount || showHaiTaskList}
						onTaskSelect={(selectedTask: IHaiClineTask | null) => {
							setSelectedTask(selectedTask)
						}}
						selectedHaiTask={selectedTask}
						showAnnouncement={showAnnouncement}
						showHaiTaskListView={navigateToHaiTaskList}
						showHistoryView={navigateToHistory}
					/>
				</>
			)}
		</div>
	)
}

const App = () => {
	return (
		<Providers>
			<AppContent />
		</Providers>
	)
}

export default App
