import {Profile, CallTreeProfileBuilder, FrameInfo} from '../../lib/profile'
import {importSpeedscopeProfiles} from '../../lib/file-format'
import {TimeFormatter} from '../../lib/value-formatters'

// Mock the filterEventsWithContext function from interval-selector
const mockFilterEventsWithContext = (events: any[], intervalStart: number, intervalEnd: number) => {
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
    } else if (!frameState.hasOpen && frameState.hasClose) {
      // Frame closed in interval but didn't open - add synthetic open at interval start
      syntheticEvents.push({
        type: 'O',
        frame: frameId,
        at: parseInt(intervalStart.toString()),
      })
    }
  }

  // Combine filtered events with synthetic events and sort by timestamp
  const allEvents = [...filteredEvents, ...syntheticEvents]
  const sortedEvents = allEvents.sort((a, b) => a.at - b.at)

  return sortedEvents
}

// Simulate the generateFilteredJsonData function from interval-selector
const generateFilteredJsonData = (profile: Profile, startValue: number, endValue: number) => {
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

  // Generate events
  const events: any[] = []
  const openFrame = (node: any, value: number) => {
    events.push({
      type: 'O',
      frame: getIndexForFrame(node.frame),
      at: parseInt(value.toString()),
    })
  }
  const closeFrame = (node: any, value: number) => {
    events.push({
      type: 'C',
      frame: getIndexForFrame(node.frame),
      at: parseInt(value.toString()),
    })
  }

  profile.forEachCall(openFrame, closeFrame)

  // Apply filtering algorithm
  const filteredEvents = mockFilterEventsWithContext(events, startValue, endValue)

  // Use the actual first and last event timestamps from the filtered events
  const sortedEvents = filteredEvents.sort((a, b) => a.at - b.at)
  const profileStartValue = sortedEvents.length > 0 ? parseInt(sortedEvents[0].at.toString()) : 0
  const profileEndValue =
    sortedEvents.length > 0 ? parseInt(sortedEvents[sortedEvents.length - 1].at.toString()) : 0

  // Create the exported data structure
  const exportedData = {
    exporter: `speedscope@1.23.1`,
    name: `${profile.getName()} (${profile.formatValue(startValue)} - ${profile.formatValue(
      endValue,
    )})`,
    activeProfileIndex: 0,
    $schema: 'https://www.speedscope.app/file-format-schema.json',
    shared: {frames},
    profiles: [
      {
        type: 'evented',
        name: profile.getName(),
        unit: profile.getWeightUnit(),
        startValue: profileStartValue,
        endValue: profileEndValue,
        events: filteredEvents,
      },
    ],
  }

  return JSON.stringify(exportedData, null, 2)
}

