import {h, JSX} from 'preact'
import {StyleSheet, css} from 'aphrodite'
import {useState, useEffect, useCallback} from 'preact/hooks'
import {Profile} from '../lib/profile'
import {FontFamily, FontSize, Duration} from './style'
import {Theme, withTheme} from './themes/theme'

interface IntervalSelectorProps {
  profile: Profile
  onConfirm: (
    startValue: number,
    endValue: number,
    oauthConfig?: OAuthConfig,
    prompt?: string,
    filteredJsonData?: string,
  ) => void
  onCancel: () => void
  theme: Theme
  initialStartValue?: number
  initialEndValue?: number
}

interface OAuthConfig {
  oauthUrl: string
  clientId: string
  clientSecret: string
}

export function IntervalSelector(props: IntervalSelectorProps): JSX.Element {
  const style = getStyle(props.theme)
  const totalWeight = props.profile.getTotalWeight()
  const unit = props.profile.getWeightUnit()

  // Initialize with a reasonable default range (0 to 80% of total)
  const defaultStartValue = props.initialStartValue || 0
  const defaultEndValue = props.initialEndValue || Math.min(totalWeight * 0.8, totalWeight - 1)

  const [startValue, setStartValue] = useState(defaultStartValue)
  const [endValue, setEndValue] = useState(defaultEndValue)
  const [startPercent, setStartPercent] = useState((defaultStartValue / totalWeight) * 100)
  const [endPercent, setEndPercent] = useState((defaultEndValue / totalWeight) * 100)
  const [oauthUrl, setOauthUrl] = useState('https://your-oauth-server.com/oauth/token')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const [jsonPreview, setJsonPreview] = useState('')
  const [condensedView, setCondensedView] = useState('')
  const [showCondensedView, setShowCondensedView] = useState(false)
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false)
  const [previewProgress, setPreviewProgress] = useState('')
  const [filteredJsonData, setFilteredJsonData] = useState<string>('')

  // Sample prompts for LLM analysis
  const samplePrompts = [
    'Identify performance bottlenecks in this profile data',
    'Find the most time-consuming functions',
    'Analyze the call stack patterns and suggest optimizations',
    'Identify potential memory leaks or inefficient algorithms',
    'Compare this profile with typical performance patterns',
    'Suggest specific code improvements based on the profiling data',
  ]

  // Focus the first input when modal opens
  useEffect(() => {
    const firstInput = document.querySelector('input[type="text"]') as HTMLInputElement
    if (firstInput) {
      firstInput.focus()
    }
  }, [])

  const formatValue = useCallback(
    (value: number) => {
      return props.profile.formatValue(value)
    },
    [props.profile],
  )

  // Strict interval filtering with synthetic events at boundaries
  const filterEventsWithContext = useCallback((events: any[], intervalStart: number, intervalEnd: number) => {
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
  }, [])

  const generateJsonPreview = useCallback(async () => {
    setIsGeneratingPreview(true)
    setPreviewProgress('Preparing profile data...')
    
    try {
      // Get the original profile data directly
      const originalProfile = props.profile
      
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
      setPreviewProgress('Generating events...')
      const events: any[] = []
      const openFrame = (node: any, value: number) => {
        events.push({
          type: 'O',
          frame: getIndexForFrame(node.frame),
          at: parseInt(value.toString()), // Convert to integer
        })
      }
      const closeFrame = (node: any, value: number) => {
        events.push({
          type: 'C',
          frame: getIndexForFrame(node.frame),
          at: parseInt(value.toString()), // Convert to integer
        })
      }
      
      // Use setTimeout to yield control back to the browser
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          originalProfile.forEachCall(openFrame, closeFrame)
          resolve()
        }, 0)
      })
      
      // Apply advanced filtering algorithm
      setPreviewProgress('Filtering events...')
      const filteredEvents = await new Promise<any[]>((resolve) => {
        setTimeout(() => {
          const result = filterEventsWithContext(events, startValue, endValue)
          resolve(result)
        }, 0)
      })
      
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
      
      // Create the exported data structure
      setPreviewProgress('Building JSON structure...')
      const exportedData = {
        exporter: `speedscope@${require('../../package.json').version}`,
        name: `${props.profile.getName()} (${formatValue(startValue)} - ${formatValue(endValue)})`,
        activeProfileIndex: 0,
        $schema: 'https://www.speedscope.app/file-format-schema.json',
        shared: {frames},
        profiles: [{
          type: 'evented',
          name: props.profile.getName(),
          unit: props.profile.getWeightUnit(),
          startValue: profileStartValue,
          endValue: profileEndValue,
          events: filteredEvents,
        }],
      }
      
      // JSON serialization with progress update
      setPreviewProgress('Serializing JSON...')
      const jsonString = await new Promise<string>((resolve) => {
        setTimeout(() => {
          const result = JSON.stringify(exportedData, null, 2)
          resolve(result)
        }, 0)
      })
      
      const truncatedJson =
        jsonString.length > 5000 ? jsonString.substring(0, 5000) + '\n... (truncated)' : jsonString

      setJsonPreview(truncatedJson)
      setFilteredJsonData(jsonString) // Store the full JSON data for sending to LLM
      setPreviewProgress('')
    } catch (error) {
      setJsonPreview('Error generating JSON preview: ' + (error as Error).message)
      setPreviewProgress('')
    } finally {
      setIsGeneratingPreview(false)
    }
  }, [startValue, endValue, props.profile, formatValue, filterEventsWithContext])

  const generateCondensedView = useCallback(async () => {
    try {
      // Get the original profile data directly
      const originalProfile = props.profile
      
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
      const openFrame = (node: any, value: number) => {
        events.push({
          type: 'O',
          frame: getIndexForFrame(node.frame),
          at: parseInt(value.toString()), // Convert to integer
        })
      }
      const closeFrame = (node: any, value: number) => {
        events.push({
          type: 'C',
          frame: getIndexForFrame(node.frame),
          at: parseInt(value.toString()), // Convert to integer
        })
      }
      
      // Use setTimeout to yield control back to the browser
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          originalProfile.forEachCall(openFrame, closeFrame)
          resolve()
        }, 0)
      })
      
      // Apply advanced filtering algorithm
      const filteredEvents = await new Promise<any[]>((resolve) => {
        setTimeout(() => {
          const result = filterEventsWithContext(events, startValue, endValue)
          resolve(result)
        }, 0)
      })
      
      // Create the exported data structure
      const exportedData = {
        exporter: `speedscope@${require('../../package.json').version}`,
        name: `${props.profile.getName()} (${formatValue(startValue)} - ${formatValue(endValue)})`,
        activeProfileIndex: 0,
        $schema: 'https://www.speedscope.app/file-format-schema.json',
        shared: {frames},
        profiles: [{
          type: 'evented',
          name: props.profile.getName(),
          unit: props.profile.getWeightUnit(),
          startValue: startValue,
          endValue: endValue,
          events: filteredEvents,
        }],
      }

      // Generate condensed view from samples
      let condensedOutput = '=== CONDENSED VIEW ===\n\n'
      
      // Create frame number to frame name mapping
      const frameMap = new Map<number, string>()
      for (let i = 0; i < exportedData.shared.frames.length; i++) {
        const frame = exportedData.shared.frames[i]
        frameMap.set(i, frame.name)
      }

      // Display frame mapping
      condensedOutput += 'FRAME MAPPING:\n'
      condensedOutput += 'Frame # | Frame Name\n'
      condensedOutput += '--------|-----------\n'
      for (let i = 0; i < exportedData.shared.frames.length; i++) {
        const frame = exportedData.shared.frames[i]
        condensedOutput += `${i.toString().padStart(7)} | ${frame.name}\n`
      }
      condensedOutput += '\n'

      if (exportedData.profiles.length > 0) {
        const profile = exportedData.profiles[0]
        if (profile.type === 'evented') {
          // Track the call stack from events
          const callStack: number[] = []
          const stackHistory: Array<{time: number; stack: number[]}> = []
          
          // Sort events by timestamp
          const sortedEvents = [...profile.events].sort((a, b) => a.at - b.at)
          
          for (const event of sortedEvents) {
            if (event.type === 'O') { // Open frame
              callStack.push(event.frame)
            } else if (event.type === 'C') { // Close frame
              const frameIndex = callStack.lastIndexOf(event.frame)
              if (frameIndex !== -1) {
                callStack.splice(frameIndex, 1)
              }
            }
            
            // Record the current stack state
            stackHistory.push({
              time: event.at,
              stack: [...callStack]
            })
          }

          // Display condensed view
          condensedOutput += 'CONDENSED VIEW:\n'
          condensedOutput += 'Time | Stack (Frame #s)\n'
          condensedOutput += '-----|-----------------\n'
          
          for (const entry of stackHistory) {
            const timeFormatted = formatValue(entry.time)
            const stackStr = entry.stack.length > 0 ? `[${entry.stack.join(' ')}]` : '[]'
            condensedOutput += `${timeFormatted.padStart(4)} | ${stackStr}\n`
          }
        }
      }

      setCondensedView(condensedOutput)
    } catch (error) {
      setCondensedView('Error generating condensed view: ' + (error as Error).message)
    }
  }, [startValue, endValue, props.profile, formatValue, filterEventsWithContext])



  // Update values when initial values change (for sync functionality)
  useEffect(() => {
    if (props.initialStartValue !== undefined) {
      setStartValue(props.initialStartValue)
      setStartPercent((props.initialStartValue / totalWeight) * 100)
    }
    if (props.initialEndValue !== undefined) {
      setEndValue(props.initialEndValue)
      setEndPercent((props.initialEndValue / totalWeight) * 100)
    }
  }, [props.initialStartValue, props.initialEndValue, totalWeight])

  // Generate JSON preview when interval changes
  useEffect(() => {
    const generatePreviews = async () => {
      await generateJsonPreview()
      await generateCondensedView()
    }
    generatePreviews()
  }, [generateJsonPreview, generateCondensedView])

  // Regenerate JSON preview when initial values change (for when user reopens modal with new interval)
  useEffect(() => {
    if (props.initialStartValue !== undefined && props.initialEndValue !== undefined) {
      const generatePreviews = async () => {
        await generateJsonPreview()
        await generateCondensedView()
      }
      generatePreviews()
    }
  }, [
    props.initialStartValue,
    props.initialEndValue,
    generateJsonPreview,
    generateCondensedView,
  ])

  const handleExportJson = () => {
    try {
      // Get the original profile data directly
      const originalProfile = props.profile
      
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

      // Generate events using the same logic as exportProfile but preserve original timestamps
      const events: any[] = []
      const openFrame = (node: any, value: number) => {
        events.push({
          type: 'O',
          frame: getIndexForFrame(node.frame),
          at: parseInt(value.toString()), // Convert to integer
        })
      }
      const closeFrame = (node: any, value: number) => {
        events.push({
          type: 'C',
          frame: getIndexForFrame(node.frame),
          at: parseInt(value.toString()), // Convert to integer
        })
      }
      
      originalProfile.forEachCall(openFrame, closeFrame)
      
      // Apply advanced filtering algorithm
      const filteredEvents = filterEventsWithContext(events, startValue, endValue)
      
      // Use the actual first and last event timestamps from the filtered events, converted to integers
      const sortedEvents = filteredEvents.sort((a, b) => a.at - b.at)
      const profileStartValue = sortedEvents.length > 0 ? parseInt(sortedEvents[0].at.toString()) : 0
      const profileEndValue = sortedEvents.length > 0 ? parseInt(sortedEvents[sortedEvents.length - 1].at.toString()) : 0
      
      // Create the exported data structure
      const exportedData = {
        exporter: `speedscope@${require('../../package.json').version}`,
        name: `${props.profile.getName()} (${formatValue(startValue)} - ${formatValue(endValue)})`,
        activeProfileIndex: 0,
        $schema: 'https://www.speedscope.app/file-format-schema.json',
        shared: {frames},
        profiles: [{
          type: 'evented',
          name: props.profile.getName(),
          unit: props.profile.getWeightUnit(),
          startValue: profileStartValue,
          endValue: profileEndValue,
          events: filteredEvents,
        }],
      }
      
      const jsonString = JSON.stringify(exportedData, null, 2)

      // Create a blob and download link
      const blob = new Blob([jsonString], {type: 'application/json'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `speedscope-filtered-${formatValue(startValue)}-to-${formatValue(endValue)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Error exporting JSON: ' + (error as Error).message)
    }
  }

  const handleConfirm = () => {
    if (!oauthUrl || !clientId || !clientSecret) {
      alert('Please fill in all OAuth fields: OAuth URL, CLIENT_ID, and CLIENT_SECRET')
      return
    }

    if (!selectedPrompt) {
      alert('Please select a prompt from the dropdown')
      return
    }

    if (!filteredJsonData) {
      alert('Please wait for the preview to finish generating before sending to LLM')
      return
    }

    const oauthConfig: OAuthConfig = {
      oauthUrl,
      clientId,
      clientSecret,
    }
    props.onConfirm(startValue, endValue, oauthConfig, selectedPrompt, filteredJsonData)
  }

  return (
    <div
      className={css(style.overlay)}
      onKeyDown={e => e.stopPropagation()}
      onKeyUp={e => e.stopPropagation()}
      onKeyPress={e => e.stopPropagation()}
    >
      <div
        className={css(style.modal)}
        onKeyDown={e => e.stopPropagation()}
        onKeyUp={e => e.stopPropagation()}
        onKeyPress={e => e.stopPropagation()}
      >
        <div className={css(style.header)}>
          <h3>Select Time Interval</h3>
          <button className={css(style.closeButton)} onClick={props.onCancel}>
            ✕
          </button>
        </div>

        <div className={css(style.content)}>
          <p>Time range based on current zoom level:</p>

          <div className={css(style.rangeInfo)}>
            <div className={css(style.rangeLabels)}>
              <span>Start: {formatValue(startValue)}</span>
              <span>End: {formatValue(endValue)}</span>
            </div>

            <div className={css(style.rangeBar)}>
              <div
                className={css(style.selectedRange)}
                style={{
                  left: `${startPercent}%`,
                  width: `${endPercent - startPercent}%`,
                }}
              />
            </div>
          </div>

          <div className={css(style.info)}>
            <p>Total duration: {formatValue(totalWeight)}</p>
            <p>Selected duration: {formatValue(endValue - startValue)}</p>
            <p>Unit: {unit}</p>
            <p className={css(style.hint)}>
              💡 Tip: Zoom and pan the flamegraph to adjust the time range for LLM analysis
            </p>
          </div>

          <div className={css(style.sideBySideContainer)}>
            <div className={css(style.promptSection)}>
              <h4>LLM Analysis Prompt</h4>
              <div className={css(style.promptFields)}>
                <div className={css(style.fieldGroup)}>
                  <label className={css(style.label)}>Select Analysis Prompt:</label>
                  <select
                    value={selectedPrompt}
                    onChange={e => setSelectedPrompt((e.target as HTMLSelectElement).value)}
                    className={css(style.select)}
                  >
                    <option value="">Choose an analysis prompt...</option>
                    {samplePrompts.map((prompt, index) => (
                      <option key={index} value={prompt}>
                        {prompt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={css(style.oauthSection)}>
              <h4>OAuth Configuration</h4>
              <div className={css(style.oauthFields)}>
                <div className={css(style.fieldGroup)}>
                  <label className={css(style.label)}>OAuth URL:</label>
                  <input
                    type="text"
                    value={oauthUrl}
                    onChange={e => setOauthUrl((e.target as HTMLInputElement).value)}
                    onKeyDown={e => e.stopPropagation()}
                    onKeyUp={e => e.stopPropagation()}
                    onKeyPress={e => e.stopPropagation()}
                    className={css(style.input)}
                    placeholder="https://your-oauth-server.com/oauth/token"
                  />
                </div>
                <div className={css(style.fieldGroup)}>
                  <label className={css(style.label)}>CLIENT_ID:</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={e => setClientId((e.target as HTMLInputElement).value)}
                    onKeyDown={e => e.stopPropagation()}
                    onKeyUp={e => e.stopPropagation()}
                    onKeyPress={e => e.stopPropagation()}
                    className={css(style.input)}
                    placeholder="your-client-id"
                  />
                </div>
                <div className={css(style.fieldGroup)}>
                  <label className={css(style.label)}>CLIENT_SECRET:</label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={e => setClientSecret((e.target as HTMLInputElement).value)}
                    onKeyDown={e => e.stopPropagation()}
                    onKeyUp={e => e.stopPropagation()}
                    onKeyPress={e => e.stopPropagation()}
                    className={css(style.input)}
                    placeholder="your-client-secret"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={css(style.jsonPreviewSection)}>
          <div className={css(style.jsonPreviewHeader)}>
            <h4>Preview</h4>
            <div className={css(style.previewButtons)}>
              <button
                className={css(
                  style.viewToggleButton,
                  showCondensedView ? style.inactiveButton : style.activeButton,
                )}
                onClick={() => setShowCondensedView(false)}
              >
                JSON
              </button>
              <button
                className={css(
                  style.viewToggleButton,
                  showCondensedView ? style.activeButton : style.inactiveButton,
                )}
                onClick={() => setShowCondensedView(true)}
              >
                Condensed
              </button>
              <button className={css(style.exportButton)} onClick={handleExportJson}>
                📁 Export JSON
              </button>
            </div>
          </div>
          <p className={css(style.jsonPreviewInfo)}>
            {showCondensedView
              ? 'Condensed view showing call stack changes over time:'
              : 'Preview of the filtered profile data that will be sent to the LLM:'}
          </p>
          <div className={css(style.jsonPreviewContainer)}>
            {isGeneratingPreview ? (
              <div className={css(style.previewLoading)}>
                <div className={css(style.previewSpinner)}>⏳</div>
                <div className={css(style.previewLoadingText)}>
                  {previewProgress || 'Generating preview...'}
                </div>
              </div>
            ) : (
              <pre className={css(style.jsonPreview)}>
                {showCondensedView ? condensedView : jsonPreview}
              </pre>
            )}
          </div>
        </div>

        <div className={css(style.actions)}>
          <button className={css(style.button, style.cancelButton)} onClick={props.onCancel}>
            Cancel
          </button>
          <button className={css(style.button, style.confirmButton)} onClick={handleConfirm}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

const getStyle = withTheme(theme =>
  StyleSheet.create({
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modal: {
      background: theme.bgPrimaryColor,
      border: `1px solid ${theme.fgSecondaryColor}`,
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      maxWidth: '800px',
      width: '95%',
      maxHeight: '80vh',
      overflowY: 'auto',
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '16px 20px',
      borderBottom: `1px solid ${theme.fgSecondaryColor}`,
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '18px',
      cursor: 'pointer',
      color: theme.fgSecondaryColor,
      padding: '4px 8px',
      borderRadius: '4px',
      ':hover': {
        background: theme.bgSecondaryColor,
      },
    },
    content: {
      padding: '20px',
    },
    rangeContainer: {
      margin: '20px 0',
    },
    rangeLabels: {
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '10px',
      fontSize: FontSize.LABEL,
      color: theme.fgSecondaryColor,
    },
    rangeInfo: {
      marginBottom: '10px',
    },
    rangeBar: {
      position: 'relative',
      height: '8px',
      background: theme.bgSecondaryColor,
      borderRadius: '4px',
      marginTop: '10px',
    },
    selectedRange: {
      position: 'absolute',
      height: '100%',
      background: theme.selectionPrimaryColor,
      borderRadius: '4px',
      pointerEvents: 'none',
    },
    info: {
      marginTop: '20px',
      padding: '12px',
      background: theme.bgSecondaryColor,
      borderRadius: '4px',
      fontSize: FontSize.LABEL,
    },
    hint: {
      marginTop: '10px',
      padding: '8px',
      background: theme.selectionPrimaryColor,
      borderRadius: '4px',
      color: theme.altFgPrimaryColor,
      fontSize: FontSize.LABEL,
    },
    actions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      padding: '16px 20px',
      borderTop: `1px solid ${theme.fgSecondaryColor}`,
    },
    button: {
      padding: '8px 16px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontFamily: FontFamily.MONOSPACE,
      fontSize: FontSize.LABEL,
      transition: `all ${Duration.HOVER_CHANGE} ease-in`,
    },

    cancelButton: {
      background: theme.bgSecondaryColor,
      color: theme.fgPrimaryColor,
      ':hover': {
        background: theme.fgSecondaryColor,
      },
    },
    confirmButton: {
      background: theme.selectionPrimaryColor,
      color: theme.altFgPrimaryColor,
      ':hover': {
        background: theme.selectionSecondaryColor,
      },
    },
    oauthSection: {
      flex: 1,
      padding: '16px',
      background: theme.bgSecondaryColor,
      borderRadius: '4px',
      border: `1px solid ${theme.fgSecondaryColor}`,
    },
    authChoice: {
      display: 'flex',
      gap: '20px',
      marginBottom: '16px',
    },
    radioLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      fontSize: FontSize.LABEL,
      color: theme.fgPrimaryColor,
    },
    radio: {
      cursor: 'pointer',
    },
    oauthFields: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    fieldGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    },
    label: {
      fontSize: FontSize.LABEL,
      color: theme.fgPrimaryColor,
      fontWeight: 'bold',
    },
    input: {
      padding: '8px 12px',
      border: `1px solid ${theme.fgSecondaryColor}`,
      borderRadius: '4px',
      background: theme.bgPrimaryColor,
      color: theme.fgPrimaryColor,
      fontFamily: FontFamily.MONOSPACE,
      fontSize: FontSize.LABEL,
      ':focus': {
        outline: 'none',
        borderColor: theme.selectionPrimaryColor,
      },
    },
    sideBySideContainer: {
      display: 'flex',
      gap: '20px',
      marginTop: '20px',
    },
    promptSection: {
      flex: 1,
      padding: '16px',
      background: theme.bgSecondaryColor,
      borderRadius: '4px',
      border: `1px solid ${theme.fgSecondaryColor}`,
    },
    promptFields: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    },
    select: {
      padding: '8px 12px',
      border: `1px solid ${theme.fgSecondaryColor}`,
      borderRadius: '4px',
      background: theme.bgPrimaryColor,
      color: theme.fgPrimaryColor,
      fontFamily: FontFamily.MONOSPACE,
      fontSize: FontSize.LABEL,
      cursor: 'pointer',
      ':focus': {
        outline: 'none',
        borderColor: theme.selectionPrimaryColor,
      },
    },
    jsonPreviewSection: {
      marginTop: '20px',
      padding: '16px',
      background: theme.bgSecondaryColor,
      borderRadius: '4px',
      border: `1px solid ${theme.fgSecondaryColor}`,
    },
    jsonPreviewHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px',
    },
    previewButtons: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
    },
    viewToggleButton: {
      padding: '4px 8px',
      border: `1px solid ${theme.fgSecondaryColor}`,
      borderRadius: '4px',
      background: theme.bgPrimaryColor,
      color: theme.fgPrimaryColor,
      fontFamily: FontFamily.MONOSPACE,
      fontSize: FontSize.LABEL,
      cursor: 'pointer',
      transition: `all ${Duration.HOVER_CHANGE} ease-in`,
    },
    activeButton: {
      background: theme.selectionPrimaryColor,
      color: theme.altFgPrimaryColor,
    },
    inactiveButton: {
      background: theme.bgPrimaryColor,
      color: theme.fgPrimaryColor,
      ':hover': {
        background: theme.bgSecondaryColor,
      },
    },
    exportButton: {
      padding: '6px 12px',
      border: `1px solid ${theme.fgSecondaryColor}`,
      borderRadius: '4px',
      background: theme.bgPrimaryColor,
      color: theme.fgPrimaryColor,
      fontFamily: FontFamily.MONOSPACE,
      fontSize: FontSize.LABEL,
      cursor: 'pointer',
      transition: `all ${Duration.HOVER_CHANGE} ease-in`,
      ':hover': {
        background: theme.selectionPrimaryColor,
        color: theme.altFgPrimaryColor,
      },
    },
    jsonPreviewInfo: {
      marginBottom: '12px',
      fontSize: FontSize.LABEL,
      color: theme.fgSecondaryColor,
    },
    jsonPreviewContainer: {
      maxHeight: '400px',
      overflow: 'auto',
      border: `1px solid ${theme.fgSecondaryColor}`,
      borderRadius: '4px',
      background: theme.bgPrimaryColor,
    },
    jsonPreview: {
      margin: 0,
      padding: '12px',
      fontSize: FontSize.LABEL,
      fontFamily: FontFamily.MONOSPACE,
      color: theme.fgPrimaryColor,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    },
    previewLoading: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      color: theme.fgSecondaryColor,
    },
    previewSpinner: {
      fontSize: 24,
      marginBottom: 12,
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
    previewLoadingText: {
      fontSize: FontSize.LABEL,
      textAlign: 'center',
    },
  }),
)
