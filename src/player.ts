import { Terminal } from '@xterm/xterm';
import { ImageAddon } from '@xterm/addon-image';

import * as cast from './asciicast.ts';

// export interface PlayerHTMLElement extends HTMLElement {
//   src?: string;
//   audio_src?: string;
// }

// export interface Header {
//   version: number;
//   width: number
//   height: number

//   timestamp?: number
//   duration?: number
//   idle_time_limit?: number
//   title?: string

//   // constructor(data: Header) {
//   //   this = data;
//   // }

//   // constructor(json: cast.Header) {
//   //   this.version = json.version;
//   //   this.width = json.width;
//   //   this.height = json.height;
//   // }
// }

// export interface Event {
//   time: number;
//   type: string;
//   data: any;
// }

// const x: EventX = {
//   // date
//   rel_time: 1,
//   type: 'x',
//   date: 2,
// };

// export type EventOutput = Event<"o", string>;
// export type EventResize = Event<"r", string>;
// export type EventMarker = Event<"m", string>;
// export type EventExit = Event<"x", string>;

export class AsciicastPlayer {
  readonly player: HTMLElement;

  /** xtermjs object */
  private terminal: Terminal;

  /** is the player playing currently */
  private playing: boolean = false;

  /** which even is the next */
  private index: number = 0;

  /** header of the file playing */
  private header: cast.Header | null = null;

  // private markers: Array<number> = [];

  /** events from the file playing */
  private events: Array<cast.Event> = [];

  /** time of the final event */
  // private duration: number = 0;
  // private audio_data?: any;

  private timeout_id: number | null = null;

  /** event on start of playback (start of file) */
  on_start = (_: this) => {};

  /** event on end of playback (end of file) */
  on_end = (_: this) => {};

  /** event when marker is reached */
  on_marker = (_: this, event_index: number) => {};

  /** event on any error */
  on_error = (_: this) => {};

  /** event on seek */
  on_seek = (_: this) => {};

  /** event on play or pause (not including start or end of file) */
  on_play_pause = (_: this) => {};

  constructor(player: HTMLElement) {
    this.player = player;

    this.terminal = new Terminal();

    // TODO add fit addon
    const imageAddon = new ImageAddon({
      iipSupport: true,
      sixelSupport: true,
    });
    this.terminal.loadAddon(imageAddon);
    this.terminal.open(this.player as HTMLElement);
  }

  private execute_event(event: cast.Event) {
    if (event[1] == cast.EventTypeOutput) {
      this.terminal.write(event[2] as string);
    } else if (event[1] == cast.EventTypeResize) {
      const size = (event[2] as string).split("x");
      const width = parseInt(size[0]);
      const height = parseInt(size[1]);

      this.terminal.resize(width, height);
      console.log(`Resizing to ${width}x${height}`);
    } else {
      console.log(`Ignorning event ${event}`);
      // TODO im ignoring every other event
    }
  }

  private queue_next() {
    if (this.timeout_id) {
      clearTimeout(this.timeout_id);
      this.timeout_id = null;
    }

    const event_index = this.index;
    const event = this.events[event_index];

    this.timeout_id = setTimeout(() => {
      this.execute_event(event);
      this.index = event_index + 1;

      // the end of file
      if (this.index >= this.events.length) {
        this.playing = false;
        // call on_end event
        this.on_end(this);
        return;
      }

      if (this.playing) {
        this.queue_next();
      }
    }, event[0] * 1000);
  }

  is_playing() {
    return this.timeout_id != null;
  }

  play() {
    // cannot play twice
    if (this.playing) {
      return;
    }

    this.playing = true;

    // resize when playing from start
    if (this.index == 0) {
      this.terminal.resize(this.header!.width, this.header!.height);
    }

    this.queue_next();
  }

  pause() {
    if (this.timeout_id) {
      clearTimeout(this.timeout_id);
      this.timeout_id = null;
    }

    this.playing = false;
  }

  reset() {
    this.terminal.reset()
    this.index = 0;
  }

  seek(index: number) { // TODO handle if player is playing at the moment
    console.log(`Seeking to index ${index}`);

    if (this.timeout_id) {
      clearTimeout(this.timeout_id);
      this.timeout_id = null;
    }

    this.reset();

    if (index > 0) {
      for (let i = 0; i < index; i++) {
        this.execute_event(this.events[i]);
      }
    } else {
      this.terminal.resize(this.header!.width, this.header!.height);
    }
  }