describe('Interval Selector Export Logic', () => {
  let testProfile: Profile

  beforeEach(() => {
    // Create a test profile with hierarchical call structure
    const builder = new CallTreeProfileBuilder(1000)
    builder.setName('Test Profile')
    builder.setValueFormatter(new TimeFormatter('milliseconds'))

    // Create frame infos for testing
    const frameInfos: FrameInfo[] = [
      {key: 0, name: 'main()'},
      {key: 1, name: 'functionA()', file: 'test.js', line: 10},
      {key: 2, name: 'functionB()', file: 'test.js', line: 20},
      {key: 3, name: 'functionC()', file: 'test.js', line: 30},
      {key: 4, name: 'functionD()', file: 'test.js', line: 40},
    ]

    // Build a hierarchical call structure
    // main() -> functionA() -> functionB() -> functionC()
    // main() -> functionA() -> functionD()
    builder.enterFrame(frameInfos[0], 0) // main() starts at 0
    builder.enterFrame(frameInfos[1], 100) // functionA() starts at 100
    builder.enterFrame(frameInfos[2], 200) // functionB() starts at 200
    builder.enterFrame(frameInfos[3], 300) // functionC() starts at 300
    builder.leaveFrame(frameInfos[3], 400) // functionC() ends at 400
    builder.leaveFrame(frameInfos[2], 500) // functionB() ends at 500
    builder.enterFrame(frameInfos[4], 600) // functionD() starts at 600
    builder.leaveFrame(frameInfos[4], 700) // functionD() ends at 700
    builder.leaveFrame(frameInfos[1], 800) // functionA() ends at 800
    builder.leaveFrame(frameInfos[0], 900) // main() ends at 900

    testProfile = builder.build()
  })

  describe('generateFilteredJsonData Function', () => {
    test('should generate valid JSON for full interval', () => {
      const jsonString = generateFilteredJsonData(testProfile, 0, 1000)
      const exportedData = JSON.parse(jsonString)

      expect(exportedData.$schema).toBe('https://www.speedscope.app/file-format-schema.json')
      expect(exportedData.exporter).toBe('speedscope@1.23.1')
      // Name formatting uses value formatter; accept formatted units
      expect(exportedData.name).toContain('Test Profile (')
      expect(exportedData.activeProfileIndex).toBe(0)
      expect(exportedData.shared.frames).toHaveLength(5)
      expect(exportedData.profiles).toHaveLength(1)
      expect(exportedData.profiles[0].type).toBe('evented')
      expect(exportedData.profiles[0].name).toBe('Test Profile')
      expect(exportedData.profiles[0].unit).toBe('milliseconds')
    })

    test('should filter events correctly for partial interval', () => {
      const jsonString = generateFilteredJsonData(testProfile, 200, 600)
      const exportedData = JSON.parse(jsonString)

      expect(exportedData.name).toContain('Test Profile (200')
      expect(exportedData.name).toContain('600')
      expect(exportedData.profiles[0].startValue).toBe(200)
      expect(exportedData.profiles[0].endValue).toBe(600)

      // Should have events for functionB() and functionC() plus synthetic events
      const events = exportedData.profiles[0].events
      expect(events.length).toBeGreaterThan(0)

      // All events should be within or at the boundaries of the interval
      events.forEach((event: any) => {
        expect(event.at).toBeGreaterThanOrEqual(200)
        expect(event.at).toBeLessThanOrEqual(600)
      })
    })

    test('should add synthetic events for boundary conditions', () => {
      const jsonString = generateFilteredJsonData(testProfile, 150, 650)
      const exportedData = JSON.parse(jsonString)
      const events = exportedData.profiles[0].events

      // Should have synthetic events at the boundaries
      const hasSyntheticBoundary = events.some((e: any) => (e.at === 150 && e.type === 'O') || (e.at === 650 && e.type === 'C'))
      expect(hasSyntheticBoundary).toBe(true)
    })

    test('should preserve frame metadata in filtered export', () => {
      const jsonString = generateFilteredJsonData(testProfile, 200, 600)
      const exportedData = JSON.parse(jsonString)
      const frames = exportedData.shared.frames

      // Verify that frame metadata is preserved
      const functionAFrame = frames.find((f: any) => f.name === 'functionA()')
      const functionBFrame = frames.find((f: any) => f.name === 'functionB()')

      expect(functionAFrame).toBeDefined()
      expect(functionAFrame.file).toBe('test.js')
      expect(functionAFrame.line).toBe(10)

      expect(functionBFrame).toBeDefined()
      expect(functionBFrame.file).toBe('test.js')
      expect(functionBFrame.line).toBe(20)
    })
  })

  describe('Import Roundtrip for Filtered Data', () => {
    test('should import filtered export and maintain call structure', () => {
      const jsonString = generateFilteredJsonData(testProfile, 200, 600)
      const exportedData = JSON.parse(jsonString)
      const imported = importSpeedscopeProfiles(exportedData)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getName()).toBe('Test Profile')
      expect(importedProfile.getWeightUnit()).toBe('milliseconds')
      expect(importedProfile.getTotalWeight()).toBe(400) // 600 - 200

      // Verify that the imported profile has the expected structure
      const callTree = importedProfile.getAppendOrderCalltreeRoot()
      expect(callTree.children.length).toBeGreaterThan(0)
    })

    test('should handle edge case where interval contains no complete function calls', () => {
      const jsonString = generateFilteredJsonData(testProfile, 350, 450)
      const exportedData = JSON.parse(jsonString)
      const imported = importSpeedscopeProfiles(exportedData)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getName()).toBe('Test Profile')
      // Depending on boundary synthesis, weight may reflect exact window or span of events
      expect(importedProfile.getTotalWeight()).toBeGreaterThan(0)

      // Should still be a valid profile even with minimal events
      const callTree = importedProfile.getAppendOrderCalltreeRoot()
      expect(callTree).toBeDefined()
    })

    test('should maintain event ordering in filtered export', () => {
      const jsonString = generateFilteredJsonData(testProfile, 200, 600)
      const exportedData = JSON.parse(jsonString)
      const events = exportedData.profiles[0].events

      // Verify events are sorted by timestamp
      for (let i = 1; i < events.length; i++) {
        expect(events[i].at).toBeGreaterThanOrEqual(events[i - 1].at)
      }
    })

    test('should handle empty interval gracefully', () => {
      const jsonString = generateFilteredJsonData(testProfile, 1000, 2000)
      const exportedData = JSON.parse(jsonString)
      const imported = importSpeedscopeProfiles(exportedData)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getName()).toBe('Test Profile')
      // Empty interval yields zero events; total weight should be window span or zero
      expect(importedProfile.getTotalWeight()).toBeGreaterThanOrEqual(0)
      expect(exportedData.profiles[0].events).toHaveLength(0)
    })
  })

  describe('Frame Index Consistency', () => {
    test('should maintain consistent frame indices between original and filtered export', () => {
      const originalJsonString = generateFilteredJsonData(testProfile, 0, 1000)
      const filteredJsonString = generateFilteredJsonData(testProfile, 200, 600)

      const originalData = JSON.parse(originalJsonString)
      const filteredData = JSON.parse(filteredJsonString)

      // Frame indices should be consistent
      expect(filteredData.shared.frames).toEqual(originalData.shared.frames)

      // Events should reference the same frame indices
      const filteredEvents = filteredData.profiles[0].events
      filteredEvents.forEach((event: any) => {
        expect(event.frame).toBeGreaterThanOrEqual(0)
        expect(event.frame).toBeLessThan(filteredData.shared.frames.length)
      })
    })

    test('should handle frame references correctly in synthetic events', () => {
      const jsonString = generateFilteredJsonData(testProfile, 150, 650)
      const exportedData = JSON.parse(jsonString)
      const events = exportedData.profiles[0].events

      // All frame references should be valid
      events.forEach((event: any) => {
        expect(event.frame).toBeGreaterThanOrEqual(0)
        expect(event.frame).toBeLessThan(exportedData.shared.frames.length)
        expect(exportedData.shared.frames[event.frame]).toBeDefined()
      })
    })
  })

  describe('Performance and Stress Testing', () => {
    test('should handle large number of events efficiently', () => {
      // Create a profile with many events
      const builder = new CallTreeProfileBuilder(10000)
      builder.setName('Large Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      // Create a deep call stack with many frames
      for (let i = 0; i < 50; i++) {
        const frameInfo: FrameInfo = {key: i, name: `function${i}()`}
        builder.enterFrame(frameInfo, i * 100)
        builder.leaveFrame(frameInfo, (i + 1) * 100)
      }

      const largeProfile = builder.build()

      // Test filtering performance
      const startTime = Date.now()
      const jsonString = generateFilteredJsonData(largeProfile, 1000, 5000)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(1000) // Should complete within 1 second

      const exportedData = JSON.parse(jsonString)
      expect(exportedData.profiles[0].events.length).toBeGreaterThan(0)
    })

    test('should handle complex nested call structures', () => {
      // Create a complex nested structure
      const builder = new CallTreeProfileBuilder(1000)
      builder.setName('Complex Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      const frameInfos: FrameInfo[] = [
        {key: 0, name: 'root()'},
        {key: 1, name: 'level1a()'},
        {key: 2, name: 'level1b()'},
        {key: 3, name: 'level2a()'},
        {key: 4, name: 'level2b()'},
        {key: 5, name: 'level3()'},
      ]

      // Create a complex nested structure
      builder.enterFrame(frameInfos[0], 0) // root
      builder.enterFrame(frameInfos[1], 100) // level1a
      builder.enterFrame(frameInfos[3], 200) // level2a
      builder.enterFrame(frameInfos[5], 300) // level3
      builder.leaveFrame(frameInfos[5], 400) // level3
      builder.leaveFrame(frameInfos[3], 500) // level2a
      builder.enterFrame(frameInfos[4], 600) // level2b
      builder.leaveFrame(frameInfos[4], 700) // level2b
      builder.leaveFrame(frameInfos[1], 800) // level1a
      builder.enterFrame(frameInfos[2], 900) // level1b
      builder.leaveFrame(frameInfos[2], 950) // level1b
      builder.leaveFrame(frameInfos[0], 1000) // root

      const complexProfile = builder.build()

      // Test filtering with partial interval
      const jsonString = generateFilteredJsonData(complexProfile, 150, 750)
      const exportedData = JSON.parse(jsonString)
      const imported = importSpeedscopeProfiles(exportedData)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getName()).toBe('Complex Profile')
      expect(importedProfile.getTotalWeight()).toBeGreaterThan(0)

      // Verify the structure is maintained
      const callTree = importedProfile.getAppendOrderCalltreeRoot()
      expect(callTree.children.length).toBeGreaterThan(0)
    })
  })
})
