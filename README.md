# 🔬Speedscope with LLM 
A fast, interactive web-based viewer for performance profiles. Supports import from a variety of profiles in a variety of languages (JS, Ruby, Python, Go & more). Try it here: https://www.speedscope.app

Given raw profiling data, speedscope allows you to interactively explore the data to get insight into what's slow in your application, or allocating all the memory, or whatever data is represented in the profiling data.

![Example Profile](https://user-images.githubusercontent.com/150329/40900669-86eced80-6781-11e8-92c1-dc667b651e72.gif)

## Quick start: build and run (macOS, Windows, Linux)

This repository runs purely in the browser. No native code is required.

- macOS / Windows / Linux
  1. Install Node.js LTS (18+ recommended)
  2. Install dependencies: `npm install`
  3. Start dev server: `npm run dev`
  4. Open `http://localhost:8000` (or the printed URL)

- Build static site
  - `npm run build` → outputs static files to `build/`
  - Serve `build/` with any static HTTP server (e.g. `npx serve build`)

- CLI usage (optional)
  - `npm install -g speedscope`
  - `speedscope /path/to/profile` opens the browser viewer

### Supported browsers
- Latest Chrome and Firefox (see `browserslist` in `package.json`)

---

## LLM integration: request schema and configuration

The “Send to LLM” feature is configured in `src/config/api-config.ts`.

- Edit `DEFAULT_LLM_CONFIG` to change:
  - `url`: LLM endpoint URL
  - `defaultModel`: default model identifier
  - `contentType`: request content type
  - `requestSchema`: JSON payload template merged into the outbound request
  - `responseSchema`: structure used to extract the model’s response

- Add providers
  - Extend `LLM_PROVIDERS` with a new key whose value mirrors `DEFAULT_LLM_CONFIG`
  - Select the provider from the UI or via the code path that calls `getLLMConfig()`

Minimal example (pseudocode) of the JSON payload structure used when sending to the LLM:

```json
{
  "model": "your-model-id",
  "messages": [
    { "role": "user", "content": "<analysis prompt and serialized profile data>" }
  ]
}
```

The actual shape is defined in `requestSchema` and then combined with the current prompt and the serialized profile JSON at runtime.

---

## OAuth configuration: token request schema

OAuth support uses the client credentials grant flow. Configuration lives in `src/config/api-config.ts`.

- Edit `OAUTH_PROVIDERS.generic` to change:
  - `contentType`: usually `application/x-www-form-urlencoded`
  - `clientIdField` / `clientSecretField`: field names expected by your server
  - `grantType`: typically `client_credentials`
  - `responseSchema`: where to read `access_token` and `expires_in`

- Runtime configuration
  - From the UI, specify: OAuth URL, Client ID, Client Secret
  - Tokens are cached in-memory for the session (see `tokenCache`)

Example token request the app issues:

```
POST <oauth_url>
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=<id>&client_secret=<secret>
```

---

## How to send profiling data to the LLM

1. Load a profile via drag-and-drop or the Import/Browse button.
2. Zoom/pan the timeline to the interval you want analyzed.
3. Click “Send to LLM” in the toolbar.
4. Configure authentication:
   - OAuth (enter OAuth URL, Client ID, Client Secret)
5. Choose a prompt (or write your own) and submit.
6. The app serializes the selected interval to JSON and sends it to the LLM endpoint defined in `DEFAULT_LLM_CONFIG` (or your selected provider). The response text is shown in the UI.

Troubleshooting tips:
- Check the browser console Network tab if you get errors
- Verify OAuth endpoint and credentials (Client ID, Client Secret)
- Verify your LLM endpoint URL and request schema

[0]: https://en.wikipedia.org/wiki/Profiling_(computer_programming)#Statistical_profilers
[1]: https://github.com/brendangregg/FlameGraph

# Supported file formats

speedscope is designed to ingest profiles from a variety of different profilers for different programming languages & environments. Click the links below for documentation on how to import from a specific source.

- JavaScript
  - [Importing from Chrome](https://github.com/jlfwong/speedscope/wiki/Importing-from-Chrome)
  - [Importing from Firefox](https://github.com/jlfwong/speedscope/wiki/Importing-from-Firefox)
  - [Importing from Safari](https://github.com/jlfwong/speedscope/wiki/Importing-from-Safari)
  - [Importing from Node.js](https://github.com/jlfwong/speedscope/wiki/Importing-from-Node.js)
  - [Importing from Hermes (for React Native)](https://github.com/jlfwong/speedscope/wiki/Importing-from-Hermes)
- Ruby
  - [Importing from stackprof](https://github.com/jlfwong/speedscope/wiki/Importing-from-stackprof-(ruby))
  - [Importing from rbspy](https://github.com/jlfwong/speedscope/wiki/Importing-from-rbspy-(ruby))
  - [Importing from ruby-prof](https://github.com/jlfwong/speedscope/wiki/Importing-from-ruby-prof)
- Python
  - [Importing from py-spy](https://github.com/jlfwong/speedscope/wiki/Importing-from-py-spy-(python))
  - [pyspeedscope](https://github.com/windelbouwman/pyspeedscope)
  - [Importing from Austin](https://github.com/P403n1x87/austin-python#format-conversion)
  - [Importing from pyinstrument](https://github.com/jlfwong/speedscope/wiki/Importing-from-pyinstrument-(python))
- PHP
  - [Importing from phpspy or sj-i/php-profiler](https://github.com/sj-i/php-profiler/pull/101)
- Go
  - [Importing from pprof](https://github.com/jlfwong/speedscope/wiki/Importing-from-pprof-(go))  
- Rust
  - [flamescope](https://github.com/coolreader18/flamescope)
- Java
  - [Importing from async‐profiler (Java)
](https://github.com/jlfwong/speedscope/wiki/Importing-from-async%E2%80%90profiler-(Java))
- Erlang/Elixir
  - [eflambe](https://github.com/Stratus3D/eflambe)
- Native code
  - [Importing from Instruments.app](https://github.com/jlfwong/speedscope/wiki/Importing-from-Instruments.app) (macOS)
  - [Importing from `perf`](https://github.com/jlfwong/speedscope/wiki/Importing-from-perf-(linux)) (linux)
- [Importing from .NET Core](https://github.com/jlfwong/speedscope/wiki/Importing-from-.NET-Core)
- [Importing from GHC (Haskell)](https://github.com/jlfwong/speedscope/wiki/Importing-from-Haskell)
- [Importing from custom sources](https://github.com/jlfwong/speedscope/wiki/Importing-from-custom-sources)

Contributions to add support for additional formats are welcome! See issues with the ["import source" tag](https://github.com/jlfwong/speedscope/issues?q=is%3Aissue+is%3Aopen+label%3A%22import+source%22).
# Usage

Visit https://www.speedscope.app, then either browse to find a profile file or drag-and-drop one onto the page. The profiles are not uploaded anywhere -- the application is totally in-browser.

## Command line usage

For offline use, or convenience in the terminal, you can also install speedscope
via npm:

    npm install -g speedscope

Invoking `speedscope /path/to/profile` will load speedscope in your default browser.

## Self-contained directory

If you don't have npm or node installed, you can also download a
self-contained version from https://github.com/jlfwong/speedscope/releases.
After you download the zip file from a release, simply unzip it and open the
contained `index.html` in Chrome or Firefox.

## Importing via URL

To load a specific profile by URL, you can append a hash fragment like `#profileURL=[URL-encoded profile URL]&title=[URL-encoded custom title]`. Note that the server hosting the profile must have CORS configured to allow AJAX requests from speedscope.

## Views

### 🕰Time Order
![Detail View](https://user-images.githubusercontent.com/150329/42108613-e6ef6d3a-7b8f-11e8-93d4-541b2cb93fe5.png)

In the "Time Order" view (the default), call stacks are ordered left-to-right in the same order as they occurred in the input file, which is usually going to be the chronological order they were recorded in. This view is most helpful for understanding the behavior of an application over time, e.g. "first the data is fetched from the database, then the data is prepared for serialization, then the data is serialized to JSON". 

The horizontal axis represents the "weight" of each stack (most commonly CPU time), and the vertical axis shows you the stack active at the time of the sample. If you click on one of the frames, you'll be able to see summary statistics about it.


### ⬅️Left Heavy
![Left Heavy View](https://user-images.githubusercontent.com/150329/44534434-a05f8380-a6ac-11e8-86ac-e3e05e577c52.png)

In the "Left Heavy" view, identical stacks are grouped together, regardless of whether they were recorded sequentially. Then, the stacks are sorted so that the heaviest stack for each parent is on the left -- hence "left heavy". This view is useful for understanding where all the time is going in situations where there are hundreds or thousands of function calls interleaved between other call stacks.

### 🥪 Sandwich
![Sandwich View](https://user-images.githubusercontent.com/150329/42108467-76a57baa-7b8f-11e8-815f-1df7b6ac3ede.png)

The Sandwich view is a table view in which you can find a list of all functions and their associated times. You can sort by self time or total time.
It's called "Sandwich" view because if you select one of the rows in the table, you can see flamegraphs for all the callers and callees of the selected
row.


## Navigation

Once a profile has loaded, the main view is split into two: the top area is the "minimap", and the bottom area is the "stack view".

### Minimap Navigation

* Scroll on either axis to pan around
* Click and drag to narrow your view to a specific range

### Stack View Navigation

* Scroll on either axis to pan around
* Pinch to zoom
* Hold Cmd+Scroll to zoom
* Double click on a frame to fit the viewport to it
* Click on a frame to view summary statistics about it

### Keyboard Navigation

* `+`: zoom in
* `-`: zoom out
* `0`: zoom out to see the entire profile
* `w`/`a`/`s`/`d` or arrow keys: pan around the profile
* `1`: Switch to the "Time Order" view
* `2`: Switch to the "Left Heavy" view
* `3`: Switch to the "Sandwich" view
* `r`: Collapse recursion in the flamegraphs
* `Cmd+S`/`Ctrl+S` to save the current profile
* `Cmd+O`/`Ctrl+O` to open a new profile
* `n`: Go to next profile/thread if one is available
* `p`: Go to previous profile/thread if one is available
* `t`: Open the profile/thread selector if available
* `Cmd+F`/`Ctrl+F`: to open search. While open, `Enter` and `Shift+Enter` cycle through results

## Contributing

Do you want to contribute to speedscope? Sweeeeet. Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for instructions on setting up your dev environment.