  // stop() {
  //   this.playing = false;
  //   this.seek(0);
  // }

  async load_fetch(path: RequestInfo | URL): Promise<void> {
    if (this.timeout_id) {
      clearTimeout(this.timeout_id);
      this.timeout_id = null;
    }

    this.header = null;
    this.playing = false;
    this.index = 0;

    return fetch(path)
      .then(x => x.text())
      .then(x => this.load(x))
      .catch(x => {
        console.error(`Failed to fetch ${path}: ${x}`);
        // this.on_error
      });
  }

  async load(data: string): Promise<void> {
    const lines = data.split("\n");
    const header = JSON.parse(lines[0]) as cast.Header; // TODO error handling?

    // TODO parse both V2 and V3

    let time_start = 0;

    let events: Array<cast.Event> = [];
    for (let i = 1; i < lines.length; i++) {
      // ignore empty lines or comments
      if (lines[i].trim() == "" || lines[i].trim().startsWith("#")) {
        continue;
      }

      let event = JSON.parse(lines[i]) as cast.Event;

      // converting all timestamps to relative to each other
      const timestamp = event[0] - time_start;
      time_start += timestamp;
      event[0] = timestamp;

      // TODO now just filtering out the known and useful event types
      if (event[1] == cast.EventTypeOutput || event[1] == cast.EventTypeResize || event[1] == cast.EventTypeMarker) {
        events.push(event);
      }
    }

    this.events = events;
    this.header = header;
  }
}

const elem = document.getElementById('terminal')!;
const player = new AsciicastPlayer(elem);
player.load_fetch("/iterm2.cast")
  .then(() => player.play());

// // TODO how do i a loop and sync with the progressbar?
// function play(terminal: Terminal, text: String) {
//   const lines = text.split("\n");
//   const header = JSON.parse(lines[0]);
//   console.log(header);

//   // initial resize
//   terminal.resize(header.width, header.height);

//   // in unix timestamp format
//   const time_start = parseInt(header.timestamp);

//   for (let i = 1; i < lines.length; i++) {
//     const line = lines[i];

//     // ignore empty lines or comments
//     if (line.trim() == "" || line.trim().startsWith("#")) {
//       continue;
//     }

//     const event_raw: [string, string, any] = JSON.parse(line);
//     const time = parseFloat(event_raw[0]);
//     const event = event_raw[1];
//     const data = event_raw[2];

//     let action: Function;
//     if (event == "o") {
//       action = () => {
//         terminal.write(data as string);
//       };
//       // delay the write by 400ms
//       // setTimeout(() => {
//       //     terminal.write(data as string);
//       // }, time_sec * 1000);

//       // handle_o(terminal, parseFloat(event[0]), event[2]);
//     } else if (event == "r") {
//       const size = (data as string).split("x");
//       const width = parseInt(size[0]);
//       const height = parseInt(size[1]);

//       action = () => {
//         terminal.resize(width, height);
//         console.log(`Resizing to ${width}x${height}`);
//       };

//       // setTimeout(() => {
//       //     terminal.resize(width, height);
//       //     console.log(`Resizing to ${width}x${height}`);
//       // }, time_sec * 1000);
//     } else {
//       // terminal.resize()
//       console.log(`Ignoring event '${event}'`, data);
//       continue;
//     }

//     // const time_now = Date.now();
//     const diff = Date.now() - (time_start + time);
//     if (diff <= 0) {
//       action();
//     } else {
//       setTimeout(action, diff);
//     }
//   }
//   // // file.parse
//   // console.log(terminal, text)
// }

// const elem = document.getElementById('terminal');
// if (elem == null) {
//   console.error("Could not find #terminal element");
// } else {
//   var term = new Terminal();
//   const imageAddon = new ImageAddon({
//     iipSupport: true,
//     sixelSupport: true,
//   });
//   term.loadAddon(imageAddon);

//   term.open(elem);

//   fetch("/iterm2.cast").then(r => r.text().then((txt) => {
//     play(term, txt);
//     // term.write(txt)
//   }));
// }
