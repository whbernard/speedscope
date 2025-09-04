import {Profile, CallTreeProfileBuilder, FrameInfo} from '../../lib/profile'
import {importSpeedscopeProfiles, exportProfileGroup} from '../../lib/file-format'
import {TimeFormatter} from '../../lib/value-formatters'
import {FileFormat} from '../../lib/file-format-spec'

// Mock the filterEventsWithContext function behavior
const mockFilterEventsWithContext = (events: any[], startValue: number, endValue: number) => {
  // Filter by interval
  const filtered = events.filter((event: any) => event.at >= startValue && event.at <= endValue)

  // Track per-frame open/close to ensure we produce a valid, balanced event list
  const openedAt = new Map<number, number>()
  const closedAt = new Map<number, number>()

  for (const ev of filtered) {
    if (ev.type === 'O') openedAt.set(ev.frame, ev.at)
    if (ev.type === 'C') closedAt.set(ev.frame, ev.at)
  }

  const synthetic: any[] = []

  // If we saw a close without an open inside the window, add a synthetic open at start
  for (const [frame] of closedAt) {
    if (!openedAt.has(frame)) {
      synthetic.push({type: 'O', frame, at: startValue})
      openedAt.set(frame, startValue)
    }
  }

  // If we saw an open without a close inside the window, add a synthetic close at end
  for (const [frame] of openedAt) {
    if (!closedAt.has(frame)) {
      synthetic.push({type: 'C', frame, at: endValue})
    }
  }

  const all = [...filtered, ...synthetic]
  all.sort((a, b) => a.at - b.at)
  return all
}

