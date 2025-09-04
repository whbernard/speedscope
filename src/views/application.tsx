import '../../assets/reset.css'
import '../../assets/source-code-pro.css'

import {h} from 'preact'
import {StyleSheet, css} from 'aphrodite'

import {ProfileGroup, SymbolRemapper} from '../lib/profile'
import {FontFamily, FontSize, Duration} from './style'
import {importEmscriptenSymbolMap as importEmscriptenSymbolRemapper} from '../lib/emscripten'
import {saveToFile} from '../lib/file-format'
import {ActiveProfileState} from '../app-state/active-profile-state'
import {LeftHeavyFlamechartView, ChronoFlamechartView} from './flamechart-view-container'
import {CanvasContext} from '../gl/canvas-context'
import {Toolbar} from './toolbar'
import {IntervalSelector} from './interval-selector'
import {importJavaScriptSourceMapSymbolRemapper} from '../lib/js-source-map'
import {Theme, withTheme} from './themes/theme'
import {ViewMode} from '../lib/view-mode'
import {canUseXHR} from '../app-state'
import {ProfileGroupState} from '../app-state/profile-group'
import {HashParams} from '../lib/hash-params'
import {Component} from 'preact'
import {SandwichViewContainer} from './sandwich-view'

const importModule = import('../import')

// Force eager loading of a few code-split modules.
//
// We put them all in one place so we can directly control the relative priority
// of these.
importModule.then(() => {})
import('../lib/demangle').then(() => {})
import('source-map').then(() => {})

async function importProfilesFromText(
  fileName: string,
  contents: string,
): Promise<ProfileGroup | null> {
  return (await importModule).importProfileGroupFromText(fileName, contents)
}

async function importProfilesFromBase64(
  fileName: string,
  contents: string,
): Promise<ProfileGroup | null> {
  return (await importModule).importProfileGroupFromBase64(fileName, contents)
}

async function importProfilesFromArrayBuffer(
  fileName: string,
  contents: ArrayBuffer,
): Promise<ProfileGroup | null> {
  return (await importModule).importProfilesFromArrayBuffer(fileName, contents)
}

async function importProfilesFromFile(file: File): Promise<ProfileGroup | null> {
  return (await importModule).importProfilesFromFile(file)
}
async function importFromFileSystemDirectoryEntry(entry: FileSystemDirectoryEntry) {
  return (await importModule).importFromFileSystemDirectoryEntry(entry)
}

declare function require(x: string): any
const exampleProfileURL = require('../../sample/profiles/stackcollapse/perf-vertx-stacks-01-collapsed-all.txt')

function isFileSystemDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry != null && entry.isDirectory
}

interface GLCanvasProps {
  canvasContext: CanvasContext | null
  theme: Theme
  setGLCanvas: (canvas: HTMLCanvasElement | null) => void
}
export class GLCanvas extends Component<GLCanvasProps> {
  private canvas: HTMLCanvasElement | null = null

  private ref = (canvas: Element | null) => {
    if (canvas instanceof HTMLCanvasElement) {
      this.canvas = canvas
    } else {
      this.canvas = null
    }

    this.props.setGLCanvas(this.canvas)
  }

  private container: HTMLElement | null = null
  private containerRef = (container: Element | null) => {
    if (container instanceof HTMLElement) {
      this.container = container
    } else {
      this.container = null
    }
  }

  private maybeResize = () => {
    if (!this.container) return
    if (!this.props.canvasContext) return

    let {width, height} = this.container.getBoundingClientRect()

    const widthInAppUnits = width
    const heightInAppUnits = height
    const widthInPixels = width * window.devicePixelRatio
    const heightInPixels = height * window.devicePixelRatio

    this.props.canvasContext.gl.resize(
      widthInPixels,
      heightInPixels,
      widthInAppUnits,
      heightInAppUnits,
    )
  }

  onWindowResize = () => {
    if (this.props.canvasContext) {
      this.props.canvasContext.requestFrame()
    }
  }
  componentWillReceiveProps(nextProps: GLCanvasProps) {
    if (this.props.canvasContext !== nextProps.canvasContext) {
      if (this.props.canvasContext) {
        this.props.canvasContext.removeBeforeFrameHandler(this.maybeResize)
      }
      if (nextProps.canvasContext) {
        nextProps.canvasContext.addBeforeFrameHandler(this.maybeResize)
        nextProps.canvasContext.requestFrame()
      }
    }
  }
  componentDidMount() {
    window.addEventListener('resize', this.onWindowResize)
  }
  componentWillUnmount() {
    if (this.props.canvasContext) {
      this.props.canvasContext.removeBeforeFrameHandler(this.maybeResize)
    }
    window.removeEventListener('resize', this.onWindowResize)
  }
  render() {
    const style = getStyle(this.props.theme)
    return (
      <div ref={this.containerRef} className={css(style.glCanvasView)}>
        <canvas ref={this.ref} width={1} height={1} />
      </div>
    )
  }
}

