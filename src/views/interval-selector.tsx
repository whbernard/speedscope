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
    oauthConfig?: any,
    prompt?: string,
    filteredJsonData?: string,
    llmConfig?: any,
  ) => void
  onCancel: () => void
  theme: Theme
  initialStartValue?: number
  initialEndValue?: number
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
  // OAuth URL, Grant Type, and Scope are now hardcoded in the adapters
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [oauthProvider] = useState<'generic'>('generic')
  const [llmProvider] = useState<'bedrockClaudeSonnet'>('bedrockClaudeSonnet')
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const [hasCachedToken, setHasCachedToken] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewContent, setPreviewContent] = useState('')

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

  // Check for cached token when client ID changes
  useEffect(() => {
    if (clientId) {
      // For now, assume no cached token (simplified implementation)
      setHasCachedToken(false)
    } else {
      setHasCachedToken(false)
    }
  }, [clientId, oauthProvider])

  const formatValue = useCallback(
    (value: number) => {
      return props.profile.formatValue(value)
    },
    [props.profile],
  )

  // Strict interval filtering with synthetic events at boundaries
  const filterEventsWithContext = useCallback(
    (events: any[], intervalStart: number, intervalEnd: number) => {
      // Track frame states and events within the interval
      const framesInInterval = new Set<number>()
      const frameStates = new Map<
        number,
        {hasOpen: boolean; hasClose: boolean; openTime?: number; closeTime?: number}
      >()
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
            at: parseInt(intervalEnd.toString()),
          })
          console.log(`Added synthetic close for frame ${frameId} at ${intervalEnd}`)
        } else if (!frameState.hasOpen && frameState.hasClose) {
          // Frame closed in interval but didn't open - add synthetic open at interval start
          syntheticEvents.push({
            type: 'O',
            frame: frameId,
            at: parseInt(intervalStart.toString()),
          })
          console.log(`Added synthetic open for frame ${frameId} at ${intervalStart}`)
        }
      }

      // Combine filtered events with synthetic events and sort by timestamp
      const allEvents = [...filteredEvents, ...syntheticEvents]
      const sortedEvents = allEvents.sort((a, b) => a.at - b.at)

      console.log(
        `Filtered ${filteredEvents.length} events + ${syntheticEvents.length} synthetic events = ${sortedEvents.length} total events for ${framesInInterval.size} active frames`,
      )
      return sortedEvents
    },
    [],
  )

  // Reduce frame table to only frames referenced by events and remap event frame indices
  function compressFramesAndRemap(
    frames: any[],
    events: {type: 'O' | 'C'; frame: number; at: number}[],
  ): {frames: any[]; events: {type: 'O' | 'C'; frame: number; at: number}[]} {
    const used = new Set<number>()
    for (const ev of events) used.add(ev.frame)
    const oldToNew = new Map<number, number>()
    const newFrames: any[] = []
    for (const ev of events) {
      if (!oldToNew.has(ev.frame)) {
        const newIndex = newFrames.length
        oldToNew.set(ev.frame, newIndex)
        newFrames.push(frames[ev.frame])
      }
    }
    const remapped = events.map(ev => ({...ev, frame: oldToNew.get(ev.frame)!}))
    return {frames: newFrames, events: remapped}
  }

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

  const generateFilteredJsonData = () => {
    try {
      // Build frames table and event list for the full profile
      const frames: any[] = []
      const indexForFrame = new Map<any, number>()
      function getIndexForFrame(frame: any): number {
        let index = indexForFrame.get(frame)
        if (index == null) {
          const serializedFrame: any = {name: frame.name}
          if (frame.file != null) serializedFrame.file = frame.file
          if (frame.line != null) serializedFrame.line = frame.line
          if (frame.col != null) serializedFrame.col = frame.col
          index = frames.length
          indexForFrame.set(frame, index)
          frames.push(serializedFrame)
        }
        return index
      }

      const events: {type: 'O' | 'C'; frame: number; at: number}[] = []
      props.profile.forEachCall(
        (node, value) =>
          events.push({
            type: 'O',
            frame: getIndexForFrame(node.frame),
            at: parseInt(value.toString()),
          }),
        (node, value) =>
          events.push({
            type: 'C',
            frame: getIndexForFrame(node.frame),
            at: parseInt(value.toString()),
          }),
      )

      // Filter events within the selected interval
      const filteredEvents = events.filter(event => {
        return event.at >= startValue && event.at <= endValue
      })

      // Get unique frame indices from filtered events
      const frameIndices = new Set<number>()
      filteredEvents.forEach(event => {
        frameIndices.add(event.frame)
      })

      // Build symbol table with only frames that appear in the filtered events
      const symbolTable: Array<{name: string}> = []
      const frameIndexMap = new Map<number, number>()
      let newIndex = 0

      frameIndices.forEach(frameIndex => {
        const frame = frames[frameIndex]
        if (frame) {
          symbolTable.push({name: frame.name})
          frameIndexMap.set(frameIndex, newIndex)
          newIndex++
        }
      })

      // Compress the filtered events by combining consecutive events with the same frame
      const compressedEvents: Array<{at: number; frame: number}> = []
      let lastEvent: {at: number; frame: number} | null = null

      filteredEvents.forEach(event => {
        const newFrameIndex = frameIndexMap.get(event.frame)
        if (newFrameIndex !== undefined) {
          if (lastEvent && lastEvent.frame === newFrameIndex) {
            // Combine with previous event
            lastEvent.at = event.at
          } else {
            // Start new event
            lastEvent = {at: event.at, frame: newFrameIndex}
            compressedEvents.push(lastEvent)
          }
        }
      })

      const result = {
        version: '0.5.0',
        $schema: 'https://www.speedscope.app/file-format-schema.json',
        shared: {
          frames: symbolTable,
        },
        profiles: [
          {
            type: 'evented',
            name: 'Filtered Profile',
            unit: 'microseconds',
            startValue,
            endValue,
            events: compressedEvents,
          },
        ],
      }

      return JSON.stringify(result, null, 2)
    } catch (error) {
      throw new Error('Error generating JSON data: ' + (error as Error).message)
    }
  }

  const generateFilteredTextData = () => {
    try {
      // Build frames table and event list for the full profile
      const frames: any[] = []
      const indexForFrame = new Map<any, number>()
      function getIndexForFrame(frame: any): number {
        let index = indexForFrame.get(frame)
        if (index == null) {
          const serializedFrame: any = {name: frame.name}
          if (frame.file != null) serializedFrame.file = frame.file
          if (frame.line != null) serializedFrame.line = frame.line
          if (frame.col != null) serializedFrame.col = frame.col
          index = frames.length
          indexForFrame.set(frame, index)
          frames.push(serializedFrame)
        }
        return index
      }

      const events: {type: 'O' | 'C'; frame: number; at: number}[] = []
      props.profile.forEachCall(
        (node, value) =>
          events.push({
            type: 'O',
            frame: getIndexForFrame(node.frame),
            at: parseInt(value.toString()),
          }),
        (node, value) =>
          events.push({
            type: 'C',
            frame: getIndexForFrame(node.frame),
            at: parseInt(value.toString()),
          }),
      )

      // Filter to interval with synthetic boundaries (reuse logic)
      let filtered = filterEventsWithContext(events, startValue, endValue)
      filtered.sort((a, b) => a.at - b.at)

      // Compress frames and remap filtered events
      const compressed = compressFramesAndRemap(frames, filtered)
      const framesSlim = compressed.frames
      filtered = compressed.events

      // Build stack transitions and durations
      const stack: number[] = []
      const lines: string[] = []

      // Symbol table
      lines.push('# symbols')
      for (let i = 0; i < framesSlim.length; i++) {
        lines.push(`${i}\t${framesSlim[i].name}`)
      }
      lines.push('# frames are referenced by index from left (top) to right (bottom)')
      lines.push('# stack [ top ... bottom ]\t<duration> (same units as profile)')

      let prevTime = filtered.length > 0 ? filtered[0].at : startValue
      for (const ev of filtered) {
        // On transition, emit previous stack with duration
        const duration = ev.at - prevTime
        if (duration > 0 && stack.length > 0) {
          const stackText = `[ ${stack.join(' ')} ]\t${duration}`
          lines.push(stackText)
        }

        // Apply event
        if (ev.type === 'O') {
          // Push opened frame to top (leftmost)
          stack.unshift(ev.frame)
        } else {
          // Close: remove the first occurrence from top (leftmost first)
          const idx = stack.indexOf(ev.frame)
          if (idx >= 0) stack.splice(idx, 1)
        }
        prevTime = ev.at
      }

      // Flush tail up to endValue if needed
      const tailDuration = endValue - prevTime
      if (tailDuration > 0 && stack.length > 0) {
        lines.push(`[ ${stack.join(' ')} ]\t${tailDuration}`)
      }

      return lines.join('\n')
    } catch (error) {
      throw new Error('Error generating text data: ' + (error as Error).message)
    }
  }

  const handlePreview = () => {
    try {
      const textData = generateFilteredTextData()
      setPreviewContent(textData)
      setShowPreview(true)
    } catch (error) {
      alert('Error generating preview: ' + (error as Error).message)
    }
  }

  const handleConfirm = () => {
    if (!clientId || !clientSecret) {
      alert('Please fill in all authentication fields: Client ID and Client Secret')
      return
    }

    if (!selectedPrompt) {
      alert('Please select a prompt from the dropdown')
      return
    }

    try {
      const textData = generateFilteredTextData()
      const oauthConfig = {
        clientId,
        clientSecret,
        provider: oauthProvider,
        // oauthUrl, grantType, and scope are now hardcoded in the adapters
      }
      const llmConfig = {
        provider: llmProvider,
        // endpoint, maxTokens, and temperature are now hardcoded in the adapters
      }
      props.onConfirm(startValue, endValue, oauthConfig, selectedPrompt, textData, llmConfig)
    } catch (error) {
      alert('Error preparing data for LLM: ' + (error as Error).message)
    }
  }

  const handlePreviewConfirm = () => {
    setShowPreview(false)
    handleConfirm()
  }

  const handleExportPreviewJson = () => {
    try {
      const jsonData = generateFilteredJsonData()
      const blob = new Blob([jsonData], {type: 'application/json'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `filtered-profile-${startValue}-${endValue}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Error exporting JSON: ' + (error as Error).message)
    }
  }

  const handleExportPreviewText = () => {
    try {
      const blob = new Blob([previewContent], {type: 'text/plain'})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `filtered-profile-${startValue}-${endValue}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      alert('Error exporting text: ' + (error as Error).message)
    }
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
              <h4>API Configuration</h4>

              <div className={css(style.oauthFields)}>
                <div className={css(style.fieldGroup)}>
                  <label className={css(style.label)}>Client ID:</label>
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
                  <label className={css(style.label)}>Client Secret:</label>
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

              {hasCachedToken && (
                <div className={css(style.tokenStatus)}>
                  <span className={css(style.tokenStatusIcon)}>🔐</span>
                  <span className={css(style.tokenStatusText)}>
                    Valid token cached - no re-authentication needed
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className={css(style.actions)}>
          <button className={css(style.button, style.cancelButton)} onClick={props.onCancel}>
            Cancel
          </button>
          <button className={css(style.button, style.previewButton)} onClick={handlePreview}>
            Preview
          </button>
          <button className={css(style.button, style.confirmButton)} onClick={handleConfirm}>
            Send
          </button>
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div className={css(style.previewOverlay)}>
            <div className={css(style.previewModal)}>
              <div className={css(style.previewHeader)}>
                <h3>Preview: Content to be sent to LLM</h3>
                <button
                  className={css(style.previewCloseButton)}
                  onClick={() => setShowPreview(false)}
                >
                  ✕
                </button>
              </div>
              <div className={css(style.previewContent)}>
                <pre>{previewContent}</pre>
              </div>
              <div className={css(style.previewActions)}>
                <div className={css(style.exportButtonsGroup)}>
                  <button
                    className={css(style.button, style.exportButton)}
                    onClick={handleExportPreviewJson}
                  >
                    📄 Export JSON
                  </button>
                  <button
                    className={css(style.button, style.exportButton)}
                    onClick={handleExportPreviewText}
                  >
                    📄 Export Condensed Format
                  </button>
                </div>
                <div className={css(style.actionButtonsGroup)}>
                  <button
                    className={css(style.button, style.cancelButton)}
                    onClick={() => setShowPreview(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className={css(style.button, style.confirmButton)}
                    onClick={handlePreviewConfirm}
                  >
                    Send to LLM
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
    providerSection: {
      display: 'flex',
      gap: '16px',
      marginBottom: '16px',
      padding: '12px',
      background: theme.bgPrimaryColor,
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
    exportButton: {
      padding: '8px 16px',
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
    tokenStatus: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '12px',
      padding: '8px 12px',
      background: theme.selectionPrimaryColor,
      borderRadius: '4px',
      border: `1px solid ${theme.selectionSecondaryColor}`,
    },
    tokenStatusIcon: {
      fontSize: '16px',
    },
    tokenStatusText: {
      fontSize: FontSize.LABEL,
      color: theme.altFgPrimaryColor,
      fontWeight: 'bold',
    },
    previewButton: {
      background: theme.bgSecondaryColor,
      color: theme.fgPrimaryColor,
      border: `1px solid ${theme.fgSecondaryColor}`,
      '&:hover': {
        background: theme.fgSecondaryColor,
        color: theme.bgPrimaryColor,
      },
    },
    previewOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
    },
    previewModal: {
      background: theme.bgPrimaryColor,
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      width: '800px',
      display: 'flex',
      flexDirection: 'column',
    },
    previewHeader: {
      padding: '20px 24px',
      borderBottom: `1px solid ${theme.fgSecondaryColor}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      '& h3': {
        margin: 0,
        fontSize: '1.2em',
        color: theme.fgPrimaryColor,
        fontWeight: 'bold',
      },
    },
    previewCloseButton: {
      background: 'none',
      border: 'none',
      fontSize: '20px',
      color: theme.fgPrimaryColor,
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      '&:hover': {
        background: theme.fgSecondaryColor,
        color: theme.bgPrimaryColor,
      },
    },
    previewContent: {
      padding: '24px',
      overflow: 'auto',
      flex: 1,
      '& pre': {
        margin: 0,
        fontSize: FontSize.LABEL,
        fontFamily: FontFamily.MONOSPACE,
        color: theme.fgPrimaryColor,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: 1.4,
      },
    },
    previewActions: {
      padding: '16px 24px',
      borderTop: `1px solid ${theme.fgSecondaryColor}`,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '12px',
    },
    exportButtonsGroup: {
      display: 'flex',
      gap: '8px',
    },
    actionButtonsGroup: {
      display: 'flex',
      gap: '12px',
    },
  }),
)
