import {CallTreeProfileBuilder, FrameInfo} from '../../lib/profile'
import {importSpeedscopeProfiles, exportProfileGroup} from '../../lib/file-format'
import {TimeFormatter} from '../../lib/value-formatters'
import {FileFormat} from '../../lib/file-format-spec'

describe('Export-Import Roundtrip Validation', () => {
  describe('Real-world Profile Simulation', () => {
    test('should maintain exact fidelity for complex hierarchical profiles', () => {
      // Simulate a complex profile similar to what's shown in the image
      // with multiple nested function calls and various frame types
      const builder = new CallTreeProfileBuilder(66666) // Similar to the timeline in the image
      builder.setName('Complex Application Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      // Create frames that simulate real application calls
      const frameInfos: FrameInfo[] = [
        {key: 0, name: 'main()'},
        {key: 1, name: '[NSApplication _handleEvent:]', file: 'AppKit', line: 1234},
        {key: 2, name: '-[IDEApplication sendEvent:]', file: 'IDEApplication.m', line: 567},
        {
          key: 3,
          name: '-[NSWindow (NSEventRouting) _handleMouseDownEvent:isDelayedEvent:]',
          file: 'NSWindow.m',
          line: 890,
        },
        {
          key: 4,
          name: '@objc DVTExplorerOutlineView.keyDown(with:)',
          file: 'DVTExplorerOutlineView.swift',
          line: 123,
        },
        {
          key: 5,
          name: 'ExplorableOutlineViewCoordinator.handleClickedItem (event:)',
          file: 'ExplorableOutlineViewCoordinator.swift',
          line: 456,
        },
        {
          key: 6,
          name: 'protocol witness for OutlineViewCoordinatorDelegate.outlineViewCoordinator',
          file: 'OutlineViewCoordinator.swift',
          line: 789,
        },
        {
          key: 7,
          name: '+[IDEEditorCoordinator_openEditorOpenSpecifier:forWorkspaceTabController:eventType:completionBlock:]',
          file: 'IDEEditorCoordinator.m',
          line: 234,
        },
        {key: 8, name: '-[_IDEOpenRequest_runIfNecessary]', file: '_IDEOpenRequest.m', line: 567},
        {
          key: 9,
          name: '+[IDEEditorArea_openEditorOpenSpecifier:editorContext:options:]',
          file: 'IDEEditorArea.m',
          line: 890,
        },
      ]

      // Build a complex call stack similar to the image
      builder.enterFrame(frameInfos[0], 100000) // main() starts
      builder.enterFrame(frameInfos[1], 103000) // NSApplication _handleEvent
      builder.enterFrame(frameInfos[2], 106000) // IDEApplication sendEvent
      builder.enterFrame(frameInfos[3], 110000) // NSWindow _handleMouseDownEvent
      builder.enterFrame(frameInfos[4], 113000) // DVTExplorerOutlineView.keyDown
      builder.enterFrame(frameInfos[5], 116000) // ExplorableOutlineViewCoordinator.handleClickedItem
      builder.enterFrame(frameInfos[6], 120000) // protocol witness
      builder.enterFrame(frameInfos[7], 123000) // IDEEditorCoordinator_openEditorOpenSpecifier
      builder.enterFrame(frameInfos[8], 126000) // _IDEOpenRequest_runIfNecessary
      builder.enterFrame(frameInfos[9], 130000) // IDEEditorArea_openEditorOpenSpecifier
      builder.leaveFrame(frameInfos[9], 133000) // IDEEditorArea_openEditorOpenSpecifier ends
      builder.leaveFrame(frameInfos[8], 136000) // _IDEOpenRequest_runIfNecessary ends
      builder.leaveFrame(frameInfos[7], 140000) // IDEEditorCoordinator_openEditorOpenSpecifier ends
      builder.leaveFrame(frameInfos[6], 143000) // protocol witness ends
      builder.leaveFrame(frameInfos[5], 146000) // ExplorableOutlineViewCoordinator.handleClickedItem ends
      builder.leaveFrame(frameInfos[4], 150000) // DVTExplorerOutlineView.keyDown ends
      builder.leaveFrame(frameInfos[3], 153000) // NSWindow _handleMouseDownEvent ends
      builder.leaveFrame(frameInfos[2], 156000) // IDEApplication sendEvent ends
      builder.leaveFrame(frameInfos[1], 160000) // NSApplication _handleEvent ends
      builder.leaveFrame(frameInfos[0], 166666) // main() ends

      const complexProfile = builder.build()
      const profileGroup = {
        name: 'Complex Application Profile Group',
        indexToView: 0,
        profiles: [complexProfile],
      }

      // Export the profile
      const exported = exportProfileGroup(profileGroup)
      const exportedJson = JSON.stringify(exported, null, 2)

      // Import the exported data
      const imported = importSpeedscopeProfiles(exported)

      // Validate exact fidelity
      expect(imported.name).toBe(profileGroup.name)
      expect(imported.indexToView).toBe(profileGroup.indexToView)
      expect(imported.profiles).toHaveLength(1)

      const originalProfile = profileGroup.profiles[0]
      const importedProfile = imported.profiles[0]

      // Validate profile properties
      expect(importedProfile.getName()).toBe(originalProfile.getName())
      expect(importedProfile.getWeightUnit()).toBe(originalProfile.getWeightUnit())
      expect(importedProfile.getTotalWeight()).toBe(originalProfile.getTotalWeight())

      // Validate call tree structure
      const originalCallTree = originalProfile.getAppendOrderCalltreeRoot()
      const importedCallTree = importedProfile.getAppendOrderCalltreeRoot()

      expect(importedCallTree.children).toHaveLength(originalCallTree.children.length)

      // Validate the deep call stack structure
      let originalDepth = 0
      let importedDepth = 0

      const getMaxDepth = (node: any, currentDepth: number): number => {
        if (node.children.length === 0) return currentDepth
        return Math.max(...node.children.map((child: any) => getMaxDepth(child, currentDepth + 1)))
      }

      originalDepth = getMaxDepth(originalCallTree, 0)
      importedDepth = getMaxDepth(importedCallTree, 0)

      expect(importedDepth).toBe(originalDepth)

      // Validate that re-export produces identical JSON
      const reExported = exportProfileGroup(imported)
      const reExportedJson = JSON.stringify(reExported, null, 2)

      expect(reExportedJson).toBe(exportedJson)
    })

    test('should preserve frame metadata through export/import cycle', () => {
      const builder = new CallTreeProfileBuilder(1000)
      builder.setName('Metadata Test Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      // Create frames with various metadata
      const frameInfos: FrameInfo[] = [
        {key: 0, name: 'main()'},
        {key: 1, name: 'functionWithFile()', file: 'test.js', line: 10},
        {key: 2, name: 'functionWithFileAndCol()', file: 'test.js', line: 20, col: 5},
        {key: 3, name: 'functionWithoutMetadata()'},
      ]

      builder.enterFrame(frameInfos[0], 0)
      builder.enterFrame(frameInfos[1], 100)
      builder.enterFrame(frameInfos[2], 200)
      builder.leaveFrame(frameInfos[2], 300)
      builder.leaveFrame(frameInfos[1], 400)
      builder.enterFrame(frameInfos[3], 500)
      builder.leaveFrame(frameInfos[3], 600)
      builder.leaveFrame(frameInfos[0], 700)

      const profile = builder.build()
      const profileGroup = {
        name: 'Metadata Test Group',
        indexToView: 0,
        profiles: [profile],
      }

      const exported = exportProfileGroup(profileGroup)
      const imported = importSpeedscopeProfiles(exported)
      const importedProfile = imported.profiles[0]

      // Validate that frame metadata is preserved
      const frames = new Map<string, any>()
      importedProfile.forEachCall(
        node => {
          frames.set(node.frame.name, {
            name: node.frame.name,
            file: node.frame.file,
            line: node.frame.line,
            col: node.frame.col,
          })
        },
        () => {},
      )

      expect(frames.get('main()')).toEqual({
        name: 'main()',
        file: undefined,
        line: undefined,
        col: undefined,
      })
      expect(frames.get('functionWithFile()')).toEqual({
        name: 'functionWithFile()',
        file: 'test.js',
        line: 10,
        col: undefined,
      })
      expect(frames.get('functionWithFileAndCol()')).toEqual({
        name: 'functionWithFileAndCol()',
        file: 'test.js',
        line: 20,
        col: 5,
      })
      expect(frames.get('functionWithoutMetadata()')).toEqual({
        name: 'functionWithoutMetadata()',
        file: undefined,
        line: undefined,
        col: undefined,
      })
    })

    test('should handle filtered export with complex nested structures', () => {
      // Create a profile with complex nested calls
      const builder = new CallTreeProfileBuilder(10000)
      builder.setName('Nested Calls Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      const frameInfos: FrameInfo[] = [
        {key: 0, name: 'root()'},
        {key: 1, name: 'level1()'},
        {key: 2, name: 'level2a()'},
        {key: 3, name: 'level2b()'},
        {key: 4, name: 'level3()'},
        {key: 5, name: 'level4()'},
      ]

      // Create a complex nested structure
      builder.enterFrame(frameInfos[0], 0) // root
      builder.enterFrame(frameInfos[1], 1000) // level1
      builder.enterFrame(frameInfos[2], 2000) // level2a
      builder.enterFrame(frameInfos[4], 3000) // level3
      builder.enterFrame(frameInfos[5], 4000) // level4
      builder.leaveFrame(frameInfos[5], 5000) // level4
      builder.leaveFrame(frameInfos[4], 6000) // level3
      builder.leaveFrame(frameInfos[2], 7000) // level2a
      builder.enterFrame(frameInfos[3], 8000) // level2b
      builder.leaveFrame(frameInfos[3], 9000) // level2b
      builder.leaveFrame(frameInfos[1], 9500) // level1
      builder.leaveFrame(frameInfos[0], 10000) // root

      const profile = builder.build()

      // Simulate filtering for a specific interval (3000-6000)
      const exported = exportProfileGroup({name: 'Test', indexToView: 0, profiles: [profile]})
      const allEvents = (exported.profiles[0] as any).events
      const filteredEvents = allEvents.filter((event: any) => event.at >= 3000 && event.at <= 6000)

      // Create filtered export
      const filteredExport = {
        exporter: `speedscope@1.23.1`,
        name: `Nested Calls Profile (3000 - 6000)`,
        activeProfileIndex: 0,
        $schema: 'https://www.speedscope.app/file-format-schema.json' as const,
        shared: {frames: exported.shared.frames},
        profiles: [
          {
            type: FileFormat.ProfileType.EVENTED,
            name: 'Nested Calls Profile',
            unit: 'milliseconds' as const,
            startValue: 3000,
            endValue: 6000,
            events: filteredEvents,
          },
        ],
      }

      // Import the filtered export
      const imported = importSpeedscopeProfiles(filteredExport as any)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getName()).toBe('Nested Calls Profile')
      expect(importedProfile.getTotalWeight()).toBe(3000) // 6000 - 3000

      // Validate that the filtered profile maintains the nested structure
      const callTree = importedProfile.getAppendOrderCalltreeRoot()
      expect(callTree.children.length).toBeGreaterThan(0)

      // The filtered profile should contain level3 and level4 calls
      const hasLevel3 = callTree.children.some(
        (child: any) =>
          child.frame.name === 'level3()' ||
          child.children.some((grandchild: any) => grandchild.frame.name === 'level3()'),
      )
      expect(hasLevel3).toBe(true)
    })
  })

  describe('Edge Cases and Boundary Conditions', () => {
    test('should handle single event profiles', () => {
      const builder = new CallTreeProfileBuilder(100)
      builder.setName('Single Event Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      const frameInfo: FrameInfo = {key: 0, name: 'singleFunction()'}
      builder.enterFrame(frameInfo, 0)
      builder.leaveFrame(frameInfo, 100)

      const profile = builder.build()
      const profileGroup = {
        name: 'Single Event Group',
        indexToView: 0,
        profiles: [profile],
      }

      const exported = exportProfileGroup(profileGroup)
      const imported = importSpeedscopeProfiles(exported)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getName()).toBe('Single Event Profile')
      expect(importedProfile.getTotalWeight()).toBe(100)
      expect(importedProfile.getAppendOrderCalltreeRoot().children).toHaveLength(1)
      expect(importedProfile.getAppendOrderCalltreeRoot().children[0].frame.name).toBe(
        'singleFunction()',
      )
    })

    test('should handle profiles with overlapping function calls', () => {
      const builder = new CallTreeProfileBuilder(1000)
      builder.setName('Overlapping Calls Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      const frameInfos: FrameInfo[] = [
        {key: 0, name: 'main()'},
        {key: 1, name: 'functionA()'},
        {key: 2, name: 'functionB()'},
      ]

      // Create overlapping calls
      builder.enterFrame(frameInfos[0], 0) // main starts
      builder.enterFrame(frameInfos[1], 100) // functionA starts
      builder.leaveFrame(frameInfos[1], 250) // functionA ends before B starts
      builder.enterFrame(frameInfos[2], 260) // functionB starts (no overlap now)
      builder.leaveFrame(frameInfos[2], 400) // functionB ends
      builder.leaveFrame(frameInfos[0], 500) // main ends

      const profile = builder.build()
      const profileGroup = {
        name: 'Overlapping Group',
        indexToView: 0,
        profiles: [profile],
      }

      const exported = exportProfileGroup(profileGroup)
      const imported = importSpeedscopeProfiles(exported)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getName()).toBe('Overlapping Calls Profile')
      expect(importedProfile.getTotalWeight()).toBe(1000)

      // Validate the overlapping structure is preserved
      const callTree = importedProfile.getAppendOrderCalltreeRoot()
      expect(callTree.children).toHaveLength(1) // main
      expect(callTree.children[0].children).toHaveLength(2) // functionA and functionB
    })

    test('should handle profiles with very long function names', () => {
      const builder = new CallTreeProfileBuilder(100)
      builder.setName('Long Names Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      const longName =
        'veryLongFunctionNameThatExceedsNormalLengthAndTestsTheSystemAbilityToHandleLongFunctionNamesInProfiles'
      const frameInfo: FrameInfo = {key: 0, name: longName}

      builder.enterFrame(frameInfo, 0)
      builder.leaveFrame(frameInfo, 100)

      const profile = builder.build()
      const profileGroup = {
        name: 'Long Names Group',
        indexToView: 0,
        profiles: [profile],
      }

      const exported = exportProfileGroup(profileGroup)
      const imported = importSpeedscopeProfiles(exported)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getName()).toBe('Long Names Profile')
      expect(importedProfile.getAppendOrderCalltreeRoot().children[0].frame.name).toBe(longName)
    })

    test('should handle profiles with special characters in names', () => {
      const builder = new CallTreeProfileBuilder(100)
      builder.setName('Special Chars Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      const frameInfos: FrameInfo[] = [
        {key: 0, name: 'function-with-dashes()'},
        {key: 1, name: 'function_with_underscores()'},
        {key: 2, name: 'function.with.dots()'},
        {key: 3, name: 'function[with][brackets]()'},
        {key: 4, name: 'function<with><angles>()'},
      ]

      builder.enterFrame(frameInfos[0], 0)
      builder.enterFrame(frameInfos[1], 20)
      builder.enterFrame(frameInfos[2], 40)
      builder.enterFrame(frameInfos[3], 60)
      builder.enterFrame(frameInfos[4], 80)
      builder.leaveFrame(frameInfos[4], 100)
      builder.leaveFrame(frameInfos[3], 100)
      builder.leaveFrame(frameInfos[2], 100)
      builder.leaveFrame(frameInfos[1], 100)
      builder.leaveFrame(frameInfos[0], 100)

      const profile = builder.build()
      const profileGroup = {
        name: 'Special Chars Group',
        indexToView: 0,
        profiles: [profile],
      }

      const exported = exportProfileGroup(profileGroup)
      const imported = importSpeedscopeProfiles(exported)
      const importedProfile = imported.profiles[0]

      expect(importedProfile.getName()).toBe('Special Chars Profile')

      // Validate all special character names are preserved
      const frameNames = new Set<string>()
      importedProfile.forEachCall(
        node => frameNames.add(node.frame.name),
        () => {},
      )

      expect(frameNames.has('function-with-dashes()')).toBe(true)
      expect(frameNames.has('function_with_underscores()')).toBe(true)
      expect(frameNames.has('function.with.dots()')).toBe(true)
      expect(frameNames.has('function[with][brackets]()')).toBe(true)
      expect(frameNames.has('function<with><angles>()')).toBe(true)
    })
  })

  describe('Performance and Scalability', () => {
    test('should handle large profiles efficiently', () => {
      const builder = new CallTreeProfileBuilder(100000)
      builder.setName('Large Profile')
      builder.setValueFormatter(new TimeFormatter('milliseconds'))

      // Create a large number of frames
      const frameInfos: FrameInfo[] = []
      for (let i = 0; i < 1000; i++) {
        frameInfos.push({key: i, name: `function${i}()`})
      }

      // Create a deep call stack
      for (let i = 0; i < 1000; i++) {
        builder.enterFrame(frameInfos[i], i * 10)
        builder.leaveFrame(frameInfos[i], (i + 1) * 10)
      }

      const largeProfile = builder.build()
      const profileGroup = {
        name: 'Large Profile Group',
        indexToView: 0,
        profiles: [largeProfile],
      }

      // Test export performance
      const exportStart = Date.now()
      const exported = exportProfileGroup(profileGroup)
      const exportEnd = Date.now()

      // Test import performance
      const importStart = Date.now()
      const imported = importSpeedscopeProfiles(exported)
      const importEnd = Date.now()

      // Validate results
      expect(imported.profiles[0].getName()).toBe('Large Profile')
      expect(imported.profiles[0].getTotalWeight()).toBe(100000)
      expect(imported.profiles[0].getAppendOrderCalltreeRoot().children).toHaveLength(1000)

      // Performance should be reasonable (less than 5 seconds for both operations)
      expect(exportEnd - exportStart).toBeLessThan(5000)
      expect(importEnd - importStart).toBeLessThan(5000)
    })
  })
})