export type ApplicationProps = {
  setGLCanvas: (canvas: HTMLCanvasElement | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: boolean) => void
  setProfileGroup: (profileGroup: ProfileGroup) => void
  setDragActive: (dragActive: boolean) => void
  setViewMode: (viewMode: ViewMode) => void
  setFlattenRecursion: (flattenRecursion: boolean) => void
  setProfileIndexToView: (profileIndex: number) => void
  activeProfileState: ActiveProfileState | null
  canvasContext: CanvasContext | null
  theme: Theme
  profileGroup: ProfileGroupState
  flattenRecursion: boolean
  viewMode: ViewMode
  hashParams: HashParams
  dragActive: boolean
  loading: boolean
  glCanvas: HTMLCanvasElement | null
  error: boolean
}

interface ApplicationState {
  showIntervalSelector: boolean
  selectedStartValue: number
  selectedEndValue: number
  showLoadingScreen: boolean
  loadingMessage: string
}

export class Application extends Component<ApplicationProps, ApplicationState> {
  constructor(props: ApplicationProps) {
    super(props)
    this.state = {
      showIntervalSelector: false,
      selectedStartValue: 0,
      selectedEndValue: 0,
      showLoadingScreen: false,
      loadingMessage: '',
    }
  }

  private async loadProfile(loader: () => Promise<ProfileGroup | null>) {
    this.props.setError(false)
    this.props.setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 0))

    if (!this.props.glCanvas) return

    console.time('import')

    let profileGroup: ProfileGroup | null = null
    try {
      profileGroup = await loader()
    } catch (e) {
      console.log('Failed to load format', e)
      this.props.setError(true)
      return
    }

    // TODO(jlfwong): Make these into nicer overlays
    if (profileGroup == null) {
      alert('Unrecognized format! See documentation about supported formats.')
      this.props.setLoading(false)
      return
    } else if (profileGroup.profiles.length === 0) {
      alert("Successfully imported profile, but it's empty!")
      this.props.setLoading(false)
      return
    }

    if (this.props.hashParams.title) {
      profileGroup = {
        ...profileGroup,
        name: this.props.hashParams.title,
      }
    }
    document.title = `${profileGroup.name} - speedscope`

    if (this.props.hashParams.viewMode) {
      this.props.setViewMode(this.props.hashParams.viewMode)
    }

    for (let profile of profileGroup.profiles) {
      await profile.demangle()
    }

    for (let profile of profileGroup.profiles) {
      const title = this.props.hashParams.title || profile.getName()
      profile.setName(title)
    }

    console.timeEnd('import')

    this.props.setProfileGroup(profileGroup)
    this.props.setLoading(false)
  }

  getStyle(): ReturnType<typeof getStyle> {
    return getStyle(this.props.theme)
  }

  loadFromFile(file: File) {
    this.loadProfile(async () => {
      const profiles = await importProfilesFromFile(file)
      if (profiles) {
        for (let profile of profiles.profiles) {
          if (!profile.getName()) {
            profile.setName(file.name)
          }
        }
        return profiles
      }

      if (this.props.profileGroup && this.props.activeProfileState) {
        // If a profile is already loaded, it's possible the file being imported is
        // a symbol map. If that's the case, we want to parse it, and apply the symbol
        // mapping to the already loaded profile. This can be use to take an opaque
        // profile and make it readable.
        const reader = new FileReader()
        const fileContentsPromise = new Promise<string>(resolve => {
          reader.addEventListener('loadend', () => {
            if (typeof reader.result !== 'string') {
              throw new Error('Expected reader.result to be a string')
            }
            resolve(reader.result)
          })
        })
        reader.readAsText(file)
        const fileContents = await fileContentsPromise

        let symbolRemapper: SymbolRemapper | null = null

        const emscriptenSymbolRemapper = importEmscriptenSymbolRemapper(fileContents)
        if (emscriptenSymbolRemapper) {
          console.log('Importing as emscripten symbol map')
          symbolRemapper = emscriptenSymbolRemapper
        }

        const jsSourceMapRemapper = await importJavaScriptSourceMapSymbolRemapper(
          fileContents,
          file.name,
        )
        if (!symbolRemapper && jsSourceMapRemapper) {
          console.log('Importing as JavaScript source map')
          symbolRemapper = jsSourceMapRemapper
        }

        if (symbolRemapper != null) {
          return {
            name: this.props.profileGroup.name || 'profile',
            indexToView: this.props.profileGroup.indexToView,
            profiles: this.props.profileGroup.profiles.map(profileState => {
              // We do a shallow clone here to invalidate certain caches keyed
              // on a reference to the profile group under the assumption that
              // profiles are immutable. Symbol remapping is (at time of
              // writing) the only exception to that immutability.
              const p = profileState.profile.shallowClone()
              p.remapSymbols(symbolRemapper!)
              return p
            }),
          }
        }
      }

      return null
    })
  }

  loadExample = () => {
    this.loadProfile(async () => {
      const filename = 'perf-vertx-stacks-01-collapsed-all.txt'
      const data = await fetch(exampleProfileURL).then(resp => resp.text())
      return await importProfilesFromText(filename, data)
    })
  }

  onDrop = (ev: DragEvent) => {
    this.props.setDragActive(false)
    ev.preventDefault()

    if (!ev.dataTransfer) return

    const firstItem = ev.dataTransfer.items[0]
    if ('webkitGetAsEntry' in firstItem) {
      const webkitEntry: FileSystemEntry | null = firstItem.webkitGetAsEntry()

      // Instrument.app file format is actually a directory.
      if (
        webkitEntry &&
        isFileSystemDirectoryEntry(webkitEntry) &&
        webkitEntry.name.endsWith('.trace')
      ) {
        console.log('Importing as Instruments.app .trace file')
        const webkitDirectoryEntry: FileSystemDirectoryEntry = webkitEntry
        this.loadProfile(async () => {
          return await importFromFileSystemDirectoryEntry(webkitDirectoryEntry)
        })
        return
      }
    }

    let file: File | null = ev.dataTransfer.files.item(0)
    if (file) {
      this.loadFromFile(file)
    }
  }

  onDragOver = (ev: DragEvent) => {
    this.props.setDragActive(true)
    ev.preventDefault()
  }

  onDragLeave = (ev: DragEvent) => {
    this.props.setDragActive(false)
    ev.preventDefault()
  }

  onWindowKeyPress = async (ev: KeyboardEvent) => {
    if (ev.key === '1') {
      this.props.setViewMode(ViewMode.CHRONO_FLAME_CHART)
    } else if (ev.key === '2') {
      this.props.setViewMode(ViewMode.LEFT_HEAVY_FLAME_GRAPH)
    } else if (ev.key === '3') {
      this.props.setViewMode(ViewMode.SANDWICH_VIEW)
    } else if (ev.key === 'r') {
      const {flattenRecursion} = this.props
      this.props.setFlattenRecursion(!flattenRecursion)
    } else if (ev.key === 'n') {
      const {activeProfileState} = this.props
      if (activeProfileState) {
        this.props.setProfileIndexToView(activeProfileState.index + 1)
      }
    } else if (ev.key === 'p') {
      const {activeProfileState} = this.props
      if (activeProfileState) {
        this.props.setProfileIndexToView(activeProfileState.index - 1)
      }
    }
  }

  private saveFile = () => {
    if (this.props.profileGroup) {
      const {name, indexToView, profiles} = this.props.profileGroup
      const profileGroup: ProfileGroup = {
        name,
        indexToView,
        profiles: profiles.map(p => p.profile),
      }
      saveToFile(profileGroup)
    }
  }

  private sendToAPI = () => {
    if (this.props.profileGroup && this.props.activeProfileState) {
      // Get current viewport state to sync with zoom
      const activeProfile = this.props.activeProfileState.profile
      const viewState = this.getCurrentViewState()

      let initialStartValue = 0
      let initialEndValue = activeProfile.getTotalWeight()

      if (viewState && viewState.configSpaceViewportRect) {
        const rect = viewState.configSpaceViewportRect
        initialStartValue = Math.max(0, rect.origin.x)
        initialEndValue = Math.min(activeProfile.getTotalWeight(), rect.origin.x + rect.size.x)
      }

      // Show interval selector with current viewport range
      this.setState({
        showIntervalSelector: true,
        selectedStartValue: initialStartValue,
        selectedEndValue: initialEndValue,
      })
    }
  }

  private getCurrentViewState() {
    if (!this.props.activeProfileState) return null

    // Get the current view state based on the active view mode
    switch (this.props.viewMode) {
      case ViewMode.CHRONO_FLAME_CHART:
        return this.props.activeProfileState.chronoViewState
      case ViewMode.LEFT_HEAVY_FLAME_GRAPH:
        return this.props.activeProfileState.leftHeavyViewState
      case ViewMode.SANDWICH_VIEW:
        return (
          this.props.activeProfileState.sandwichViewState.callerCallee?.invertedCallerFlamegraph ||
          null
        )
      default:
        return null
    }
  }

  // Strict interval filtering with synthetic events at boundaries
  private filterEventsWithContext(events: any[], intervalStart: number, intervalEnd: number) {
    // Track frame states and events within the interval
    const framesInInterval = new Set<number>()
    const frameStates = new Map<number, {hasOpen: boolean, hasClose: boolean, openTime?: number, closeTime?: number}>()
    const filteredEvents: any[] = []
    
    // First pass: identify frames active in interval and collect their events
    for (const event of events) {
      if (event.at >= intervalStart && event.at <= intervalEnd) {
        framesInInterval.add(event.frame)
        
        if (!frameStates.has(event.frame)) {
          frameStates.set(event.frame, {hasOpen: false, hasClose: false})
        }
        
        const frameState = frameStates.get(event.frame)!
        
        if (event.type === 'O') {
          frameState.hasOpen = true
          frameState.openTime = event.at
          filteredEvents.push(event)
        } else if (event.type === 'C') {
          frameState.hasClose = true
          frameState.closeTime = event.at
          filteredEvents.push(event)
        }
      }
    }
    
    // Second pass: add synthetic events for frames that need them
    const syntheticEvents: any[] = []
    
    for (const [frameId, frameState] of frameStates) {
      if (frameState.hasOpen && !frameState.hasClose) {
        // Frame opened in interval but didn't close - add synthetic close at interval end
        syntheticEvents.push({
          type: 'C',
          frame: frameId,
          at: parseInt(intervalEnd.toString())
        })
        console.log(`Added synthetic close for frame ${frameId} at ${intervalEnd}`)
      } else if (!frameState.hasOpen && frameState.hasClose) {
        // Frame closed in interval but didn't open - add synthetic open at interval start
        syntheticEvents.push({
          type: 'O',
          frame: frameId,
          at: parseInt(intervalStart.toString())
        })
        console.log(`Added synthetic open for frame ${frameId} at ${intervalStart}`)
      }
    }
    
    // Combine filtered events with synthetic events and sort by timestamp
    const allEvents = [...filteredEvents, ...syntheticEvents]
    const sortedEvents = allEvents.sort((a, b) => a.at - b.at)
    
    console.log(`Filtered ${filteredEvents.length} events + ${syntheticEvents.length} synthetic events = ${sortedEvents.length} total events for ${framesInInterval.size} active frames`)
    return sortedEvents
  }

  private handleIntervalConfirm = async (
    startValue: number,
    endValue: number,
    oauthConfig: any,
    analysisPrompt?: string,
    filteredJsonData?: string,
  ) => {
    this.setState({
      showIntervalSelector: false,
      selectedStartValue: startValue,
      selectedEndValue: endValue,
      showLoadingScreen: true,
      loadingMessage: 'Preparing profile data...',
    })

    if (this.props.profileGroup && this.props.activeProfileState) {
      const {name} = this.props.profileGroup

      try {
        let jsonData: string
        
        if (filteredJsonData) {
          // Use the pre-filtered JSON data from the preview
          console.log('Using pre-filtered JSON data from preview')
          this.setState({loadingMessage: 'Using filtered profile data...'})
          jsonData = filteredJsonData
        } else {
          // Fallback: generate the JSON data (this shouldn't happen with the new flow)
          console.log('Fallback: generating JSON data from scratch')
          const activeProfile = this.props.activeProfileState.profile
          
          // Create frames mapping
          const frames: any[] = []
          const indexForFrame = new Map<any, number>()
          
          function getIndexForFrame(frame: any): number {
            let index = indexForFrame.get(frame)
            if (index == null) {
              const serializedFrame: any = {
                name: frame.name,
              }
              if (frame.file != null) serializedFrame.file = frame.file
              if (frame.line != null) serializedFrame.line = frame.line
              if (frame.col != null) serializedFrame.col = frame.col
              index = frames.length
              indexForFrame.set(frame, index)
              frames.push(serializedFrame)
            }
            return index
          }

          // Generate events using non-blocking approach
          const events: any[] = []
          let eventCount = 0
          const maxEvents = 100000 // Safety limit to prevent infinite loops
          
          const openFrame = (node: any, value: number) => {
            if (eventCount >= maxEvents) {
              console.warn('Event limit reached, stopping event generation')
              return
            }
            events.push({
              type: 'O',
              frame: getIndexForFrame(node.frame),
              at: parseInt(value.toString()), // Convert to integer
            })
            eventCount++
          }
          const closeFrame = (node: any, value: number) => {
            if (eventCount >= maxEvents) {
              console.warn('Event limit reached, stopping event generation')
              return
            }
            events.push({
              type: 'C',
              frame: getIndexForFrame(node.frame),
              at: parseInt(value.toString()), // Convert to integer
            })
            eventCount++
          }
          
          console.log('Starting event generation...')
          this.setState({loadingMessage: 'Generating events...'})
          
          // Use setTimeout to yield control back to the browser
          await new Promise<void>((resolve) => {
            setTimeout(() => {
              try {
                activeProfile.forEachCall(openFrame, closeFrame)
                console.log(`Generated ${events.length} events`)
                resolve()
              } catch (error) {
                console.error('Error during event generation:', error)
                throw error
              }
            }, 0)
          })
          
          // Apply filtering with progress updates
          console.log('Starting event filtering...')
          this.setState({loadingMessage: 'Filtering events...'})
          
          const filteredEvents = await new Promise<any[]>((resolve) => {
            setTimeout(() => {
              const result = this.filterEventsWithContext(events, startValue, endValue)
              console.log(`Filtered to ${result.length} events`)
              resolve(result)
            }, 0)
          })
          
          // Create the exported data structure
          this.setState({loadingMessage: 'Building JSON structure...'})
          
          // Use the actual first and last event timestamps from the filtered events, converted to integers
          const sortedEvents = filteredEvents.sort((a, b) => a.at - b.at)
          const profileStartValue = sortedEvents.length > 0 ? parseInt(sortedEvents[0].at.toString()) : 0
          const profileEndValue = sortedEvents.length > 0 ? parseInt(sortedEvents[sortedEvents.length - 1].at.toString()) : 0
          
          console.log('Profile boundaries:', {
            profileStartValue,
            profileEndValue,
            firstEventAt: sortedEvents[0]?.at,
            lastEventAt: sortedEvents[sortedEvents.length - 1]?.at,
            totalEvents: filteredEvents.length
          })
          
          const file = {
            exporter: `speedscope@${require('../../package.json').version}`,
            name: `${name} (${activeProfile.formatValue(startValue)} - ${activeProfile.formatValue(endValue)})`,
            activeProfileIndex: 0,
            $schema: 'https://www.speedscope.app/file-format-schema.json',
            shared: {frames},
            profiles: [{
              type: 'evented',
              name: activeProfile.getName(),
              unit: activeProfile.getWeightUnit(),
              startValue: profileStartValue,
              endValue: profileEndValue,
              events: filteredEvents,
            }],
          }
          
          // JSON serialization with progress update
          console.log('Starting JSON serialization...')
          this.setState({loadingMessage: 'Serializing JSON...'})
          
          jsonData = await new Promise<string>((resolve) => {
            setTimeout(() => {
              const result = JSON.stringify(file)
              console.log(`JSON serialized, length: ${result.length}`)
              resolve(result)
            }, 0)
          })
        }

        // Get the active profile for formatting values
        const activeProfile = this.props.activeProfileState.profile

        // Get LLM configuration from user
        const llmEndpoint =
          prompt('Enter LLM inference URL:', 'https://api.openai.com/v1/chat/completions') ||
          'https://api.openai.com/v1/chat/completions'

        let authHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        }

        // Use OAuth configuration from interval selector
        const selectedConfig = {
          endpoint: oauthConfig.oauthUrl,
          client_id: oauthConfig.clientId,
          client_secret: oauthConfig.clientSecret,
          grant_type: 'client_credentials',
        }

        try {
          // Get OAuth token using client credentials flow
          const oauthResponse = await fetch(selectedConfig.endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              grant_type: selectedConfig.grant_type,
              client_id: selectedConfig.client_id,
              client_secret: selectedConfig.client_secret,
            }).toString(),
          })

          if (!oauthResponse.ok) {
            throw new Error(`OAuth failed: ${oauthResponse.status} ${oauthResponse.statusText}`)
          }

          const oauthData = await oauthResponse.json()
          const accessToken = oauthData.access_token

          if (!accessToken) {
            throw new Error('No access token received from OAuth server')
          }

          authHeaders['Authorization'] = `Bearer ${accessToken}`
        } catch (oauthError) {
          console.error('OAuth error:', oauthError)
          const errorMessage =
            oauthError instanceof Error ? oauthError.message : 'Unknown OAuth error'
          alert(
            `OAuth authentication failed: ${errorMessage}\n\nPlease check your OAuth endpoint and credentials.`,
          )
          return
        }

        // Use the prompt from the interval selector or default
        const finalPrompt =
          analysisPrompt || 'Identify performance bottlenecks in this profile data'

        // Prepare LLM request payload
        const llmPayload = {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content:
                'You are a performance analysis expert. Analyze the provided profiling data and provide insights, recommendations, and actionable improvements.',
            },
            {
              role: 'user',
              content: `${finalPrompt}\n\nProfile data:\n${jsonData}`,
            },
          ],
          max_tokens: 2000,
          temperature: 0.3,
        }

        // Send to LLM API
        this.setState({loadingMessage: 'Sending to LLM API...'})
        const response = await fetch(llmEndpoint, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(llmPayload),
        })

        if (response.ok) {
          const responseData = await response.json()
          const llmResponse = responseData.choices?.[0]?.message?.content || 'No analysis received'

          // Hide loading screen
          this.setState({showLoadingScreen: false})

          // Show LLM analysis in a more detailed alert
          alert(
            `LLM Analysis for interval ${activeProfile.formatValue(
              startValue,
            )} - ${activeProfile.formatValue(endValue)}:\n\n${llmResponse}`,
          )
        } else {
          // Hide loading screen
          this.setState({showLoadingScreen: false})
          
          alert(
            `Failed to get LLM analysis: ${response.status} ${response.statusText}\n\nPlease check your authentication and endpoint configuration.`,
          )
        }
      } catch (error) {
        // Hide loading screen
        this.setState({showLoadingScreen: false})
        
        console.error('Error getting LLM analysis:', error)
        alert(
          'Error getting LLM analysis. Check console for details.\n\nPlease verify your endpoint URL and authentication credentials.',
        )
      }
    }
  }

  private handleIntervalCancel = () => {
    this.setState({
      showIntervalSelector: false,
      showLoadingScreen: false,
    })
  }

  private browseForFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.addEventListener('change', this.onFileSelect)
    input.click()
  }

  private onWindowKeyDown = async (ev: KeyboardEvent) => {
    // This has to be handled on key down in order to prevent the default
    // page save action.
    if (ev.key === 's' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault()
      this.saveFile()
    } else if (ev.key === 'o' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault()
      this.browseForFile()
    }
  }

  onDocumentPaste = (ev: Event) => {
    if (document.activeElement != null && document.activeElement.nodeName === 'INPUT') return

    ev.preventDefault()
    ev.stopPropagation()

    const clipboardData = (ev as ClipboardEvent).clipboardData
    if (!clipboardData) return
    const pasted = clipboardData.getData('text')
    this.loadProfile(async () => {
      return await importProfilesFromText('From Clipboard', pasted)
    })
  }

  componentDidMount() {
    window.addEventListener('keydown', this.onWindowKeyDown)
    window.addEventListener('keypress', this.onWindowKeyPress)
    document.addEventListener('paste', this.onDocumentPaste)
    this.maybeLoadHashParamProfile()
  }

  componentWillUnmount() {
    window.removeEventListener('keydown', this.onWindowKeyDown)
    window.removeEventListener('keypress', this.onWindowKeyPress)
    document.removeEventListener('paste', this.onDocumentPaste)
  }

  async maybeLoadHashParamProfile() {
    const {profileURL} = this.props.hashParams
    if (profileURL) {
      if (!canUseXHR) {
        alert(
          `Cannot load a profile URL when loading from "${window.location.protocol}" URL protocol`,
        )
        return
      }
      this.loadProfile(async () => {
        const response: Response = await fetch(profileURL)
        let filename = new URL(profileURL, window.location.href).pathname
        if (filename.includes('/')) {
          filename = filename.slice(filename.lastIndexOf('/') + 1)
        }
        return await importProfilesFromArrayBuffer(filename, await response.arrayBuffer())
      })
    } else if (this.props.hashParams.localProfilePath) {
      // There isn't good cross-browser support for XHR of local files, even from
      // other local files. To work around this restriction, we load the local profile
      // as a JavaScript file which will invoke a global function.
      ;(window as any)['speedscope'] = {
        loadFileFromBase64: (filename: string, base64source: string) => {
          this.loadProfile(() => importProfilesFromBase64(filename, base64source))
        },
      }

      const script = document.createElement('script')
      script.src = `file:///${this.props.hashParams.localProfilePath}`
      document.head.appendChild(script)
    }
  }

  onFileSelect = (ev: Event) => {
    const file = (ev.target as HTMLInputElement).files!.item(0)
    if (file) {
      this.loadFromFile(file)
    }
  }

  renderLanding() {
    const style = this.getStyle()

    return (
      <div className={css(style.landingContainer)}>
        <div className={css(style.landingMessage)}>
          <p className={css(style.landingP)}>
            👋 Hi there! Welcome to 🔬speedscope, an interactive{' '}
            <a
              className={css(style.link)}
              href="http://www.brendangregg.com/FlameGraphs/cpuflamegraphs.html"
            >
              flamegraph
            </a>{' '}
            visualizer. Use it to help you make your software faster.
          </p>
          {canUseXHR ? (
            <p className={css(style.landingP)}>
              Drag and drop a profile file onto this window to get started, click the big blue
              button below to browse for a profile to explore, or{' '}
              <a tabIndex={0} className={css(style.link)} onClick={this.loadExample}>
                click here
              </a>{' '}
              to load an example profile.
            </p>
          ) : (
            <p className={css(style.landingP)}>
              Drag and drop a profile file onto this window to get started, or click the big blue
              button below to browse for a profile to explore.
            </p>
          )}
          <div className={css(style.browseButtonContainer)}>
            <input
              type="file"
              name="file"
              id="file"
              onChange={this.onFileSelect}
              className={css(style.hide)}
            />
            <label for="file" className={css(style.browseButton)} tabIndex={0}>
              Browse
            </label>
          </div>

          <p className={css(style.landingP)}>
            See the{' '}
            <a
              className={css(style.link)}
              href="https://github.com/jlfwong/speedscope#usage"
              target="_blank"
            >
              documentation
            </a>{' '}
            for information about supported file formats, keyboard shortcuts, and how to navigate
            around the profile.
          </p>

          <p className={css(style.landingP)}>
            speedscope is open source. Please{' '}
            <a
              className={css(style.link)}
              target="_blank"
              href="https://github.com/jlfwong/speedscope/issues"
            >
              report any issues on GitHub
            </a>
            .
          </p>
        </div>
      </div>
    )
  }

  renderError() {
    const style = this.getStyle()

    return (
      <div className={css(style.error)}>
        <div>😿 Something went wrong.</div>
        <div>Check the JS console for more details.</div>
      </div>
    )
  }

  renderLoadingBar() {
    const style = this.getStyle()
    return <div className={css(style.loading)} />
  }

  renderContent() {
    const {viewMode, activeProfileState, error, loading, glCanvas} = this.props

    if (error) {
      return this.renderError()
    }

    if (loading) {
      return this.renderLoadingBar()
    }

    if (!activeProfileState || !glCanvas) {
      return this.renderLanding()
    }

    switch (viewMode) {
      case ViewMode.CHRONO_FLAME_CHART: {
        return <ChronoFlamechartView activeProfileState={activeProfileState} glCanvas={glCanvas} />
      }
      case ViewMode.LEFT_HEAVY_FLAME_GRAPH: {
        return (
          <LeftHeavyFlamechartView activeProfileState={activeProfileState} glCanvas={glCanvas} />
        )
      }
      case ViewMode.SANDWICH_VIEW: {
        return <SandwichViewContainer activeProfileState={activeProfileState} glCanvas={glCanvas} />
      }
    }
  }

  render() {
    const style = this.getStyle()
    return (
      <div
        onDrop={this.onDrop}
        onDragOver={this.onDragOver}
        onDragLeave={this.onDragLeave}
        className={css(style.root, this.props.dragActive && style.dragTargetRoot)}
      >
        <GLCanvas
          setGLCanvas={this.props.setGLCanvas}
          canvasContext={this.props.canvasContext}
          theme={this.props.theme}
        />
        <Toolbar
          saveFile={this.saveFile}
          browseForFile={this.browseForFile}
          sendToAPI={this.sendToAPI}
          {...(this.props as ApplicationProps)}
        />
        <div className={css(style.contentContainer)}>{this.renderContent()}</div>
        {this.props.dragActive && <div className={css(style.dragTarget)} />}
        {this.state.showIntervalSelector && this.props.activeProfileState && (
          <IntervalSelector
            profile={this.props.activeProfileState.profile}
            onConfirm={this.handleIntervalConfirm}
            onCancel={this.handleIntervalCancel}
            theme={this.props.theme}
            initialStartValue={this.state.selectedStartValue}
            initialEndValue={this.state.selectedEndValue}
          />
        )}
        {this.state.showLoadingScreen && (
          <div className={css(style.loadingOverlay)}>
            <div className={css(style.loadingModal)}>
              <div className={css(style.loadingSpinner)}>⏳</div>
              <div className={css(style.loadingMessage)}>{this.state.loadingMessage}</div>
              <div className={css(style.loadingSubtext)}>Processing profile data...</div>
            </div>
          </div>
        )}
      </div>
    )
  }
}

