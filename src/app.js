import { AVR8js } from "./index.ts"

function disabled(bool) {
    document.getElementById("send").disabled = bool
    document.getElementById("stop").disabled = bool
    document.getElementById("stdin").disabled = bool
}

function send() {
    const input = document.getElementById("stdin")

    if (window.runner) {
        const value = input?.value || ""

        toTerminal(value + "\n")
        // end the line like the Arduino Serial Monitor does
        window.runner.serial(value + "\n")
    }

    input.value = ""
}

// edrys-Lite passes "" for a module without config
function config() {
    const config = Edrys.module?.config
    return typeof config === "object" && config || {}
}

// the message subject the simulator runs code from
function executeSubject() {
    return config().execute || "execute"
}

let state = "loading"

// kind is the badge colour: on, off or wait
function setStatus(name, kind) {
    state = name
    const badge = document.getElementById("status")
    badge.textContent = name
    badge.className = "badge " + kind
}

function stop() {
    // a stop during compiling drops the compile, so it ends that too
    const active = window.runner || state === "compiling"

    if (window.runner) {
        window.runner.stop()
        window.runner = null
        toTerminal("\nexecution stopped")

        disabled(true)
    }

    if (active) {
        setStatus("stopped", "wait")
    }
}

// Message that stops the simulation on every peer of the room (with synchronize)
const STOP_SUBJECT = "avr8js-stop"

// The stop button: with synchronize, Stop is shared like Run, and the
// stored sketch is removed so nobody restarts it on reload or join.
function stopClicked() {
    if (config().synchronize === true) {
        Edrys.clearState(sketchKey())
        // the body names the subject, in case several simulators share a room
        Edrys.sendMessage(STOP_SUBJECT, executeSubject())
    }

    uploads++ // drops a compile that is still running
    stop()
}

// Counts uploads, so a compile that a newer upload overtook is dropped
// instead of starting a second simulation next to the newer one.
let uploads = 0

async function compile(sketch) {
    const upload = ++uploads

    if (window.runner) {
        stop()
    }

    toTerminal("\nstart compiling ...")
    setStatus("compiling", "wait")

    let hex
    try {
        hex = await AVR8js.build(sketch)
    } catch (e) {
        if (upload === uploads) {
            toTerminal(`\ncompile server (hexi.wokwi.com) failed: ${e.message}`, false)
            setStatus("error", "off")
        }
        return
    }

    if (upload !== uploads) {
        return
    }

    if (hex.stderr) {
        toTerminal(hex.stderr, false, true)
        setStatus("error", "off")
        return
    }

    toTerminal(hex.stdout, true, true)

    if (hex.hex) {
        disabled(false)
        window.runner = AVR8js.execute(hex.hex, toTerminal)
        setStatus("running", "on")
    } else {
        window.runner = null
        setStatus("error", "off")
    }
}

// Output comes from other peers' sketches and the compiler, so it is
// only ever added as text, never parsed as HTML.
// Serial output arrives byte by byte, so it is collected and written
// once per frame. Only the newest TERMINAL_LIMIT characters are kept,
// so a sketch that prints forever doesn't grow the page without limit.
const TERMINAL_LIMIT = 100000
let terminalLength = 0
let pending = ""
let flushScheduled = false

function toTerminal(output, ok = true, clear = false) {
    const terminal = document.getElementById("stdout")
    terminal.querySelector(".hint")?.remove()

    if (clear) {
        pending = ""
        terminal.textContent = ""
        terminalLength = 0
    }

    if (ok) {
        pending += output
        // a hidden tab gets no frames, so keep the buffer bounded too
        if (pending.length > 2 * TERMINAL_LIMIT) {
            pending = pending.slice(-TERMINAL_LIMIT)
        }
        if (!flushScheduled) {
            flushScheduled = true
            requestAnimationFrame(flushTerminal)
        }
        return
    }

    // keep the order: earlier output first, then the error
    flushTerminal()
    const span = document.createElement("span")
    span.className = "error"
    span.textContent = output
    terminal.append(span)
    terminalLength += output.length
    trimTerminal(terminal)
    terminal.scrollTo(0, terminal.scrollHeight)
}

function flushTerminal() {
    flushScheduled = false
    if (!pending) {
        return
    }

    const terminal = document.getElementById("stdout")
    terminal.append(pending)
    terminalLength += pending.length
    pending = ""
    trimTerminal(terminal)
    terminal.scrollTo(0, terminal.scrollHeight)
}

// drop the oldest output beyond TERMINAL_LIMIT characters
function trimTerminal(terminal) {
    let excess = terminalLength - TERMINAL_LIMIT

    while (excess > 0 && terminal.firstChild) {
        const node = terminal.firstChild
        const length = node.textContent.length

        if (length <= excess) {
            node.remove()
            terminalLength -= length
            excess -= length
        } else {
            if (node.nodeType === Node.TEXT_NODE) {
                node.deleteData(0, excess)
            } else {
                node.textContent = node.textContent.slice(excess)
            }
            terminalLength -= excess
            excess = 0
        }
    }
}

Edrys.onReady(() => {
    console.log("AVR8js simulator loaded ...")

    const content = config().modules || ""

    if (content.trim()) {
        document.getElementById("modules").innerHTML = content
    } else {
        document.getElementById("modules").innerHTML =
            '<p class="hint empty">No circuit configured: add Wokwi parts in the module settings (<code>modules</code>).</p>'
    }

    document.getElementById("stdout").querySelector(".hint")?.replaceChildren(
        "Waiting for code from an editor module (subject ",
        Object.assign(document.createElement("code"), {
            textContent: executeSubject()
        }),
        ")…"
    )
    setStatus("idle", "wait")

    document.getElementById("stdin").addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            send()
        }
    })
    document.getElementById("send").addEventListener("click", send)
    document.getElementById("stop").addEventListener("click", stopClicked)

    // with synchronize, pick up the program the room is running (it starts at time 0)
    if (config().synchronize === true) {
        const sketch = Edrys.getState(sketchKey(), "Value")

        if (sketch) {
            compile(sketch)
        }
    }
});

// Room state is shared by all modules in the room, so the key names
// the module and the subject it listens to.
function sketchKey() {
    return "avr8js:" + executeSubject()
}

Edrys.onMessage(
    ({
        from,
        subject,
        body,
        module
    }) => {
        if (subject === executeSubject()) {
            // without synchronize, only run code this peer sent itself
            if (config().synchronize !== true && from !== Edrys.username) {
                return
            }

            // the sender keeps the upload in the room for peers who join or reload later
            if (config().synchronize === true && from === Edrys.username) {
                Edrys.getState(sketchKey(), "Value", body)
            }

            compile(body)
        } else if (
            subject === STOP_SUBJECT &&
            module === Edrys.module.url &&
            body === executeSubject() &&
            config().synchronize === true &&
            from !== Edrys.username // the sender stopped already
        ) {
            uploads++
            stop()
        }
    },
    // promiscuous: also receive messages sent by other modules (the editor)
    true);