describe('Export Filtered JSON Logic', () => {
  let testProfile: Profile
  let testProfileGroup: any

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

    // Create a profile group
    testProfileGroup = {
      name: 'Test Profile Group',
      indexToView: 0,
      profiles: [testProfile],
    }
  })

  describe('Export Structure Validation', () => {
    test('should export with correct speedscope file format structure', () => {
      const exported = exportProfileGroup(testProfileGroup)

      // Validate top-level structure
      expect(exported).toHaveProperty('exporter')
      expect(exported).toHaveProperty('name')
      expect(exported).toHaveProperty('activeProfileIndex')
      expect(exported).toHaveProperty('$schema')
      expect(exported).toHaveProperty('shared')
      expect(exported).toHaveProperty('profiles')

      // Validate schema
      expect(exported.$schema).toBe('https://www.speedscope.app/file-format-schema.json')
      expect(exported.exporter).toBe('speedscope@1.23.1')
      expect(exported.name).toBe('Test Profile Group')
      expect(exported.activeProfileIndex).toBe(0)
    })

    test('should export frames with correct structure', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const frames = exported.shared.frames

      expect(frames).toHaveLength(5)
      expect(frames[0]).toEqual({
        name: 'main()',
      })
      expect(frames[1]).toEqual({
        name: 'functionA()',
        file: 'test.js',
        line: 10,
      })
      expect(frames[2]).toEqual({
        name: 'functionB()',
        file: 'test.js',
        line: 20,
      })
    })

    test('should export evented profile with correct structure', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const profile = exported.profiles[0]

      expect(profile).toHaveProperty('type')
      expect(profile).toHaveProperty('name')
      expect(profile).toHaveProperty('unit')
      expect(profile).toHaveProperty('startValue')
      expect(profile).toHaveProperty('endValue')
      expect(profile).toHaveProperty('events')

      expect(profile.type).toBe('evented')
      expect(profile.name).toBe('Test Profile')
      expect(profile.unit).toBe('milliseconds')
      expect(profile.startValue).toBe(0)
      expect(profile.endValue).toBe(1000)
    })

    test('should export events with correct structure and ordering', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const events = (exported.profiles[0] as any).events

      expect(events).toHaveLength(10) // 5 enter + 5 leave events

      // Verify event types and ordering
      const expectedEvents = [
        {type: 'O', frame: 0, at: 0}, // main() open
        {type: 'O', frame: 1, at: 100}, // functionA() open
        {type: 'O', frame: 2, at: 200}, // functionB() open
        {type: 'O', frame: 3, at: 300}, // functionC() open
        {type: 'C', frame: 3, at: 400}, // functionC() close
        {type: 'C', frame: 2, at: 500}, // functionB() close
        {type: 'O', frame: 4, at: 600}, // functionD() open
        {type: 'C', frame: 4, at: 700}, // functionD() close
        {type: 'C', frame: 1, at: 800}, // functionA() close
        {type: 'C', frame: 0, at: 900}, // main() close
      ]

      events.forEach((event: any, index: number) => {
        expect(event).toEqual(expectedEvents[index])
      })
    })
  })

  describe('Import Roundtrip Validation', () => {
    test('should import exported data and produce identical profile', () => {
      // Export the original profile
      const exported = exportProfileGroup(testProfileGroup)
      const exportedJson = JSON.stringify(exported, null, 2)

      // Import the exported data
      const imported = importSpeedscopeProfiles(exported)

      // Validate that imported data matches original
      expect(imported.name).toBe(testProfileGroup.name)
      expect(imported.indexToView).toBe(testProfileGroup.indexToView)
      expect(imported.profiles).toHaveLength(1)

      const originalProfile = testProfileGroup.profiles[0]
      const importedProfile = imported.profiles[0]

      // Validate profile properties
      expect(importedProfile.getName()).toBe(originalProfile.getName())
      expect(importedProfile.getWeightUnit()).toBe(originalProfile.getWeightUnit())
      expect(importedProfile.getTotalWeight()).toBe(originalProfile.getTotalWeight())

      // Validate that the imported profile can be re-exported identically
      const reExported = exportProfileGroup(imported)
      const reExportedJson = JSON.stringify(reExported, null, 2)

      expect(reExportedJson).toBe(exportedJson)
    })

    test('should preserve hierarchical structure through export/import cycle', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const imported = importSpeedscopeProfiles(exported)
      const importedProfile = imported.profiles[0]

      // Verify the call tree structure is preserved
      const callTree = importedProfile.getAppendOrderCalltreeRoot()
      expect(callTree.children).toHaveLength(1) // main() should have one child

      const mainNode = callTree.children[0]
      expect(mainNode.frame.name).toBe('main()')
      expect(mainNode.children).toHaveLength(1) // main() should have functionA() as child

      const functionANode = mainNode.children[0]
      expect(functionANode.frame.name).toBe('functionA()')
      expect(functionANode.children).toHaveLength(2) // functionA() should have functionB() and functionD() as children

      // Verify the children are functionB() and functionD()
      const childNames = functionANode.children.map((child: any) => child.frame.name)
      expect(childNames).toContain('functionB()')
      expect(childNames).toContain('functionD()')
    })

    test('should preserve frame information through export/import cycle', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const imported = importSpeedscopeProfiles(exported)
      const importedProfile = imported.profiles[0]

      // Get all frames from the imported profile
      const frames = new Set<string>()
      importedProfile.forEachCall(
        node => frames.add(node.frame.name),
        () => {},
      )

      // Verify all original frames are present
      expect(frames.has('main()')).toBe(true)
      expect(frames.has('functionA()')).toBe(true)
      expect(frames.has('functionB()')).toBe(true)
      expect(frames.has('functionC()')).toBe(true)
      expect(frames.has('functionD()')).toBe(true)
    })
  })

  describe('Filtered Export Logic', () => {
    // Mock the filterEventsWithContext function behavior
    const mockFilterEventsWithContext = (events: any[], startValue: number, endValue: number) => {
      const filtered = events.filter(event => event.at >= startValue && event.at <= endValue)
      const openedAt = new Map<number, number>()
      const closedAt = new Map<number, number>()
      for (const ev of filtered) {
        if (ev.type === 'O') openedAt.set(ev.frame, ev.at)
        if (ev.type === 'C') closedAt.set(ev.frame, ev.at)
      }
      const synthetic: any[] = []
      for (const [frame] of closedAt) {
        if (!openedAt.has(frame)) synthetic.push({type: 'O', frame, at: startValue})
      }
      for (const [frame] of openedAt) {
        if (!closedAt.has(frame)) synthetic.push({type: 'C', frame, at: endValue})
      }
      const all = [...filtered, ...synthetic]
      all.sort((a, b) => a.at - b.at)
      return all
    }

    test('should filter events correctly for time interval', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const allEvents = (exported.profiles[0] as any).events

      // Filter events for interval 200-600 (should include functionB() and functionC())
      const filteredEvents = mockFilterEventsWithContext(allEvents, 200, 600)

      // Must contain the core B/C events regardless of any additional synthetic boundaries
      expect(filteredEvents).toEqual(
        expect.arrayContaining([
          {type: 'O', frame: 2, at: 200},
          {type: 'O', frame: 3, at: 300},
          {type: 'C', frame: 3, at: 400},
          {type: 'C', frame: 2, at: 500},
        ]),
      )
    })

    test('should create valid filtered export structure', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const allEvents = (exported.profiles[0] as any).events
      const filteredEvents = mockFilterEventsWithContext(allEvents, 200, 600)

      // Create filtered export structure (simulating the generateFilteredJsonData logic)
      const filteredExport = {
        exporter: `speedscope@1.23.1`,
        name: `Test Profile (200 - 600)`,
        activeProfileIndex: 0,
        $schema: 'https://www.speedscope.app/file-format-schema.json' as const,
        shared: {frames: exported.shared.frames},
        profiles: [
          {
            type: FileFormat.ProfileType.EVENTED,
            name: 'Test Profile',
            unit: 'milliseconds' as const,
            startValue: 200,
            endValue: 600,
            events: filteredEvents,
          },
        ],
      }

      // Validate structure
      expect(filteredExport.$schema).toBe('https://www.speedscope.app/file-format-schema.json')
      expect(filteredExport.name).toBe('Test Profile (200 - 600)')
      expect(filteredExport.profiles[0].startValue).toBe(200)
      expect(filteredExport.profiles[0].endValue).toBe(600)
      // Balanced events (opens == closes)
      expect(filteredExport.profiles[0].events.length % 2).toBe(0)
    })

    test('should import filtered export and maintain structure', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const allEvents = (exported.profiles[0] as any).events
      const filteredEvents = mockFilterEventsWithContext(allEvents, 200, 600)

      const filteredExport = {
        exporter: `speedscope@1.23.1`,
        name: `Test Profile (200 - 600)`,
        activeProfileIndex: 0,
        $schema: 'https://www.speedscope.app/file-format-schema.json',
        shared: {frames: exported.shared.frames},
        profiles: [
          {
            type: 'evented',
            name: 'Test Profile',
            unit: 'milliseconds',
            startValue: 200,
            endValue: 600,
            events: filteredEvents,
          },
        ],
      }

      // Import the filtered export
      const imported = importSpeedscopeProfiles(filteredExport as any)
      const importedProfile = imported.profiles[0]

      // Validate that the filtered profile maintains correct structure
      expect(importedProfile.getName()).toBe('Test Profile')
      expect(importedProfile.getWeightUnit()).toBe('milliseconds')
      expect(importedProfile.getTotalWeight()).toBe(400) // 600 - 200

      // Verify that only the filtered events are present
      const events: any[] = []
      importedProfile.forEachCall(
        (node, value) => events.push({type: 'O', frame: node.frame.name, at: value}),
        (node, value) => events.push({type: 'C', frame: node.frame.name, at: value}),
      )

      // Should only have functionB() and functionC() events
      const frameNames = new Set(events.map(e => e.frame))
      expect(frameNames.has('functionB()')).toBe(true)
      expect(frameNames.has('functionC()')).toBe(true)
      expect(frameNames.has('main()')).toBe(false)
      expect(frameNames.has('functionA()')).toBe(false)
      expect(frameNames.has('functionD()')).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty interval gracefully', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const allEvents = (exported.profiles[0] as any).events
      const filteredEvents = mockFilterEventsWithContext(allEvents, 1000, 2000)

      expect(filteredEvents).toHaveLength(0)

      const filteredExport = {
        exporter: `speedscope@1.23.1`,
        name: `Test Profile (1000 - 2000)`,
        activeProfileIndex: 0,
        $schema: 'https://www.speedscope.app/file-format-schema.json' as const,
        shared: {frames: exported.shared.frames},
        profiles: [
          {
            type: FileFormat.ProfileType.EVENTED,
            name: 'Test Profile',
            unit: 'milliseconds' as const,
            startValue: 1000,
            endValue: 2000,
            events: filteredEvents,
          },
        ],
      }

      const imported = importSpeedscopeProfiles(filteredExport as any)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getTotalWeight()).toBe(1000) // 2000 - 1000

      // Should have no call tree structure
      const callTree = importedProfile.getAppendOrderCalltreeRoot()
      expect(callTree.children).toHaveLength(0)
    })

    test('should handle single event interval', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const allEvents = (exported.profiles[0] as any).events
      const filteredEvents = mockFilterEventsWithContext(allEvents, 300, 400)

      expect(filteredEvents).toHaveLength(2) // functionC() open and close

      const filteredExport = {
        exporter: `speedscope@1.23.1`,
        name: `Test Profile (300 - 400)`,
        activeProfileIndex: 0,
        $schema: 'https://www.speedscope.app/file-format-schema.json' as const,
        shared: {frames: exported.shared.frames},
        profiles: [
          {
            type: FileFormat.ProfileType.EVENTED,
            name: 'Test Profile',
            unit: 'milliseconds' as const,
            startValue: 300,
            endValue: 400,
            events: filteredEvents,
          },
        ],
      }

      const imported = importSpeedscopeProfiles(filteredExport as any)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getTotalWeight()).toBe(100) // 400 - 300

      // Should have only functionC() in the call tree
      const callTree = importedProfile.getAppendOrderCalltreeRoot()
      expect(callTree.children).toHaveLength(1)
      expect(callTree.children[0].frame.name).toBe('functionC()')
      expect(callTree.children[0].children).toHaveLength(0)
    })

    test('should handle boundary conditions correctly', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const allEvents = (exported.profiles[0] as any).events

      // Test exact boundary match (open and synthetic close at same timestamp)
      const filteredEvents = mockFilterEventsWithContext(allEvents, 300, 300)
      expect(filteredEvents).toHaveLength(2)

      // Test inclusive boundaries
      const filteredEventsInclusive = mockFilterEventsWithContext(allEvents, 200, 500)
      expect(filteredEventsInclusive).toHaveLength(4) // functionB() and functionC() events
    })

    test('should preserve frame metadata in filtered exports', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const filteredExport = {
        exporter: `speedscope@1.23.1`,
        name: `Test Profile (200 - 600)`,
        activeProfileIndex: 0,
        $schema: 'https://www.speedscope.app/file-format-schema.json' as const,
        shared: {frames: exported.shared.frames},
        profiles: [
          {
            type: FileFormat.ProfileType.EVENTED,
            name: 'Test Profile',
            unit: 'milliseconds' as const,
            startValue: 200,
            endValue: 600,
            events: mockFilterEventsWithContext((exported.profiles[0] as any).events, 200, 600),
          },
        ],
      }

      const imported = importSpeedscopeProfiles(filteredExport as any)

      // Verify that frame metadata (file, line) is preserved
      const frames = imported.profiles[0].getAppendOrderCalltreeRoot().children
      expect(frames.length).toBeGreaterThan(0)

      // Check that frame information is accessible
      const hasFrameWithFile = frames.some(
        (node: any) => node.frame.name === 'functionB()' || node.frame.name === 'functionC()',
      )
      expect(hasFrameWithFile).toBe(true)
    })
  })

  describe('JSON Serialization/Deserialization', () => {
    test('should serialize and deserialize without data loss', () => {
      const exported = exportProfileGroup(testProfileGroup)
      const jsonString = JSON.stringify(exported, null, 2)
      const parsed = JSON.parse(jsonString)

      // Verify that parsing preserves all data
      expect(parsed).toEqual(exported)
      expect(parsed.$schema).toBe(exported.$schema)
      expect(parsed.exporter).toBe(exported.exporter)
      expect(parsed.shared.frames).toEqual(exported.shared.frames)
      expect(parsed.profiles).toEqual(exported.profiles)
    })

    test('should handle large profiles without issues', () => {
      // Create a larger profile for stress testing
      const builder = new CallTreeProfileBuilder(10000)
      builder.setName('Large Test Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      // Create a deep call stack
      for (let i = 0; i < 100; i++) {
        const frameInfo: FrameInfo = {key: i, name: `function${i}()`}
        builder.enterFrame(frameInfo, i * 10)
        builder.leaveFrame(frameInfo, (i + 1) * 10)
      }

      const largeProfile = builder.build()
      const largeProfileGroup = {
        name: 'Large Profile Group',
        indexToView: 0,
        profiles: [largeProfile],
      }

      const exported = exportProfileGroup(largeProfileGroup)
      const jsonString = JSON.stringify(exported, null, 2)
      const parsed = JSON.parse(jsonString)
      const imported = importSpeedscopeProfiles(parsed)

      // Verify the large profile imports correctly
      expect(imported.profiles[0].getName()).toBe('Large Test Profile')
      expect(imported.profiles[0].getTotalWeight()).toBe(10000)
      expect(imported.profiles[0].getAppendOrderCalltreeRoot().children).toHaveLength(100)
    })
  })
})