const getStyle = withTheme(theme =>
  StyleSheet.create({
    glCanvasView: {
      position: 'absolute',
      width: '100vw',
      height: '100vh',
      zIndex: -1,
      pointerEvents: 'none',
    },
    error: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
    },
    loading: {
      height: 3,
      marginBottom: -3,
      background: theme.selectionPrimaryColor,
      transformOrigin: '0% 50%',
      animationName: [
        {
          from: {
            transform: `scaleX(0)`,
          },
          to: {
            transform: `scaleX(1)`,
          },
        },
      ],
      animationTimingFunction: 'cubic-bezier(0, 1, 0, 1)',
      animationDuration: '30s',
    },
    root: {
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      fontFamily: FontFamily.MONOSPACE,
      lineHeight: '20px',
      color: theme.fgPrimaryColor,
    },
    dragTargetRoot: {
      cursor: 'copy',
    },
    dragTarget: {
      boxSizing: 'border-box',
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: `5px dashed ${theme.selectionPrimaryColor}`,
      pointerEvents: 'none',
    },
    contentContainer: {
      position: 'relative',
      display: 'flex',
      overflow: 'hidden',
      flexDirection: 'column',
      flex: 1,
    },
    landingContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    landingMessage: {
      maxWidth: 600,
    },
    landingP: {
      marginBottom: 16,
    },
    hide: {
      display: 'none',
    },
    browseButtonContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    browseButton: {
      marginBottom: 16,
      height: 72,
      flex: 1,
      maxWidth: 256,
      textAlign: 'center',
      fontSize: FontSize.BIG_BUTTON,
      lineHeight: '72px',
      background: theme.selectionPrimaryColor,
      color: theme.altFgPrimaryColor,
      transition: `all ${Duration.HOVER_CHANGE} ease-in`,
      ':hover': {
        background: theme.selectionSecondaryColor,
      },
    },
    link: {
      color: theme.selectionPrimaryColor,
      cursor: 'pointer',
      textDecoration: 'none',
      transition: `all ${Duration.HOVER_CHANGE} ease-in`,
      ':hover': {
        color: theme.selectionSecondaryColor,
      },
    },
    loadingOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    loadingModal: {
      backgroundColor: theme.bgPrimaryColor,
      border: `1px solid ${theme.fgSecondaryColor}`,
      borderRadius: 8,
      padding: 32,
      textAlign: 'center',
      minWidth: 300,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    },
    loadingSpinner: {
      fontSize: 48,
      marginBottom: 16,
      animationName: [
        {
          from: {
            transform: 'rotate(0deg)',
          },
          to: {
            transform: 'rotate(360deg)',
          },
        },
      ],
      animationDuration: '2s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'linear',
    },
    loadingMessage: {
      fontSize: FontSize.TITLE,
      fontWeight: 'bold',
      color: theme.fgPrimaryColor,
      marginBottom: 8,
    },
    loadingSubtext: {
      fontSize: FontSize.LABEL,
      color: theme.fgSecondaryColor,
    },
  }),
)
