import { Terminal } from '@xterm/xterm';
import { ImageAddon } from '@xterm/addon-image';

// interface AsciicastV2Event {
//     timestamp:
// }

// function handle_o(terminal: Terminal, timestamp: number, data: string) {
//     terminal.write(data);
// }

function play(terminal: Terminal, text: String) {
    const lines = text.split("\n");
    const header = JSON.parse(lines[0]);
    console.log(header);

    terminal.resize(header.width, header.height);

    // const start = header.timestamp;

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];

        // ignore empty lines
        if (line.trim() == "") {
            continue;
        }

        const event_raw: [string, string, any] = JSON.parse(line);
        const time_sec = parseFloat(event_raw[0]);
        const event = event_raw[1];
        const data = event_raw[2];
        // console.log(event[0], event[1], event[2]);
        if (event == "o") {
            // delay the write by 400ms
            setTimeout(() => {
                terminal.write(data as string);
            }, time_sec * 1000);

            // handle_o(terminal, parseFloat(event[0]), event[2]);
        } else if (event == "r") {
            const size = (data as string).split("x");
            const width = parseInt(size[0]);
            const height = parseInt(size[1]);

            setTimeout(() => {
                terminal.resize(width, height);
                console.log(`Resizing to ${width}x${height}`);
            }, time_sec * 1000);
        } else {
            // terminal.resize()
            console.log(`Ignoring event '${event}'`, data);
        }
    }
    // // file.parse
    // console.log(terminal, text)
}

const elem = document.getElementById('terminal');
if (elem == null) {
    console.error("Could not find #terminal element");
} else {
  var term = new Terminal();
  const imageAddon = new ImageAddon({
    iipSupport: true,
    sixelSupport: true,
  });
  term.loadAddon(imageAddon);

  term.open(elem);

  fetch("/iterm2.cast").then(r => r.text().then((txt) => {
    play(term, txt);
    // term.write(txt)
  }));
}

/// TODO how do i read the file?


// const r = new FileReader();
// r.readAsText()

// import { Terminal } from '@xterm/xterm';

// class Player {
// }
